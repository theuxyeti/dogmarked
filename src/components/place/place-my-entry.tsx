import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PlaceMyEntryData = {
  status?: "want_to_go" | "been_there" | null;
  visibility?: "private" | "public" | "link" | null;
  note?: string | null;
  dogBadges?: string[];
};

type Props = {
  entry?: PlaceMyEntryData | null;
  saved?: boolean;
  className?: string;
  onEdit?: () => void;
};

function statusLabel(status?: string | null) {
  if (status === "been_there") return "Been there";
  if (status === "want_to_go") return "Want to go";
  return null;
}

function visibilityLabel(v?: string | null) {
  if (v === "public") return "Public";
  if (v === "link") return "Link only";
  if (v === "private") return "Private";
  return null;
}

export function PlaceMyEntry({ entry, saved, className, onEdit }: Props) {
  const status = statusLabel(entry?.status);
  const visibility = visibilityLabel(entry?.visibility);
  const badges = entry?.dogBadges ?? [];
  const hasContent = Boolean(status || entry?.note || badges.length > 0);

  return (
    <section className={cn("space-y-2", className)} aria-label="My entry">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">My entry</h3>
        {saved && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-sm font-semibold text-[var(--color-brand)]"
          >
            Edit
          </button>
        ) : null}
      </div>

      {!hasContent ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          {saved
            ? "Saved to your map — add a note when you’re ready."
            : "Not on your map yet. Save it to track Want / Been and a private note."}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {status ? (
              <Badge variant="secondary" className="rounded-lg">
                {status}
              </Badge>
            ) : null}
            {visibility ? (
              <Badge variant="outline" className="rounded-lg">
                {visibility}
              </Badge>
            ) : null}
          </div>
          {entry?.note ? (
            <p className="text-sm text-[var(--color-ink)]">{entry.note}</p>
          ) : null}
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <Badge key={b} variant="outline" className="rounded-lg text-xs">
                  {b.replaceAll("_", " ")}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
