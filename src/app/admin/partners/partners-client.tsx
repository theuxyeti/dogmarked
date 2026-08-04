"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ReportRow = {
  day: string;
  network: string;
  placeId: string;
  placeName: string;
  placeSlug: string;
  clicks: number;
};

type ReportPayload = {
  days: number;
  totalClicks: number;
  networks: Array<{ network: string; clicks: number }>;
  rows: ReportRow[];
  error?: string;
};

const DAY_OPTIONS = [7, 30, 90] as const;

export function PartnersClient() {
  const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>(30);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(nextDays: number) {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/admin/affiliate-report?days=${nextDays}`);
        const json = (await res.json()) as ReportPayload;
        if (!res.ok) {
          setError(json.error ?? "Could not load partner report.");
          setData(null);
          return;
        }
        setData(json);
      } catch {
        setError("Network error loading partner report.");
        setData(null);
      }
    });
  }

  useEffect(() => {
    load(days);
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {DAY_OPTIONS.map((d) => (
          <Button
            key={d}
            type="button"
            variant={days === d ? "default" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => setDays(d)}
          >
            Last {d}d
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => load(days)}
        >
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl border border-border/60 bg-sand/40 px-4 py-3 text-sm text-ink">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-sand/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Total clicks
              </p>
              <p className="mt-1 font-display text-2xl text-ink">{data.totalClicks}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-sand/30 px-4 py-3 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                By network
              </p>
              {data.networks.length === 0 ? (
                <p className="mt-1 text-sm text-muted">No clicks in this window.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {data.networks.map((n) => (
                    <li key={n.network} className="flex justify-between gap-4">
                      <span>{n.network}</span>
                      <span className="tabular-nums text-muted">{n.clicks}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-border/60 bg-sand/40 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Day (UTC)</th>
                  <th className="px-3 py-2 font-semibold">Network</th>
                  <th className="px-3 py-2 font-semibold">Place</th>
                  <th className="px-3 py-2 text-right font-semibold">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-muted">
                      No affiliate clicks yet. Booking CTAs hop through{" "}
                      <code className="text-xs">/api/affiliates/click</code> once
                      migration 008 is applied and an active link exists.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row) => (
                    <tr
                      key={`${row.day}-${row.network}-${row.placeId}`}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="px-3 py-2 tabular-nums text-muted">{row.day}</td>
                      <td className="px-3 py-2">{row.network}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/place/${row.placeSlug}`}
                          className="text-teal-deep underline-offset-2 hover:underline"
                        >
                          {row.placeName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.clicks}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : pending ? (
        <p className="text-sm text-muted">Loading partner report…</p>
      ) : null}
    </div>
  );
}
