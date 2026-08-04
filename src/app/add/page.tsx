"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/hooks/use-geolocation";

type PlaceCategory = "park" | "restaurant" | "beach" | "hotel" | "cafe" | "other";

export default function AddPage() {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("other");
  const [dogStatus, setDogStatus] = useState("ask_first");
  const [maxDogs, setMaxDogs] = useState("");
  const [exceptionText, setExceptionText] = useState("");
  const [alsoSave, setAlsoSave] = useState(true);
  const [coordLat, setCoordLat] = useState("");
  const [coordLng, setCoordLng] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    // Intentionally only react to new coords from the geolocation hook.
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);

    try {
      if (!selected) {
        setMessage("Search and select a location first (geocoding is for interactive selection).");
        return;
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
        ok?: boolean;
        created?: boolean;
        duplicate?: boolean;
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
        return;
      }

      const placeId = createData.place.id;
      const notes: string[] = [];
      if (createData.duplicate) {
        notes.push(createData.message ?? "Matched an existing nearby place.");
      } else {
        notes.push("Place created.");
      }

      if (alsoSave) {
        const saveRes = await fetch("/api/saves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeId,
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
          placeId,
          dogStatus,
          access: ["outdoor"],
          maxDogs: maxDogs ? Number(maxDogs) : null,
          exceptionText: exceptionText || null,
          sourceType: "firsthand",
          promote: true,
        }),
      });
      const contribData = (await contribRes.json()) as { message?: string; error?: string };
      notes.push(
        contribRes.ok
          ? contribData.message ?? "Contribution submitted."
          : contribData.error ?? "Contribution failed.",
      );

      if (createData.place.slug) {
        notes.push(`Open: /place/${createData.place.slug}`);
      }

      setMessage(notes.join(" "));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-28">
      <h1 className="font-display text-4xl text-teal-deep">Add a place</h1>
      <p className="mt-2 text-muted">
        Create a location, optionally save it privately, then publish a dog-policy contribution.
        Private saves never publish rules.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
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

        <label className="block text-sm">
          Dog status
          <select
            className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm"
            value={dogStatus}
            onChange={(e) => setDogStatus(e.target.value)}
          >
            <option value="dogs_welcome">Dogs welcome</option>
            <option value="dogs_ok_outdoors">Dogs OK outdoors</option>
            <option value="dogs_ok_with_restrictions">Dogs OK with restrictions</option>
            <option value="ask_first">Ask first</option>
            <option value="service_animals_only">Service animals only</option>
            <option value="no_dogs">No dogs</option>
          </select>
        </label>

        <label className="block text-sm">
          Max dogs (optional)
          <Input
            className="mt-1"
            type="number"
            min={1}
            value={maxDogs}
            onChange={(e) => setMaxDogs(e.target.value)}
            placeholder="1"
          />
        </label>

        <label className="block text-sm">
          Exception / notes
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={exceptionText}
            onChange={(e) => setExceptionText(e.target.value)}
            placeholder="Patio only after 5pm…"
          />
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

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Submitting…" : "Create place + publish contribution"}
        </Button>
      </form>
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
