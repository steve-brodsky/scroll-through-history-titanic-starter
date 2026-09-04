"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReviewStatus } from "@/lib/claim-review/types";

export type ClaimActionState = { error: string | null; updatedAt: number | null };

const REVIEW_STATUSES = new Set<ReviewStatus>([
  "pending",
  "approved",
  "needs_review",
  "rejected"
]);

function value(formData: FormData, key: string) {
  const input = formData.get(key);
  return typeof input === "string" ? input : "";
}

function optionalValue(formData: FormData, key: string) {
  const input = value(formData, key).trim();
  return input || null;
}

function validClaimId(claimId: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    claimId
  );
}

export async function updateClaimStatus(
  _previousState: ClaimActionState,
  formData: FormData
): Promise<ClaimActionState> {
  const claimId = value(formData, "claimId");
  const status = value(formData, "status") as ReviewStatus;

  if (!validClaimId(claimId) || !REVIEW_STATUSES.has(status)) {
    return {
      error: "The review request was invalid. Refresh and try again.",
      updatedAt: null
    };
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("claims")
      .update({
        review_status: status,
        reviewed_at: status === "pending" ? null : new Date().toISOString()
      })
      .eq("id", claimId)
      .select("id")
      .single();

    if (error) {
      return { error: `Could not update the claim: ${error.message}`, updatedAt: null };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update the claim.",
      updatedAt: null
    };
  }

  revalidatePath("/admin/claims");
  return { error: null, updatedAt: Date.now() };
}

export async function editClaim(
  _previousState: ClaimActionState,
  formData: FormData
): Promise<ClaimActionState> {
  const claimId = value(formData, "claimId");
  const statement = value(formData, "statement").trim();
  const confidenceInput = value(formData, "confidence").trim();
  const confidencePercent = confidenceInput ? Number(confidenceInput) : null;

  if (!validClaimId(claimId) || !statement) {
    return {
      error: "A valid claim and statement are required.",
      updatedAt: null
    };
  }

  if (
    confidencePercent !== null &&
    (!Number.isFinite(confidencePercent) ||
      confidencePercent < 0 ||
      confidencePercent > 100)
  ) {
    return {
      error: "Extraction confidence must be between 0 and 100.",
      updatedAt: null
    };
  }

  const update = {
    statement,
    claim_type: optionalValue(formData, "claimType"),
    location_text: optionalValue(formData, "locationText"),
    confidence: confidencePercent === null ? null : confidencePercent / 100,
    knowledge_notes: optionalValue(formData, "knowledgeNotes"),
    review_notes: optionalValue(formData, "reviewNotes"),
    temporal_raw_text: optionalValue(formData, "temporalRawText"),
    temporal_kind: optionalValue(formData, "temporalKind"),
    temporal_relation: optionalValue(formData, "temporalRelation"),
    temporal_granularity: optionalValue(formData, "temporalGranularity"),
    temporal_certainty: optionalValue(formData, "temporalCertainty"),
    calendar_system: optionalValue(formData, "calendarSystem"),
    calendar_system_status: optionalValue(formData, "calendarSystemStatus"),
    clock_system: optionalValue(formData, "clockSystem"),
    clock_system_status: optionalValue(formData, "clockSystemStatus"),
    temporal_anchor_text: optionalValue(formData, "temporalAnchorText")
  };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("claims")
      .update(update)
      .eq("id", claimId)
      .select("id")
      .single();
    if (error) {
      return { error: `Could not save the claim: ${error.message}`, updatedAt: null };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save the claim.",
      updatedAt: null
    };
  }

  revalidatePath("/admin/claims");
  return { error: null, updatedAt: Date.now() };
}
