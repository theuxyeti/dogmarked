"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PolicyForm, type PolicyFormValues } from "@/components/policy/policy-form";
import { useGeolocation } from "@/hooks/use-geolocation";

type PlaceCategory = "park" | "restaurant" | "beach" | "hotel" | "cafe" | "other";

export default function AddPage() {
  const searchParams = useSearchParams();
  const presetSlug = searchParams.get("place");

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("other");
  const [alsoSave, setAlsoSave] = useState(true);
  const [coordLat, setCoordLat] = useState("");
  const [coordLng, setCoordLng] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [placeSlug, setPlaceSlug] = useState<string | null>(null);
  const geo = useGeolocation();
  const [suggestions, setSuggestions] = useState<
    Array<{ name: string; formattedAddress: string; lat: number; lng: number }>
  >([]);
  const [selected, setSelected] = useState<{
    name: string;
    lat: number;
    lng: number;
    formattedAddress: string;
  } | null>(null);

  useEffect(() => {
    if (!presetSlug) return;
    void fetch(`/api/places/${encodeURIComponent(presetSlug)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          place?: { id: string; slug: string; name: string; lat: number; lng: number; address?: string | null };
        };
        if (!data.place) return;
        setPlaceId(data.place.id);
        setPlaceSlug(data.place.slug);
        setName(data.place.name);
        setSelected({
          name: data.place.name,
          lat: data.place.lat,
          lng: data.place.lng,
          formattedAddress: data.place.address ?? data.place.name,
        });
      })
      .catch(() => undefined);
  }, [presetSlug]);

  async function searchPlaces() {
    setMessage(null);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query || name)}`);
    const data = (await res.json()) as {
      results?: Array<{ name: string; formattedAddress: string; lat: number; lng: number }>;
      error?: string;
    };
    if (!res.ok) {
      setMessage(data.error ?? "Search failed");
      return;
    }
    setSuggestions(data.results ?? []);
  }

  function useCurrentLocation() {
    setMessage(null);
    geo.request();
  }

  useEffect(() => {
    if (!geo.coords) return;
    const label = `Current location (${geo.coords.lat.toFixed(5)}, ${geo.coords.lng.toFixed(5)})`;
    setSelected({
      name: name || "Current location",
      lat: geo.coords.lat,
      lng: geo.coords.lng,
      formattedAddress: label,
    });
    setCoordLat(String(geo.coords.lat));
    setCoordLng(String(geo.coords.lng));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.coords]);

  useEffect(() => {
    if (geo.error) setMessage(geo.error);
  }, [geo.error]);

  function applyCoordinates() {
    const lat = Number(coordLat);
    const lng = Number(coordLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setMessage("Enter valid latitude (-90…90) and longitude (-180…180).");
      return;
    }
    setSelected({
      name: name || "Dropped pin",
      lat,
      lng,
      formattedAddress: `Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    });
    setMessage(null);
  }

  async function ensurePlace(): Promise<{ id: string; slug: string } | null> {
    if (placeId && placeSlug) return { id: placeId, slug: placeSlug };
    if (!selected) {
      setMessage("Search and select a location first.");
      return null;
    }

    const placeName = name || selected.name;
    const createRes = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: placeName,
        category,
        lat: selected.lat,
        lng: selected.lng,
        address: selected.formattedAddress,
        sourceAttribution:
          "User-selected via MapTiler geocoding adapter (interactive selection only).",
      }),
    });
    const createData = (await createRes.json()) as {
      place?: { id: string; slug: string; name: string };
      error?: string;
      message?: string;
    };
    if (!createRes.ok || !createData.place) {
      setMessage(
        createData.error ??
          (createRes.status === 401
            ? "Sign in required to create places and publish contributions."
            : "Could not create place."),
      );
      return null;
    }

    setPlaceId(createData.place.id);
    setPlaceSlug(createData.place.slug);
    if (createData.message) setMessage(createData.message);
    return { id: createData.place.id, slug: createData.place.slug };
  }

  async function onPolicySubmit(values: PolicyFormValues) {
    setMessage(null);
    const place = await ensurePlace();
    if (!place) return;

    const notes: string[] = [];

    if (alsoSave) {
      const saveRes = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: place.id,
          status: "want_to_go",
          visibility: "private",
        }),
      });
      const saveData = (await saveRes.json()) as { message?: string; error?: string };
      notes.push(
        saveRes.ok
          ? "Saved privately (does not publish)."
          : saveData.error ?? "Private save failed.",
      );
    }

    const contribRes = await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: place.id,
        dogStatus: values.dogStatus,
        access: values.access,
        maxDogs: values.maxDogs,
        maxWeightKg: values.maxWeightKg,
        maxCombinedWeightKg: values.maxCombinedWeightKg,
        smallDogsOnly: values.smallDogsOnly,
        carrierRequired: values.carrierRequired,
        leashRequired: values.leashRequired,
        advanceApprovalRequired: values.advanceApprovalRequired,
        feeType: values.feeType,
        feeAmount: values.feeAmount,
        feeCurrency: values.feeCurrency,
        exceptionText: values.exceptionText || null,
        sourceType: values.sourceType,
        sourceUrl: values.sourceUrl || null,
        promote: true,
      }),
    });
    const contribData = (await contribRes.json()) as { message?: string; error?: string };
    notes.push(
      contribRes.ok
        ? contribData.message ?? "Contribution submitted."
        : contribData.error ?? "Contribution failed.",
    );
    notes.push(`Open: /place/${place.slug}`);
    setMessage(notes.join(" "));
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-28">
      <h1 className="font-display text-4xl text-teal-deep">Add a place</h1>
      <p className="mt-2 text-muted">
        Pick a location, optionally save privately, then submit a structured dog-policy
        contribution.
      </p>

      <div className="mt-8 space-y-4">
        <label className="block text-sm">
          Place name
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spanish River Park"
            required
          />
        </label>
        <label className="block text-sm">
          Search address or area
          <div className="mt-1 flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Boca Raton, FL"
            />
            <Button type="button" variant="secondary" onClick={searchPlaces}>
              Search
            </Button>
          </div>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={useCurrentLocation}
            disabled={geo.loading}
          >
            {geo.loading ? "Locating…" : "Use current location"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            Latitude
            <Input
              className="mt-1"
              value={coordLat}
              onChange={(e) => setCoordLat(e.target.value)}
              placeholder="26.3558"
              inputMode="decimal"
            />
          </label>
          <label className="block text-sm">
            Longitude
            <Input
              className="mt-1"
              value={coordLng}
              onChange={(e) => setCoordLng(e.target.value)}
              placeholder="-80.0705"
              inputMode="decimal"
            />
          </label>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={applyCoordinates}>
          Use coordinates
        </Button>

        {suggestions.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {suggestions.map((s) => (
              <li key={`${s.lat}-${s.lng}-${s.name}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-foam"
                  onClick={() => {
                    setSelected(s);
                    if (!name) setName(s.name);
                    setPlaceId(null);
                    setPlaceSlug(null);
                  }}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-muted">{s.formattedAddress}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {selected ? (
          <p className="text-xs text-muted">
            Selected: {selected.formattedAddress} ({selected.lat.toFixed(4)},{" "}
            {selected.lng.toFixed(4)})
          </p>
        ) : null}

        <label className="block text-sm">
          Category
          <select
            className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as PlaceCategory)}
          >
            <option value="park">Park</option>
            <option value="beach">Beach</option>
            <option value="restaurant">Restaurant</option>
            <option value="cafe">Cafe</option>
            <option value="hotel">Hotel</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={alsoSave}
            onChange={(e) => setAlsoSave(e.target.checked)}
            className="size-4 accent-[var(--teal,#0f5c56)]"
          />
          Also save privately to my map (does not publish)
        </label>
      </div>

      <div className="mt-10 border-t border-border pt-8">
        <h2 className="font-display text-2xl text-ink">Dog policy</h2>
        <p className="mt-1 text-sm text-muted">
          Official rules and known exceptions. Canonical promote is server-only.
        </p>
        <div className="mt-6">
          <PolicyForm
            placeName={name || selected?.name}
            submitLabel="Create place + publish contribution"
            onSubmit={onPolicySubmit}
          />
        </div>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-muted">
          {message.includes("/place/") ? (
            <>
              {message.split("Open: ")[0]}
              <Link
                className="text-teal-deep underline"
                href={message.match(/\/place\/[a-z0-9-]+/)?.[0] ?? "/explore"}
              >
                View place
              </Link>
            </>
          ) : (
            message
          )}
        </p>
      ) : null}
      <p className="mt-6 text-sm text-muted">
        Need an account first?{" "}
        <Link href="/login?next=/add" className="text-teal-deep underline">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}
