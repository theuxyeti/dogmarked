"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AddPage() {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [dogStatus, setDogStatus] = useState("ask_first");
  const [maxDogs, setMaxDogs] = useState("");
  const [exceptionText, setExceptionText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!selected) {
      setMessage("Search and select a location first (geocoding is for interactive selection).");
      return;
    }

    // Phase 1: contribute policy against an existing seed place when possible,
    // otherwise guide the user — place insert requires auth + Supabase.
    const placesRes = await fetch(
      `/api/places?minLng=${selected.lng - 0.05}&minLat=${selected.lat - 0.05}&maxLng=${selected.lng + 0.05}&maxLat=${selected.lat + 0.05}`,
    );
    const placesData = (await placesRes.json()) as {
      places: Array<{ id: string; name: string; slug: string }>;
    };
    const match =
      placesData.places.find(
        (p) => p.name.toLowerCase() === (name || selected.name).toLowerCase(),
      ) ?? placesData.places[0];

    if (!match) {
      setMessage(
        `Location selected (${selected.formattedAddress}). Connect Supabase and sign in to insert new places; curated fixtures only match nearby seeds for now.`,
      );
      return;
    }

    const res = await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: match.id,
        dogStatus,
        access: ["outdoor"],
        maxDogs: maxDogs ? Number(maxDogs) : null,
        exceptionText: exceptionText || null,
        sourceType: "firsthand",
        promote: true,
      }),
    });
    const data = (await res.json()) as { message?: string; error?: string };
    setMessage(data.message ?? data.error ?? (res.ok ? "Submitted." : "Failed."));
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-28">
      <h1 className="font-display text-4xl text-teal-deep">Add a place</h1>
      <p className="mt-2 text-muted">
        Search for a location, then optionally submit a dog-policy contribution. Saving privately
        is separate from publishing.
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

        <Button type="submit" className="w-full">
          Submit contribution
        </Button>
      </form>
      {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
