"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function FollowButton({
  targetType,
  targetId,
}: {
  targetType: "user" | "collection";
  targetId: string;
}) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/follows")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          follows?: Array<{ targetType: string; targetId: string }>;
        };
        setFollowing(
          Boolean(
            data.follows?.some(
              (f) => f.targetType === targetType && f.targetId === targetId,
            ),
          ),
        );
      })
      .catch(() => undefined);
  }, [targetType, targetId]);

  async function toggle() {
    setBusy(true);
    setMessage(null);
    try {
      if (following) {
        const res = await fetch(
          `/api/follows?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`,
          { method: "DELETE" },
        );
        const data = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) {
          setMessage(data.error ?? "Could not unfollow.");
          return;
        }
        setFollowing(false);
        setMessage(data.message ?? "Unfollowed.");
      } else {
        const res = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId }),
        });
        const data = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) {
          setMessage(
            data.error ??
              (res.status === 401 ? "Sign in to follow." : "Could not follow."),
          );
          return;
        }
        setFollowing(true);
        setMessage(data.message ?? "Following.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant={following ? "outline" : "default"} disabled={busy} onClick={() => void toggle()}>
        {busy ? "…" : following ? "Following" : "Follow"}
      </Button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </div>
  );
}
