"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { tryCreateBrowserClient } from "@/lib/supabase/client";

export function UserAvatarMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!email) {
    return (
      <Button asChild size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  const initial = email.slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-teal text-sm font-medium text-primary-foreground"
      >
        {initial}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          <p className="truncate border-b border-border px-3 py-2 text-xs text-muted">
            {email}
          </p>
          <Link
            href="/profile"
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-foam"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            href="/profile#dogs"
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-foam"
            onClick={() => setOpen(false)}
          >
            Dog profiles
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
