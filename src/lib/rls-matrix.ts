/**
 * Intended RLS permission matrix for Dogmarked Phase 1.
 * Pure functions documenting policy until live Supabase integration tests exist.
 */

export type ClientRole = "anon" | "authenticated" | "service_role";

export type SaveVisibility = "private" | "link" | "public";

export type StoragePermission = "allowed_permanent" | "link_only" | "unknown";

export type ModerationStatus = "draft" | "in_review" | "published" | "rejected";

/** Service role bypasses RLS; must only be used on the server. */
export function isServiceRoleServerOnly(role: ClientRole): boolean {
  return role === "service_role";
}

/** Anonymous clients cannot read another user's private saves (or any save row). */
export function canReadUserPlaceSave(args: {
  role: ClientRole;
  saveOwnerId: string;
  viewerId: string | null;
  visibility: SaveVisibility;
}): boolean {
  if (args.role === "service_role") return true;
  if (args.role === "anon") return false;
  // Owner CRUD only — even public/link visibility does not open private_notes via this table.
  return args.viewerId !== null && args.viewerId === args.saveOwnerId;
}

/** Clients (anon + authenticated) cannot write dog_policies; only service_role / SECURITY DEFINER. */
export function canWriteDogPolicies(role: ClientRole): boolean {
  return role === "service_role";
}

export function canSelectDogPolicies(role: ClientRole): boolean {
  return role === "anon" || role === "authenticated" || role === "service_role";
}

/**
 * Public listing projections must never include private_notes.
 * Returns the fields safe to expose for a given visibility context.
 */
export function publicListingFields<T extends { private_notes?: string | null }>(
  row: T,
): Omit<T, "private_notes"> {
  const { private_notes: _, ...rest } = row;
  void _;
  return rest;
}

export function listingExcludesPrivateNotes(payload: Record<string, unknown>): boolean {
  return !("private_notes" in payload);
}

export function canReadPlacePhoto(args: {
  role: ClientRole;
  storagePermission: StoragePermission;
  uploadedBy: string | null;
  viewerId: string | null;
  isModerator: boolean;
}): boolean {
  if (args.role === "service_role") return true;
  if (
    args.storagePermission === "allowed_permanent" ||
    args.storagePermission === "link_only"
  ) {
    return true;
  }
  if (args.isModerator) return true;
  return (
    args.role === "authenticated" &&
    args.viewerId !== null &&
    args.uploadedBy === args.viewerId
  );
}

export function canReadPolicyContribution(args: {
  role: ClientRole;
  moderationStatus: ModerationStatus;
  ownerId: string;
  viewerId: string | null;
  isModerator: boolean;
}): boolean {
  if (args.role === "service_role") return true;
  if (args.moderationStatus === "published") return true;
  if (args.isModerator) return true;
  return (
    args.role === "authenticated" &&
    args.viewerId !== null &&
    args.viewerId === args.ownerId
  );
}

export function canAccessAuditEvents(role: ClientRole): boolean {
  return role === "service_role";
}

export type MatrixCell = {
  resource: string;
  action: string;
  anon: boolean;
  authenticated: boolean;
  service_role: boolean;
  notes?: string;
};

/** Documented matrix rows for Phase 1 (asserted in tests). */
export const RLS_PERMISSION_MATRIX: MatrixCell[] = [
  {
    resource: "user_place_saves",
    action: "select_private",
    anon: false,
    authenticated: true, // own rows only — see canReadUserPlaceSave
    service_role: true,
    notes: "Anonymous cannot read private saves; owner CRUD only",
  },
  {
    resource: "dog_policies",
    action: "insert_update_delete",
    anon: false,
    authenticated: false,
    service_role: true,
    notes: "Writes only via service role or SECURITY DEFINER promote RPC",
  },
  {
    resource: "dog_policies",
    action: "select",
    anon: true,
    authenticated: true,
    service_role: true,
  },
  {
    resource: "public_listings",
    action: "include_private_notes",
    anon: false,
    authenticated: false,
    service_role: false,
    notes: "private_notes never appear in public listing projections",
  },
  {
    resource: "audit_events",
    action: "any",
    anon: false,
    authenticated: false,
    service_role: true,
    notes: "No client access",
  },
  {
    resource: "service_role",
    action: "use_in_browser",
    anon: false,
    authenticated: false,
    service_role: false,
    notes: "service_role key is server-only",
  },
];

export function matrixAllows(
  cell: MatrixCell,
  role: Exclude<ClientRole, "service_role"> | "service_role",
): boolean {
  return cell[role];
}
