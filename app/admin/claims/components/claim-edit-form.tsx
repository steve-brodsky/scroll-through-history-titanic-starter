"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  editClaim,
  type ClaimActionState
} from "@/app/admin/claims/actions";
import type { ClaimReviewItem } from "@/lib/claim-review/types";

const initialState: ClaimActionState = { error: null, updatedAt: null };

function Field({
  label,
  name,
  defaultValue,
  wide = false
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-sm border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-stone-200 outline-none transition placeholder:text-stone-700 focus:border-[#c4a76a]/60"
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  rows = 3
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  rows?: number;
}) {
  return (
    <label className="md:col-span-2">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={rows}
        className="w-full resize-y rounded-sm border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-stone-200 outline-none transition focus:border-[#c4a76a]/60"
      />
    </label>
  );
}

export function ClaimEditForm({
  claim
}: {
  claim: ClaimReviewItem;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(editClaim, initialState);

  useEffect(() => {
    if (state.updatedAt) router.refresh();
  }, [router, state.updatedAt]);

  return (
    <details className="group mt-5 border-t border-white/10 pt-4">
      <summary className="cursor-pointer list-none text-xs font-semibold text-[#d5bc86] marker:hidden hover:text-[#ead7ae]">
        <span className="inline-flex items-center gap-2">
          <span className="transition group-open:rotate-45">＋</span>
          Edit canonical claim fields
        </span>
      </summary>
      <form action={formAction} className="mt-5 grid gap-4 md:grid-cols-2">
        <input type="hidden" name="claimId" value={claim.id} />

        <TextAreaField
          label="Statement"
          name="statement"
          defaultValue={claim.statement}
          rows={4}
        />
        <Field label="Claim type" name="claimType" defaultValue={claim.claimType} />
        <label>
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Extraction confidence (%)
          </span>
          <input
            name="confidence"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue={claim.confidence === null ? "" : claim.confidence * 100}
            className="w-full rounded-sm border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-stone-200 outline-none transition focus:border-[#c4a76a]/60"
          />
        </label>
        <Field
          label="Location"
          name="locationText"
          defaultValue={claim.locationText}
          wide
        />
        <TextAreaField
          label="Knowledge notes"
          name="knowledgeNotes"
          defaultValue={claim.knowledgeNotes}
        />
        <TextAreaField
          label="Editorial review notes"
          name="reviewNotes"
          defaultValue={claim.reviewNotes}
        />

        <div className="md:col-span-2 mt-2 border-t border-white/10 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-stone-500">
            Source-expressed historical time
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Edit the extracted wording only. This does not normalize it to a modern timestamp.
          </p>
        </div>
        <Field
          label="Raw temporal text"
          name="temporalRawText"
          defaultValue={claim.temporal.rawText}
          wide
        />
        <Field label="Kind" name="temporalKind" defaultValue={claim.temporal.kind} />
        <Field
          label="Relation"
          name="temporalRelation"
          defaultValue={claim.temporal.relation}
        />
        <Field
          label="Granularity"
          name="temporalGranularity"
          defaultValue={claim.temporal.granularity}
        />
        <Field
          label="Certainty"
          name="temporalCertainty"
          defaultValue={claim.temporal.certainty}
        />
        <Field
          label="Calendar system"
          name="calendarSystem"
          defaultValue={claim.temporal.calendarSystem}
        />
        <Field
          label="Calendar status"
          name="calendarSystemStatus"
          defaultValue={claim.temporal.calendarSystemStatus}
        />
        <Field
          label="Clock system"
          name="clockSystem"
          defaultValue={claim.temporal.clockSystem}
        />
        <Field
          label="Clock status"
          name="clockSystemStatus"
          defaultValue={claim.temporal.clockSystemStatus}
        />
        <Field
          label="Temporal anchor"
          name="temporalAnchorText"
          defaultValue={claim.temporal.anchorText}
          wide
        />

        <div className="md:col-span-2 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-sm bg-[#d3b777] px-4 py-2.5 text-xs font-bold text-[#15130f] transition hover:bg-[#ead39e] disabled:cursor-wait disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save edits"}
          </button>
          <span className="text-xs text-stone-600">
            Evidence, source identity, and extraction identifiers remain read-only.
          </span>
        </div>
        {state.error && (
          <p role="alert" className="md:col-span-2 text-sm text-red-300">
            {state.error}
          </p>
        )}
        {state.updatedAt && !state.error && (
          <p className="md:col-span-2 text-sm text-emerald-300">Claim edits saved.</p>
        )}
      </form>
    </details>
  );
}
