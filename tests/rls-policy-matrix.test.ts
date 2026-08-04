import { describe, expect, it } from "vitest";
import {
  canAccessAuditEvents,
  canInsertPolicyContribution,
  canReadPolicyContribution,
  canReadUserPlaceSave,
  canSelectDogPolicies,
  canUpdatePolicyContribution,
  canWriteDogPolicies,
  isServiceRoleServerOnly,
  listingExcludesPrivateNotes,
  matrixAllows,
  publicListingFields,
  RLS_PERMISSION_MATRIX,
} from "@/lib/rls-matrix";

describe("RLS permission matrix (Phase 1 intent)", () => {
  it("anonymous cannot read private saves", () => {
    expect(
      canReadUserPlaceSave({
        role: "anon",
        saveOwnerId: "user-1",
        viewerId: null,
        visibility: "private",
      }),
    ).toBe(false);

    const saveCell = RLS_PERMISSION_MATRIX.find(
      (c) => c.resource === "user_place_saves" && c.action === "select_private",
    );
    expect(saveCell).toBeDefined();
    expect(matrixAllows(saveCell!, "anon")).toBe(false);
  });

  it("authenticated owner can read own save; other users cannot", () => {
    expect(
      canReadUserPlaceSave({
        role: "authenticated",
        saveOwnerId: "user-1",
        viewerId: "user-1",
        visibility: "private",
      }),
    ).toBe(true);

    expect(
      canReadUserPlaceSave({
        role: "authenticated",
        saveOwnerId: "user-1",
        viewerId: "user-2",
        visibility: "public",
      }),
    ).toBe(false);
  });

  it("users cannot write dog_policies", () => {
    expect(canWriteDogPolicies("anon")).toBe(false);
    expect(canWriteDogPolicies("authenticated")).toBe(false);
    expect(canWriteDogPolicies("service_role")).toBe(true);
    expect(canSelectDogPolicies("anon")).toBe(true);
    expect(canSelectDogPolicies("authenticated")).toBe(true);

    const writeCell = RLS_PERMISSION_MATRIX.find(
      (c) => c.resource === "dog_policies" && c.action === "insert_update_delete",
    );
    expect(writeCell).toBeDefined();
    expect(matrixAllows(writeCell!, "anon")).toBe(false);
    expect(matrixAllows(writeCell!, "authenticated")).toBe(false);
    expect(matrixAllows(writeCell!, "service_role")).toBe(true);
  });

  it("public listings exclude private_notes", () => {
    const row = {
      place_id: "p1",
      status: "want_to_go" as const,
      visibility: "public" as const,
      private_notes: "secret vet tip",
    };
    const publicRow = publicListingFields(row);
    expect(publicRow).toEqual({
      place_id: "p1",
      status: "want_to_go",
      visibility: "public",
    });
    expect(listingExcludesPrivateNotes(publicRow as Record<string, unknown>)).toBe(
      true,
    );

    const notesCell = RLS_PERMISSION_MATRIX.find(
      (c) =>
        c.resource === "public_listings" && c.action === "include_private_notes",
    );
    expect(notesCell).toBeDefined();
    expect(matrixAllows(notesCell!, "anon")).toBe(false);
    expect(matrixAllows(notesCell!, "authenticated")).toBe(false);
  });

  it("service role is server-only flag", () => {
    expect(isServiceRoleServerOnly("service_role")).toBe(true);
    expect(isServiceRoleServerOnly("anon")).toBe(false);
    expect(isServiceRoleServerOnly("authenticated")).toBe(false);

    const browserCell = RLS_PERMISSION_MATRIX.find(
      (c) => c.resource === "service_role" && c.action === "use_in_browser",
    );
    expect(browserCell).toBeDefined();
    expect(matrixAllows(browserCell!, "service_role")).toBe(false);
  });

  it("audit_events have no client access", () => {
    expect(canAccessAuditEvents("anon")).toBe(false);
    expect(canAccessAuditEvents("authenticated")).toBe(false);
    expect(canAccessAuditEvents("service_role")).toBe(true);
  });

  it("authenticated contributors insert own drafts; anon cannot", () => {
    expect(
      canInsertPolicyContribution({
        role: "anon",
        ownerId: "u1",
        viewerId: null,
        moderationStatus: "draft",
      }),
    ).toBe(false);
    expect(
      canInsertPolicyContribution({
        role: "authenticated",
        ownerId: "u1",
        viewerId: "u1",
        moderationStatus: "draft",
      }),
    ).toBe(true);
    expect(
      canInsertPolicyContribution({
        role: "authenticated",
        ownerId: "u1",
        viewerId: "u1",
        moderationStatus: "published",
      }),
    ).toBe(false);
  });

  it("owners update drafts; cannot self-publish via client update", () => {
    expect(
      canUpdatePolicyContribution({
        role: "authenticated",
        ownerId: "u1",
        viewerId: "u1",
        currentStatus: "draft",
        nextStatus: "in_review",
        isModerator: false,
      }),
    ).toBe(true);
    expect(
      canUpdatePolicyContribution({
        role: "authenticated",
        ownerId: "u1",
        viewerId: "u1",
        currentStatus: "draft",
        nextStatus: "published",
        isModerator: false,
      }),
    ).toBe(false);
    expect(
      canUpdatePolicyContribution({
        role: "authenticated",
        ownerId: "u1",
        viewerId: "u1",
        currentStatus: "draft",
        nextStatus: "published",
        isModerator: true,
      }),
    ).toBe(true);
  });

  it("moderator can read drafts; other users cannot", () => {
    expect(
      canReadPolicyContribution({
        role: "authenticated",
        moderationStatus: "draft",
        ownerId: "u1",
        viewerId: "u2",
        isModerator: false,
      }),
    ).toBe(false);
    expect(
      canReadPolicyContribution({
        role: "authenticated",
        moderationStatus: "draft",
        ownerId: "u1",
        viewerId: "u2",
        isModerator: true,
      }),
    ).toBe(true);
  });
});
