import { z } from "zod";

export const petPolicyOverallStatusSchema = z.enum([
  "confirmed",
  "restricted",
  "ask_first",
  "unknown",
  "not_allowed",
]);

export const petPolicyEvidenceTypeSchema = z.enum([
  "firsthand_visit",
  "official_policy",
  "direct_confirmation",
  "provider_listing",
  "other",
]);

export const petSizeBucketSchema = z.enum(["small", "medium", "large"]);

export const petPolicyAreasSchema = z
  .object({
    guestRooms: z.boolean().optional(),
    indoorPublicAreas: z.boolean().optional(),
    indoorDining: z.boolean().optional(),
    outdoorDining: z.boolean().optional(),
    grounds: z.boolean().optional(),
    beach: z.boolean().optional(),
    poolArea: z.boolean().optional(),
    transitCabin: z.boolean().optional(),
  })
  .strict()
  .optional()
  .default({});

export const petPolicyRulesSchema = z
  .object({
    leashRequired: z.boolean().optional(),
    carrierRequired: z.boolean().optional(),
    priorApprovalRequired: z.boolean().optional(),
    breedRestrictions: z.boolean().optional(),
    mayBeLeftUnattended: z.boolean().optional(),
  })
  .strict()
  .optional()
  .default({});

export const petPolicyFeeSchema = z
  .object({
    amount: z.number().nonnegative().optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    basis: z.enum(["per_pet", "per_night", "per_stay", "deposit"]).optional(),
    refundable: z.boolean().optional(),
  })
  .strict()
  .optional()
  .nullable();

export const createPetPolicyReportSchema = z.object({
  placeId: z.string().uuid(),
  petIds: z.array(z.string().uuid()).max(20).optional().default([]),
  visitedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "visitedOn must be YYYY-MM-DD")
    .optional()
    .nullable(),
  visibility: z.enum(["private", "public"]).default("private"),
  overallStatus: petPolicyOverallStatusSchema.default("unknown"),
  allowedSizes: z.array(petSizeBucketSchema).max(3).optional().default([]),
  weightLimitLb: z.number().positive().max(500).optional().nullable(),
  maxDogs: z.number().int().positive().max(50).optional().nullable(),
  areas: petPolicyAreasSchema,
  rules: petPolicyRulesSchema,
  fee: petPolicyFeeSchema,
  note: z.string().trim().max(4000).optional().nullable(),
  evidenceType: petPolicyEvidenceTypeSchema.default("firsthand_visit"),
  evidenceUrl: z.string().url().optional().nullable(),
});

export const updatePetPolicyReportSchema = createPetPolicyReportSchema
  .omit({ placeId: true })
  .partial()
  .extend({
    visibility: z.enum(["private", "public"]).optional(),
    overallStatus: petPolicyOverallStatusSchema.optional(),
    evidenceType: petPolicyEvidenceTypeSchema.optional(),
  });
