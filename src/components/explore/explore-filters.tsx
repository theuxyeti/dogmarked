"use client";

import { Input } from "@/components/ui/input";
import type { ExploreFilters, ExploreLayer, PlaceCategory } from "@/lib/url-state";
import type { DogStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: PlaceCategory; label: string }[] = [
  { value: "park", label: "Park" },
  { value: "beach", label: "Beach" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "hotel", label: "Hotel" },
  { value: "other", label: "Other" },
];

const STATUSES: { value: DogStatus; label: string }[] = [
  { value: "dogs_welcome", label: "Welcome" },
  { value: "dogs_ok_outdoors", label: "Outdoors" },
  { value: "dogs_ok_with_restrictions", label: "Restricted" },
  { value: "ask_first", label: "Ask first" },
  { value: "no_dogs", label: "No dogs" },
];

const LAYERS: { value: ExploreLayer; label: string }[] = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "needs_verification", label: "Needs check" },
  { value: "saved", label: "Saved" },
];

function toggleInList<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ExploreFiltersPanel({
  filters,
  onChange,
  compact = false,
}: {
  filters: ExploreFilters;
  onChange: (next: ExploreFilters) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <label className="block text-xs text-muted">
        Search
        <Input
          className="mt-1"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Name or city"
        />
      </label>

      <div>
        <p className="mb-1 text-xs text-muted">Layer</p>
        <div className="flex flex-wrap gap-1.5">
          {LAYERS.map((layer) => (
            <Chip
              key={layer.value}
              active={filters.layer === layer.value}
              label={layer.label}
              onClick={() => onChange({ ...filters, layer: layer.value })}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-muted">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat.value}
              active={filters.categories.includes(cat.value)}
              label={cat.label}
              onClick={() =>
                onChange({
                  ...filters,
                  categories: toggleInList(filters.categories, cat.value),
                })
              }
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-muted">Dog policy</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((status) => (
            <Chip
              key={status.value}
              active={filters.dogStatuses.includes(status.value)}
              label={status.label}
              onClick={() =>
                onChange({
                  ...filters,
                  dogStatuses: toggleInList(filters.dogStatuses, status.value),
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full px-2.5 text-xs transition",
        active ? "bg-teal text-primary-foreground" : "bg-foam text-ink hover:bg-sand/60",
      )}
    >
      {label}
    </button>
  );
}
