"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { DogProfile } from "@/lib/types";
import { tryCreateBrowserClient } from "@/lib/supabase/client";
import { publicApiError } from "@/lib/api-errors";

const STORAGE_KEY = "dogmarked.dog_profiles";

type SaveState = "loading" | "idle" | "unsaved" | "saving" | "saved" | "error";

export default function ProfilePage() {
  const [dogs, setDogs] = useState<DogProfile[]>(DEFAULT_DOG_PROFILES);
  const [email, setEmail] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setSaveState("loading");
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DogProfile[];
          if (Array.isArray(parsed) && parsed.length && !cancelled) {
            setDogs(parsed);
          }
        }
      } catch {
        // keep defaults
      }

      const supabase = tryCreateBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setSignedIn(false);
          setSaveState("idle");
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      setSignedIn(Boolean(user));
      setEmail(user?.email ?? null);

      if (!user) {
        setSaveState("idle");
        return;
      }

      const { data: rows, error } = await supabase
        .from("dog_profiles")
        .select("*")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (error) {
        setMessage("Could not load dog profiles from your account.");
        setSaveState("error");
        return;
      }

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
      setSaveState("idle");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function markLocal(next: DogProfile[]) {
    setDogs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaveState("unsaved");
    setMessage(null);
  }

  async function saveChanges() {
    setSaveState("saving");
    setMessage(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dogs));

    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setSaveState("saved");
      setMessage("Saved on this device.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveState("saved");
      setMessage("Saved on this device. Sign in to keep them across devices.");
      return;
    }

    try {
      await supabase.rpc("ensure_own_profile");
    } catch {
      // RPC may not be applied yet (migration 012)
    }

    let failed = false;
    for (const dog of dogs) {
      const { error } = await supabase.from("dog_profiles").upsert({
        id: dog.id.startsWith("local-") ? undefined : dog.id,
        user_id: user.id,
        name: dog.name,
        weight_kg: dog.weightKg,
        size_class: dog.sizeClass,
        travels_in_carrier: dog.travelsInCarrier,
      });
      if (error) {
        failed = true;
        setMessage(publicApiError(error, "Could not save dog profiles."));
      }
    }

    if (failed) {
      setSaveState("error");
      return;
    }

    setSaveState("saved");
    setMessage("Changes saved.");
  }

  const statusLabel =
    saveState === "loading"
      ? "Loading…"
      : saveState === "saving"
        ? "Saving…"
        : saveState === "saved"
          ? "Saved"
          : saveState === "unsaved"
            ? "Unsaved changes"
            : saveState === "error"
              ? "Could not save"
              : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-28">
      <h1 className="font-display text-4xl text-teal-deep">Profile</h1>
      <p className="mt-2 text-muted">
        {signedIn
          ? `Signed in as ${email}`
          : "Browsing as guest — Sugar & Munch live on this device until you sign in."}
      </p>
      {statusLabel ? (
        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">{statusLabel}</p>
      ) : null}

      <div id="dogs" className="mt-6 space-y-4">
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
                  disabled={saveState === "loading"}
                  onChange={(e) => {
                    const next = [...dogs];
                    next[index] = { ...dog, weightKg: Number(e.target.value) };
                    markLocal(next);
                  }}
                />
              </label>
              <label className="text-sm">
                Size
                <select
                  className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  value={dog.sizeClass}
                  disabled={saveState === "loading"}
                  onChange={(e) => {
                    const next = [...dogs];
                    next[index] = {
                      ...dog,
                      sizeClass: e.target.value as DogProfile["sizeClass"],
                    };
                    markLocal(next);
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
                disabled={saveState === "loading"}
                onChange={(e) => {
                  const next = [...dogs];
                  next[index] = { ...dog, travelsInCarrier: e.target.checked };
                  markLocal(next);
                }}
              />
              Travels in a carrier
            </label>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          onClick={() => void saveChanges()}
          disabled={saveState === "loading" || saveState === "saving"}
        >
          Save changes
        </Button>
        {signedIn ? (
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        ) : (
          <Button asChild variant="secondary">
            <Link href="/login?next=/profile">Sign in</Link>
          </Button>
        )}
      </div>
      {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
