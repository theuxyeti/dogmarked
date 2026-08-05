"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AvatarStack } from "@/components/ui/avatar-stack";
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
import { cn } from "@/lib/utils";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [weightUnit, setWeightUnit] = useState<"lb" | "kg">("lb");

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
  const activePets = pets.filter((p) => p.isActive);

  function weightDisplay(pet: PetProfile): string {
    if (pet.weightKg == null || !Number.isFinite(pet.weightKg)) return "Weight unknown";
    if (weightUnit === "lb") {
      const lb = pet.weightLb ?? pet.weightKg * 2.2046226218;
      return `${lb.toFixed(lb >= 10 ? 0 : 1)} lb`;
    }
    return `${pet.weightKg.toFixed(1)} kg`;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-28">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
        Your travel pack
      </p>
      <h1 className="font-display text-4xl text-[var(--color-brand)]">
        Choose who&apos;s exploring
      </h1>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]" id="active-pack">
        {packLabel}
        {signedIn ? ` · ${email}` : " · Guest on this device"}
      </p>
      {statusLabel ? (
        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
          {statusLabel}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-[var(--color-ink-muted)]">Show weights in</span>
        <div className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5">
          {(["lb", "kg"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setWeightUnit(u)}
              className={cn(
                "min-h-9 rounded-md px-3 text-xs font-semibold",
                weightUnit === u
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-ink-muted)]",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {activePets.length > 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <AvatarStack
            items={activePets.map((p) => ({
              id: p.id,
              src: p.photoPath,
              alt: p.name,
              fallback: p.name.slice(0, 1).toUpperCase(),
            }))}
            size="lg"
            label={packLabel}
          />
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">{packLabel}</p>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Active on the map and place cards
            </p>
          </div>
        </div>
      ) : null}

      <div id="pets" className="mt-6 space-y-3">
        {pets.map((pet, index) => {
          const editing = editingId === pet.id;
          return (
            <article
              key={pet.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--elevation-1)]"
            >
              <div className="flex gap-4">
                <label className="relative shrink-0 cursor-pointer">
                  <span className="sr-only">
                    {pet.photoPath ? "Change photo" : "Add photo"}
                  </span>
                  <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[var(--color-brand-soft)] text-2xl font-semibold text-[var(--color-brand)]">
                    {pet.photoPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pet.photoPath}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      pet.name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
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
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-action)] px-2 py-0.5 text-[10px] font-semibold text-white">
                    {uploadingId === pet.id
                      ? "…"
                      : pet.photoPath
                        ? "Edit"
                        : "Add"}
                  </span>
                </label>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-2xl text-[var(--color-ink)]">
                        {pet.name}
                      </h2>
                      <p className="text-sm text-[var(--color-ink-muted)]">
                        {pet.sizeClass !== "unknown" ? pet.sizeClass : "Size unknown"}
                        {" · "}
                        {weightDisplay(pet)}
                        {pet.travelsInCarrier ? " · Carrier" : ""}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-[var(--color-ink)]">
                      <input
                        type="checkbox"
                        checked={pet.isActive}
                        disabled={saveState === "loading"}
                        onChange={() => toggleActive(pet, index)}
                        className="h-4 w-4 accent-[var(--color-brand)]"
                      />
                      Active
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={editing ? "default" : "outline"}
                      onClick={() =>
                        setEditingId(editing ? null : pet.id)
                      }
                    >
                      {editing ? "Done" : "Edit"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void removePet(pet, index)}
                      disabled={saveState === "loading" || saveState === "saving"}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>

              {editing ? (
                <div className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Name
                    <Input
                      className="mt-1"
                      value={pet.name}
                      onChange={(e) => updatePet(index, { name: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    Weight ({weightUnit})
                    <Input
                      className="mt-1"
                      type="number"
                      step="0.1"
                      value={
                        weightUnit === "lb"
                          ? (pet.weightLb ??
                            (pet.weightKg != null
                              ? Number((pet.weightKg * 2.2046226218).toFixed(1))
                              : ""))
                          : (pet.weightKg ?? "")
                      }
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) {
                          updatePet(index, { weightKg: null, weightLb: null });
                          return;
                        }
                        if (weightUnit === "lb") {
                          updatePet(index, {
                            weightLb: n,
                            weightKg: n / 2.2046226218,
                          });
                        } else {
                          updatePet(index, {
                            weightKg: n,
                            weightLb: n * 2.2046226218,
                          });
                        }
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    Size
                    <select
                      className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm"
                      value={pet.sizeClass}
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
                      onChange={(e) => updatePet(index, { breed: e.target.value })}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={pet.travelsInCarrier}
                      onChange={(e) =>
                        updatePet(index, { travelsInCarrier: e.target.checked })
                      }
                    />
                    Travels in a carrier
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={pet.publicDisplayEnabled}
                      onChange={(e) =>
                        updatePet(index, {
                          publicDisplayEnabled: e.target.checked,
                        })
                      }
                    />
                    Show on public trip reports
                  </label>
                </div>
              ) : null}
            </article>
          );
        })}

        <button
          type="button"
          onClick={() => void addPet()}
          disabled={saveState === "loading" || saveState === "saving"}
          className="flex min-h-24 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] text-sm font-semibold text-[var(--color-brand)]"
        >
          Add another pet
        </button>
      </div>

      <div id="dogs" className="sr-only" aria-hidden />

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="action"
          onClick={() => void saveChanges()}
          disabled={saveState === "loading" || saveState === "saving"}
        >
          Save pack
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
      {message ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
