"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeolocationPermissionState =
  | "granted"
  | "denied"
  | "prompt"
  | "unavailable";

export interface GeolocationCoords {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export interface UseGeolocationResult {
  permission: GeolocationPermissionState;
  coords: GeolocationCoords | null;
  error: string | null;
  loading: boolean;
  /** Request a one-shot position (triggers browser prompt when needed). */
  request: () => void;
  refreshPermission: () => Promise<void>;
}

function detectUnavailable(): boolean {
  return typeof navigator === "undefined" || !("geolocation" in navigator);
}

async function queryPermission(): Promise<GeolocationPermissionState> {
  if (detectUnavailable()) return "unavailable";

  try {
    if (!navigator.permissions?.query) {
      // Permissions API missing — treat as prompt until a request resolves.
      return "prompt";
    }
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    if (
      status.state === "granted" ||
      status.state === "denied" ||
      status.state === "prompt"
    ) {
      return status.state;
    }
    return "prompt";
  } catch {
    return "prompt";
  }
}

export function useGeolocation(options?: {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}): UseGeolocationResult {
  const [permission, setPermission] =
    useState<GeolocationPermissionState>("unavailable");
  const [coords, setCoords] = useState<GeolocationCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const watchRef = useRef<PermissionStatus | null>(null);

  const refreshPermission = useCallback(async () => {
    const next = await queryPermission();
    setPermission(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const next = await queryPermission();
      if (cancelled) return;
      setPermission(next);

      try {
        if (!navigator.permissions?.query) return;
        const status = await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });
        watchRef.current = status;
        status.onchange = () => {
          if (
            status.state === "granted" ||
            status.state === "denied" ||
            status.state === "prompt"
          ) {
            setPermission(status.state);
          }
        };
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      if (watchRef.current) {
        watchRef.current.onchange = null;
      }
    };
  }, []);

  const request = useCallback(() => {
    if (detectUnavailable()) {
      setPermission("unavailable");
      setError("Geolocation is not available in this browser.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : null,
        });
        setPermission("granted");
        setLoading(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission("denied");
          setError("Location permission denied.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Location unavailable.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out.");
        } else {
          setError(err.message || "Unable to get location.");
        }
        setLoading(false);
        void refreshPermission();
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeoutMs ?? 12_000,
        maximumAge: options?.maximumAgeMs ?? 60_000,
      },
    );
  }, [
    options?.enableHighAccuracy,
    options?.maximumAgeMs,
    options?.timeoutMs,
    refreshPermission,
  ]);

  return {
    permission,
    coords,
    error,
    loading,
    request,
    refreshPermission,
  };
}
