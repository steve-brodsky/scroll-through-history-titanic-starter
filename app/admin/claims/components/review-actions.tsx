"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateClaimStatus,
  type ClaimActionState
} from "@/app/admin/claims/actions";
import type { ReviewStatus } from "@/lib/claim-review/types";

const initialState: ClaimActionState = { error: null, updatedAt: null };

const actions: Array<{
  status: ReviewStatus;
  label: string;
  className: string;
}> = [
  {
    status: "rejected",
    label: "Reject",
    className: "border-red-400/25 text-red-200 hover:border-red-300/50 hover:bg-red-400/10"
  },
  {
    status: "needs_review",
    label: "Needs review",
    className:
      "border-amber-300/25 text-amber-100 hover:border-amber-200/50 hover:bg-amber-300/10"
  },
  {
    status: "pending",
    label: "Return to pending",
    className:
      "border-stone-400/25 text-stone-300 hover:border-stone-300/50 hover:bg-white/5"
  },
  {
    status: "approved",
    label: "Approve",
    className:
      "border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:border-emerald-200/60 hover:bg-emerald-300/15"
  }
];

export function ReviewActions({
  claimId,
  currentStatus
}: {
  claimId: string;
  currentStatus: ReviewStatus;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateClaimStatus,
    initialState
  );

  useEffect(() => {
    if (state.updatedAt) router.refresh();
  }, [router, state.updatedAt]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions
          .filter((action) => action.status !== currentStatus)
          .map((action) => (
            <form action={formAction} key={action.status}>
              <input type="hidden" name="claimId" value={claimId} />
              <input type="hidden" name="status" value={action.status} />
              <button
                type="submit"
                disabled={pending}
                className={`rounded-sm border px-3 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${action.className}`}
              >
                {pending ? "Updating…" : action.label}
              </button>
            </form>
          ))}
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state.updatedAt && !state.error && (
        <p className="mt-3 text-xs text-emerald-300">Review status updated.</p>
      )}
    </div>
  );
}
