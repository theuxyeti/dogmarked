"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  dogProfileToLocalPet,
  formatActivePackLabel,
  LOCAL_PETS_STORAGE_KEY,
} from "@/lib/pets";
import { DEFAULT_DOG_PROFILES } from "@/lib/places/fixtures";
import type { PetProfile } from "@/lib/types";
import { tryCreateBrowserClient } from "@/lib/supabase/client";

function readCachedPets(): PetProfile[] {
  try {
    const raw = localStorage.getItem(LOCAL_PETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PetProfile[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_DOG_PROFILES.map((d) => dogProfileToLocalPet(d));
}

export function UserAvatarMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    setPets(readCachedPets());

    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    async function syncUser() {
      const {
        data: { user },
      } = await supabase!.auth.getUser();
      if (cancelled) return;
      setEmail(user?.email ?? null);
      setAuthReady(true);

      if (!user) return;

      try {
        const res = await fetch("/api/pets");
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { pets?: PetProfile[] };
        if (json.pets) {
          setPets(json.pets);
          localStorage.setItem(LOCAL_PETS_STORAGE_KEY, JSON.stringify(json.pets));
        }
      } catch {
        /* keep cached pets */
      }
    }

    void syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      setAuthReady(true);
      if (session?.user) void syncUser();
      else setPets(readCachedPets());
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!authReady) {
    return (
      <div
        className="relative z-50 h-9 w-9 shrink-0 rounded-full bg-foam"
        aria-hidden
      />
    );
  }

  if (!email) {
    return (
      <div className="relative z-50 shrink-0">
        <Button asChild size="sm">
          <Link href="/login?next=/profile">Sign in</Link>
        </Button>
      </div>
    );
  }

  const initial = email.slice(0, 1).toUpperCase();
  const packLabel = formatActivePackLabel(pets);
  const activeNames = pets
    .filter((p) => p.isActive)
    .map((p) => p.name)
    .filter(Boolean);

  return (
    <div ref={rootRef} className="relative z-50 shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label="Account and pets menu"
        onClick={() => setOpen((v) => !v)}
        className="relative z-50 flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-teal text-sm font-medium text-primary-foreground ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
      >
        {initial}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-[60] mt-2 w-56 rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          <p className="truncate border-b border-border px-3 py-2 text-xs text-muted">
            {email}
          </p>
          {activeNames.length > 0 ? (
            <p className="border-b border-border px-3 py-2 text-xs text-ink">
              {packLabel}
            </p>
          ) : null}
          <Link
            href="/profile"
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-foam"
            onClick={() => setOpen(false)}
          >
            Account
          </Link>
          <Link
            href="/profile#pets"
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-foam"
            onClick={() => setOpen(false)}
          >
            My pets
          </Link>
          <Link
            href="/profile#active-pack"
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-foam"
            onClick={() => setOpen(false)}
          >
            Active pack
          </Link>
          <Link
            href="/profile#pets"
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-foam"
            onClick={() => setOpen(false)}
          >
            Add a pet
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-foam"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
