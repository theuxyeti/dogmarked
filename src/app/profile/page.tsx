"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { DogProfile } from "@/lib/types";
import { tryCreateBrowserClient } from "@/lib/supabase/client";

const STORAGE_KEY = "dogmarked.dog_profiles";

export default function ProfilePage() {
  const [dogs, setDogs] = useState<DogProfile[]>(DEFAULT_DOG_PROFILES);
  const [email, setEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DogProfile[];
        if (Array.isArray(parsed) && parsed.length) setDogs(parsed);
      }
    } catch {
      // keep defaults
    }

    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      if (!data.user) return;
      void supabase
        .from("dog_profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .then(({ data: rows }) => {
          if (rows && rows.length) {
            setDogs(
              rows.map((r) => ({
                id: String(r.id),
                userId: String(r.user_id),
                name: String(r.name),
                weightKg: Number(r.weight_kg),
                sizeClass: (r.size_class as DogProfile["sizeClass"]) ?? "unknown",
                travelsInCarrier: Boolean(r.travels_in_carrier),
              })),
            );
          }
        });
    });
  }, []);

  function persist(next: DogProfile[]) {
    setDogs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setMessage("Saved locally. Syncing to Supabase when signed in.");
  }

  async function syncToSupabase() {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setMessage("Supabase not configured — dogs stay in localStorage.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Sign in to sync dog profiles.");
      return;
    }

    for (const dog of dogs) {
      await supabase.from("dog_profiles").upsert({
        id: dog.id.startsWith("local-") ? undefined : dog.id,
        user_id: user.id,
        name: dog.name,
        weight_kg: dog.weightKg,
        size_class: dog.sizeClass,
        travels_in_carrier: dog.travelsInCarrier,
      });
    }
    setMessage("Synced dog profiles to Supabase.");
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-28">
      <h1 className="font-display text-4xl text-teal-deep">Profile</h1>
      <p className="mt-2 text-muted">
        {email ? `Signed in as ${email}` : "Browsing as guest — Sugar & Munch live in localStorage."}
      </p>

      <div className="mt-6 space-y-4">
        {dogs.map((dog, index) => (
          <div key={dog.id} className="rounded-xl border border-border bg-card p-4">
            <p className="font-display text-xl text-ink">{dog.name}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Weight (kg)
                <Input
                  className="mt-1"
                  type="number"
                  step="0.1"
                  value={dog.weightKg}
                  onChange={(e) => {
                    const next = [...dogs];
                    next[index] = { ...dog, weightKg: Number(e.target.value) };
                    persist(next);
                  }}
                />
              </label>
              <label className="text-sm">
                Size
                <select
                  className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  value={dog.sizeClass}
                  onChange={(e) => {
                    const next = [...dogs];
                    next[index] = {
                      ...dog,
                      sizeClass: e.target.value as DogProfile["sizeClass"],
                    };
                    persist(next);
                  }}
                >
                  <option value="toy">Toy</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="giant">Giant</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dog.travelsInCarrier}
                onChange={(e) => {
                  const next = [...dogs];
                  next[index] = { ...dog, travelsInCarrier: e.target.checked };
                  persist(next);
                }}
              />
              Travels in a carrier
            </label>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => void syncToSupabase()}>Sync to Supabase</Button>
        <Button asChild variant="secondary">
          <Link href="/login">Sign in</Link>
        </Button>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
      {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
