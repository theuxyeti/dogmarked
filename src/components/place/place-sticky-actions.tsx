import { BookmarkPlus, ExternalLink, Navigation, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  saved?: boolean;
  busy?: boolean;
  directionsUrl: string;
  website?: string | null;
  bookingHref?: string | null;
  /** Slot for concurrent place-links / Booking CTA. */
  linksSlot?: React.ReactNode;
  onSave: () => void;
  onAddTripReport?: () => void;
  canAddTripReport?: boolean;
  className?: string;
};

/**
 * Sticky action priority: Save → Add trip report → Directions → Website/Booking.
 */
export function PlaceStickyActions({
  saved,
  busy,
  directionsUrl,
  website,
  bookingHref,
  linksSlot,
  onSave,
  onAddTripReport,
  canAddTripReport,
  className,
}: Props) {
  const secondaryHref = bookingHref || website || null;
  const secondaryLabel = bookingHref ? "View on Booking.com" : "Official website";
  const showTrip = Boolean(canAddTripReport && onAddTripReport);

  return (
    <div
      className={cn(
        "shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 pt-3 backdrop-blur-sm",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="action"
          className="w-full"
          disabled={busy}
          onClick={onSave}
        >
          <BookmarkPlus className="h-4 w-4" />
          {saved ? "Update save" : "Save to my map"}
        </Button>

        <div className={cn("grid gap-2", showTrip ? "grid-cols-2" : "grid-cols-1")}>
          {showTrip ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={onAddTripReport}
            >
              <NotebookPen className="h-4 w-4" />
              Trip report
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="w-full" asChild>
            <a href={directionsUrl} target="_blank" rel="noreferrer">
              <Navigation className="h-4 w-4" />
              Directions
            </a>
          </Button>
        </div>

        {secondaryHref ? (
          <Button type="button" variant="ghost" size="sm" className="w-full" asChild>
            <a href={secondaryHref} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              {secondaryLabel}
            </a>
          </Button>
        ) : null}

        {linksSlot}
      </div>
    </div>
  );
}
