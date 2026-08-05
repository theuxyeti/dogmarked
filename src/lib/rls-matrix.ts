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

/** Contributors may insert own drafts / in_review only — never published. */
export function canInsertPolicyContribution(args: {
  role: ClientRole;
  ownerId: string;
  viewerId: string | null;
  moderationStatus: ModerationStatus;
}): boolean {
  if (args.role === "service_role") return true;
  if (args.role !== "authenticated" || args.viewerId == null) return false;
  if (args.ownerId !== args.viewerId) return false;
  return (
    args.moderationStatus === "draft" || args.moderationStatus === "in_review"
  );
}

/** Owners edit own drafts; moderators edit any; clients never write published via update. */
export function canUpdatePolicyContribution(args: {
  role: ClientRole;
  ownerId: string;
  viewerId: string | null;
  currentStatus: ModerationStatus;
  nextStatus: ModerationStatus;
  isModerator: boolean;
}): boolean {
  if (args.role === "service_role") return true;
  if (args.isModerator) return true;
  if (args.role !== "authenticated" || args.viewerId == null) return false;
  if (args.ownerId !== args.viewerId) return false;
  if (
    args.currentStatus !== "draft" &&
    args.currentStatus !== "in_review"
  ) {
    return false;
  }
  return (
    args.nextStatus === "draft" || args.nextStatus === "in_review"
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
  {
    resource: "policy_contributions",
    action: "insert_own_draft",
    anon: false,
    authenticated: true,
    service_role: true,
    notes: "Own drafts / in_review only; promote via RPC",
  },
  {
    resource: "dog_policy_versions",
    action: "insert_update_delete",
    anon: false,
    authenticated: false,
    service_role: true,
    notes: "Append-only via promote RPC",
  },
  {
    resource: "external_place_refs",
    action: "insert_update_delete",
    anon: false,
    authenticated: false,
    service_role: true,
    notes: "Server writes only; clients select",
  },
  {
    resource: "pet_policy_reports",
    action: "select_public",
    anon: true,
    authenticated: true,
    service_role: true,
    notes: "Public visibility readable; private owner-only",
  },
  {
    resource: "pet_policy_reports",
    action: "insert_update_delete_own",
    anon: false,
    authenticated: true,
    service_role: true,
    notes: "Owners CRUD own reports only",
  },
  {
    resource: "dog_profiles",
    action: "select_private",
    anon: false,
    authenticated: true,
    service_role: true,
    notes: "Owner CRUD; private by default",
  },
  {
    resource: "dog_profiles",
    action: "select_public_display",
    anon: true,
    authenticated: true,
    service_role: true,
    notes: "Only when public_display_enabled; prefer public_pet_identities()",
  },
  {
    resource: "place_links",
    action: "select_verified_active",
    anon: true,
    authenticated: true,
    service_role: true,
    notes: "Public read verified+active only; creators/mods see own/all",
  },
  {
    resource: "place_links",
    action: "insert_non_affiliate_official_booking",
    anon: false,
    authenticated: true,
    service_role: true,
    notes: "Contributors insert is_affiliate=false official/booking; affiliate path stays admin/service",
  },
];

/** Owners manage pets; private details stay private unless public_display_enabled. */
export function canSelectDogProfile(args: {
  role: ClientRole;
  ownerId: string;
  viewerId: string | null;
  publicDisplayEnabled: boolean;
}): boolean {
  if (args.role === "service_role") return true;
  if (args.viewerId !== null && args.viewerId === args.ownerId) return true;
  return args.publicDisplayEnabled;
}

/** Private pet policy reports never contribute to public confirmation summaries. */
export function canIncludeReportInPublicSummary(visibility: "private" | "public"): boolean {
  return visibility === "public";
}

export function canReadPetPolicyReport(args: {
  role: ClientRole;
  ownerId: string;
  viewerId: string | null;
  visibility: "private" | "public";
  isModerator?: boolean;
}): boolean {
  if (args.role === "service_role") return true;
  if (args.visibility === "public") return true;
  if (args.isModerator) return true;
  return (
    args.role === "authenticated" &&
    args.viewerId !== null &&
    args.viewerId === args.ownerId
  );
}

export function matrixAllows(
  cell: MatrixCell,
  role: Exclude<ClientRole, "service_role"> | "service_role",
): boolean {
  return cell[role];
}
