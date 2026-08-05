"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import {
  LOCAL_PETS_STORAGE_KEY,
  dogProfileToLocalPet,
  formatActivePackLabel,
  type PetWriteInput,
} from "@/lib/pets";
import type { PetProfile, SizeClass } from "@/lib/types";
import { tryCreateBrowserClient } from "@/lib/supabase/client";
import { publicApiError } from "@/lib/api-errors";
import { kgToLb } from "@/lib/units";

type SaveState = "loading" | "idle" | "unsaved" | "saving" | "saved" | "error";

function defaultLocalPets(): PetProfile[] {
  return DEFAULT_DOG_PROFILES.map((d) => dogProfileToLocalPet(d));
}

function readLocalPets(): PetProfile[] {
  try {
    const raw = localStorage.getItem(LOCAL_PETS_STORAGE_KEY);
    if (!raw) return defaultLocalPets();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.length) return defaultLocalPets();
    return parsed.map((row) => {
      const r = row as Partial<PetProfile> & {
        weightKg?: number;
        sizeClass?: SizeClass;
        travelsInCarrier?: boolean;
      };
      if (r.weightKg != null && r.sizeClass && r.name && r.id) {
        return dogProfileToLocalPet(
          {
            id: String(r.id),
            userId: r.userId ?? "",
            name: String(r.name),
            weightKg: Number(r.weightKg),
            sizeClass: r.sizeClass,
            travelsInCarrier: Boolean(r.travelsInCarrier),
          },
          {
            photoPath: r.photoPath ?? null,
            breed: r.breed ?? null,
            notes: r.notes ?? null,
            isActive: r.isActive !== false,
            publicDisplayEnabled: Boolean(r.publicDisplayEnabled),
          },
        );
      }
      return dogProfileToLocalPet(DEFAULT_DOG_PROFILES[0]!);
    });
  } catch {
    return defaultLocalPets();
  }
}

export default function ProfilePage() {
  const [pets, setPets] = useState<PetProfile[]>(defaultLocalPets);
  const [email, setEmail] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setSaveState("loading");
      const local = readLocalPets();
      if (!cancelled) setPets(local);

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

      const res = await fetch("/api/pets");
      if (cancelled) return;

      if (!res.ok) {
        setMessage("Could not load pets from your account.");
        setSaveState("error");
        return;
      }

      const json = (await res.json()) as { pets?: PetProfile[] };
      if (json.pets && json.pets.length) {
        setPets(json.pets);
        localStorage.setItem(LOCAL_PETS_STORAGE_KEY, JSON.stringify(json.pets));
      }
      setSaveState("idle");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function markLocal(next: PetProfile[]) {
    setPets(next);
    localStorage.setItem(LOCAL_PETS_STORAGE_KEY, JSON.stringify(next));
    setSaveState("unsaved");
    setMessage(null);
  }

  function updatePet(index: number, patch: Partial<PetProfile>) {
    const next = [...pets];
    const current = next[index];
    if (!current) return;
    const merged = { ...current, ...patch };
    if (patch.weightKg != null) {
      merged.weightLb = Math.round(kgToLb(patch.weightKg) * 10) / 10;
    }
    if (patch.sizeClass) merged.size = patch.sizeClass;
    next[index] = merged;
    markLocal(next);
  }

  async function saveChanges() {
    setSaveState("saving");
    setMessage(null);
    localStorage.setItem(LOCAL_PETS_STORAGE_KEY, JSON.stringify(pets));

    if (!signedIn) {
      setSaveState("saved");
      setMessage("Saved on this device. Sign in to keep them across devices.");
      return;
    }

    try {
      const desiredActiveNames = new Set(
        pets.filter((p) => p.isActive).map((p) => p.name.trim().toLowerCase()),
      );
      let nextPets: PetProfile[] = [];

      for (const pet of pets) {
        const payload: PetWriteInput = {
          name: pet.name,
          weightKg: pet.weightKg ?? null,
          sizeClass: pet.sizeClass,
          breed: pet.breed ?? null,
          travelsInCarrier: pet.travelsInCarrier,
          notes: pet.notes ?? null,
          isActive: pet.isActive,
          publicDisplayEnabled: pet.publicDisplayEnabled,
        };

        if (pet.id.startsWith("local-")) {
          const res = await fetch("/api/pets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? "Could not save pet.");
          }
          const json = (await res.json()) as { pet: PetProfile };
          nextPets.push(json.pet);
        } else {
          const res = await fetch(`/api/pets/${pet.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? "Could not save pet.");
          }
          const json = (await res.json()) as { pet: PetProfile };
          nextPets.push(json.pet);
        }
      }

      const packIds = nextPets
        .filter((p) => desiredActiveNames.has(p.name.trim().toLowerCase()))
        .map((p) => p.id);

      const packRes = await fetch("/api/pets/active-pack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petIds: packIds }),
      });
      if (packRes.ok) {
        const packJson = (await packRes.json()) as { pets?: PetProfile[] };
        if (packJson.pets) nextPets = packJson.pets;
      }

      setPets(nextPets);
      localStorage.setItem(LOCAL_PETS_STORAGE_KEY, JSON.stringify(nextPets));
      setSaveState("saved");
      setMessage("Changes saved.");
    } catch (e) {
      setSaveState("error");
      const msg = e instanceof Error ? e.message : null;
      setMessage(msg || publicApiError(null, "Could not save pets."));
    }
  }

  async function addPet() {
    const draft: PetProfile = {
      id: `local-${crypto.randomUUID()}`,
      userId: "",
      name: "New pet",
      weightKg: 2.3,
      weightLb: 5,
      sizeClass: "small",
      size: "small",
      travelsInCarrier: true,
      isActive: true,
      publicDisplayEnabled: false,
    };

    if (!signedIn) {
      markLocal([...pets, draft]);
      return;
    }

    setSaveState("saving");
    const res = await fetch("/api/pets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        weightKg: draft.weightKg,
        sizeClass: draft.sizeClass,
        travelsInCarrier: true,
        isActive: true,
      }),
    });
    if (!res.ok) {
      setSaveState("error");
      setMessage("Could not add a pet.");
      return;
    }
    const json = (await res.json()) as { pet: PetProfile };
    const next = [...pets, json.pet];
    setPets(next);
    localStorage.setItem(LOCAL_PETS_STORAGE_KEY, JSON.stringify(next));
    setSaveState("saved");
    setMessage("Pet added.");
  }

  async function removePet(pet: PetProfile, index: number) {
    if (pet.id.startsWith("local-") || !signedIn) {
      markLocal(pets.filter((_, i) => i !== index));
      return;
    }
    setSaveState("saving");
    const res = await fetch(`/api/pets/${pet.id}`, { method: "DELETE" });
    if (!res.ok) {
      setSaveState("error");
      setMessage("Could not remove that pet.");
      return;
    }
    const next = pets.filter((_, i) => i !== index);
    setPets(next);
    localStorage.setItem(LOCAL_PETS_STORAGE_KEY, JSON.stringify(next));
    setSaveState("saved");
  }

  function toggleActive(pet: PetProfile, index: number) {
    updatePet(index, { isActive: !pet.isActive });
  }

  async function onPhotoSelected(pet: PetProfile, file: File | null) {
    if (!file || !signedIn || pet.id.startsWith("local-")) {
      setMessage(
        signedIn
          ? "Save the pet to your account before uploading a photo."
          : "Sign in to upload pet photos.",
      );
      return;
    }
    setUploadingId(pet.id);
    setMessage(null);
    const form = new FormData();
    form.set("petId", pet.id);
    form.set("file", file);
    const res = await fetch("/api/pets/photo", { method: "POST", body: form });
    setUploadingId(null);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(err.error ?? "Photo upload failed.");
      setSaveState("error");
      return;
    }
    const json = (await res.json()) as { pet: PetProfile };
    setPets((prev) => {
      const next = prev.map((p) => (p.id === json.pet.id ? json.pet : p));
      localStorage.setItem(LOCAL_PETS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setSaveState("saved");
    setMessage("Photo saved.");
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

  const packLabel = formatActivePackLabel(pets);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-28">
      <h1 className="font-display text-4xl text-teal-deep">Account & pets</h1>
      <p className="mt-2 text-muted">
        {signedIn
          ? `Signed in as ${email}`
          : "Browsing as guest — Sugar & Munch live on this device until you sign in."}
      </p>
      <p className="mt-1 text-sm text-ink" id="active-pack">
        {packLabel}
      </p>
      {statusLabel ? (
        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">{statusLabel}</p>
      ) : null}

      <div id="pets" className="mt-6 space-y-4">
        {pets.map((pet, index) => (
          <div key={pet.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-xl text-ink">{pet.name}</p>
              <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={pet.isActive}
                  disabled={saveState === "loading"}
                  onChange={() => toggleActive(pet, index)}
                />
                In active pack
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Name
                <Input
                  className="mt-1"
                  value={pet.name}
                  disabled={saveState === "loading"}
                  onChange={(e) => updatePet(index, { name: e.target.value })}
                />
              </label>
              <label className="text-sm">
                Weight (kg)
                <Input
                  className="mt-1"
                  type="number"
                  step="0.1"
                  value={pet.weightKg ?? ""}
                  disabled={saveState === "loading"}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    updatePet(index, {
                      weightKg: Number.isFinite(n) ? n : null,
                    });
                  }}
                />
              </label>
              <label className="text-sm">
                Size
                <select
                  className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  value={pet.sizeClass}
                  disabled={saveState === "loading"}
                  onChange={(e) =>
                    updatePet(index, {
                      sizeClass: e.target.value as SizeClass,
                    })
                  }
                >
                  <option value="toy">Toy</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="giant">Giant</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <label className="text-sm">
                Breed
                <Input
                  className="mt-1"
                  value={pet.breed ?? ""}
                  disabled={saveState === "loading"}
                  onChange={(e) => updatePet(index, { breed: e.target.value })}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pet.travelsInCarrier}
                disabled={saveState === "loading"}
                onChange={(e) =>
                  updatePet(index, { travelsInCarrier: e.target.checked })
                }
              />
              Travels in a carrier
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pet.publicDisplayEnabled}
                disabled={saveState === "loading"}
                onChange={(e) =>
                  updatePet(index, { publicDisplayEnabled: e.target.checked })
                }
              />
              Show name & photo on public trip reports
            </label>
            <label className="mt-3 block text-sm">
              Notes
              <Input
                className="mt-1"
                value={pet.notes ?? ""}
                disabled={saveState === "loading"}
                onChange={(e) => updatePet(index, { notes: e.target.value })}
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-sm">
                <span className="sr-only">Pet photo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={
                    saveState === "loading" ||
                    uploadingId === pet.id ||
                    !signedIn ||
                    pet.id.startsWith("local-")
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    void onPhotoSelected(pet, file);
                    e.target.value = "";
                  }}
                />
              </label>
              {pet.photoPath ? (
                <span className="text-xs text-muted">Photo saved</span>
              ) : null}
              {uploadingId === pet.id ? (
                <span className="text-xs text-muted">Uploading…</span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void removePet(pet, index)}
                disabled={saveState === "loading" || saveState === "saving"}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Keep legacy #dogs anchor for older menu links */}
      <div id="dogs" className="sr-only" aria-hidden />

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          onClick={() => void saveChanges()}
          disabled={saveState === "loading" || saveState === "saving"}
        >
          Save changes
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void addPet()}
          disabled={saveState === "loading" || saveState === "saving"}
        >
          Add a pet
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
      {pets.length > 0 ? (
        <p className="mt-3 text-xs text-muted">
          Check “In active pack” on one or more pets, then save — that pack
          drives “Exploring with…” and compatibility.
        </p>
      ) : null}
      {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
