import type {
  ClaimReviewItem,
  ReviewStatus,
  TemporalInfo
} from "@/lib/claim-review/types";
import { ClaimEditForm } from "@/app/admin/claims/components/claim-edit-form";
import { ReviewActions } from "@/app/admin/claims/components/review-actions";

const statusPresentation: Record<
  ReviewStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "border-stone-500/30 bg-stone-400/5 text-stone-300"
  },
  approved: {
    label: "Approved",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
  },
  needs_review: {
    label: "Needs review",
    className: "border-amber-300/25 bg-amber-300/10 text-amber-100"
  },
  rejected: {
    label: "Rejected",
    className: "border-red-400/25 bg-red-400/10 text-red-200"
  }
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.19em] text-stone-600">
      {children}
    </div>
  );
}

function prettyValue(value: string | null) {
  return value?.replaceAll("_", " ") ?? "—";
}

function hasSpecificTime(temporal: TemporalInfo) {
  return Boolean(
    temporal.rawText ||
      temporal.anchorText ||
      (temporal.kind && temporal.kind !== "unknown") ||
      (temporal.relation && temporal.relation !== "none")
  );
}

function TemporalDetails({ temporal }: { temporal: TemporalInfo }) {
  if (!hasSpecificTime(temporal)) {
    return (
      <p className="mt-2 text-sm italic text-stone-500">
        No specific historical time extracted
      </p>
    );
  }

  const attributes = [
    ["Kind", temporal.kind],
    ["Relation", temporal.relation],
    ["Granularity", temporal.granularity],
    ["Certainty", temporal.certainty],
    ["Calendar", temporal.calendarSystem],
    ["Calendar status", temporal.calendarSystemStatus],
    ["Clock", temporal.clockSystem],
    ["Clock status", temporal.clockSystemStatus]
  ].filter(([, value]) => value && value !== "unknown" && value !== "none");

  return (
    <div className="mt-2">
      {temporal.rawText && (
        <p className="font-serif text-lg text-stone-200">“{temporal.rawText}”</p>
      )}
      {temporal.anchorText && (
        <p className="mt-2 text-sm text-stone-400">
          <span className="text-stone-600">Anchored to </span>
          {temporal.anchorText}
        </p>
      )}
      {attributes.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {attributes.map(([label, value]) => (
            <div key={label} className="flex gap-1.5 text-xs">
              <dt className="text-stone-600">{label}</dt>
              <dd className="capitalize text-stone-400">{prettyValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function ProvenanceDetails({ claim }: { claim: ClaimReviewItem }) {
  const details = [
    ["Candidate ID", claim.provenance.candidateId],
    ["Extraction index", claim.provenance.extractionIndex],
    ["Extractor", claim.provenance.extractionVersion],
    ["Model", claim.provenance.extractionModel],
    ["Source segment ID", claim.provenance.sourceSegmentId],
    ["Segment key", claim.provenance.sourceSegmentKey],
    ["Content status", claim.provenance.contentStatus]
  ].filter(([, value]) => value !== null && value !== undefined);

  return (
    <details className="group border-t border-white/10 pt-4">
      <summary className="cursor-pointer list-none text-xs text-stone-500 marker:hidden hover:text-stone-300">
        <span className="inline-flex items-center gap-2">
          <span className="transition group-open:rotate-90">›</span>
          Extraction provenance
        </span>
      </summary>
      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              {label}
            </dt>
            <dd className="mt-1 break-words font-mono text-xs text-stone-400">
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function ClaimReviewCard({
  claim,
  ordinal
}: {
  claim: ClaimReviewItem;
  ordinal: number;
}) {
  const status = statusPresentation[claim.reviewStatus];
  const confidence =
    claim.confidence === null ? null : Math.round(claim.confidence * 100);

  return (
    <article
      id={`claim-${claim.id}`}
      className="scroll-mt-52 border-b border-white/10 py-10 first:pt-7"
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(330px,.44fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[11px] text-stone-700">
              {String(ordinal).padStart(3, "0")}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.19em] text-[#c4a76a]">
              {claim.claimType ?? "Unclassified"}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${status.className}`}
            >
              {status.label}
            </span>
            {confidence !== null && (
              <span
                className="ml-auto text-xs tabular-nums text-stone-500"
                title="Extractor support/confidence, not historical truth probability"
              >
                <strong className="text-stone-300">{confidence}%</strong> extraction support
              </span>
            )}
          </div>

          <h2 className="mt-5 max-w-4xl font-serif text-[1.7rem] leading-[1.35] tracking-[-0.012em] text-[#eee9df] sm:text-[2rem]">
            {claim.statement}
          </h2>

          <div className="mt-8 grid gap-x-8 gap-y-7 md:grid-cols-2">
            <section>
              <Label>Historical time</Label>
              <TemporalDetails temporal={claim.temporal} />
            </section>
            <section>
              <Label>Location</Label>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                {claim.locationText ?? "No location extracted"}
              </p>
            </section>
            <section>
              <Label>Extracted entity mentions</Label>
              {claim.rawEntityMentions.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {claim.rawEntityMentions.map((entity) => (
                    <li
                      key={entity}
                      className="border-b border-[#c4a76a]/35 pb-0.5 text-sm text-stone-300"
                    >
                      {entity}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-stone-500">No named entities extracted</p>
              )}
            </section>
            <section>
              <Label>Knowledge notes</Label>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                {claim.knowledgeNotes ?? "No knowledge notes"}
              </p>
            </section>
          </div>

          {claim.reviewNotes && (
            <section className="mt-7 border-l-2 border-[#c4a76a]/45 pl-4">
              <Label>Editorial review notes</Label>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-300">
                {claim.reviewNotes}
              </p>
            </section>
          )}
        </div>

        <aside className="border-l border-white/10 pl-0 xl:pl-8">
          <section>
            <Label>Source record</Label>
            {claim.sources.length ? (
              <div className="mt-3 space-y-5">
                {claim.sources.map((source) => (
                  <div key={`${source.id}:${source.segmentId}`}>
                    <h3 className="font-serif text-lg leading-6 text-stone-200">
                      {source.title}
                    </h3>
                    <dl className="mt-3 space-y-2 text-xs">
                      {source.sourceType && (
                        <div className="flex gap-2">
                          <dt className="w-24 shrink-0 text-stone-600">Source type</dt>
                          <dd className="capitalize text-stone-400">
                            {prettyValue(source.sourceType)}
                          </dd>
                        </div>
                      )}
                      {source.segmentTitle && (
                        <div className="flex gap-2">
                          <dt className="w-24 shrink-0 text-stone-600">Segment</dt>
                          <dd className="text-stone-400">{source.segmentTitle}</dd>
                        </div>
                      )}
                      {source.segmentLocator && (
                        <div className="flex gap-2">
                          <dt className="w-24 shrink-0 text-stone-600">Locator</dt>
                          <dd className="text-stone-400">{source.segmentLocator}</dd>
                        </div>
                      )}
                      {source.contentStatus && (
                        <div className="flex gap-2">
                          <dt className="w-24 shrink-0 text-stone-600">Content</dt>
                          <dd className="text-stone-400">
                            {prettyValue(source.contentStatus)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex text-xs font-semibold text-[#d5bc86] underline decoration-[#c4a76a]/30 underline-offset-4 hover:text-[#ead7ae]"
                      >
                        View original source ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-500">
                No source provenance is linked to this claim.
              </p>
            )}
          </section>

          <section className="mt-7 border-t border-white/10 pt-5">
            <Label>Verbatim evidence</Label>
            {claim.evidence.length ? (
              <div className="mt-3 space-y-4">
                {claim.evidence.map((evidence, index) => (
                  <figure key={evidence.id}>
                    <figcaption className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.13em] text-stone-600">
                      <span>Evidence {index + 1}</span>
                      <span>{evidence.type}</span>
                    </figcaption>
                    <blockquote className="whitespace-pre-wrap border-l-2 border-[#c4a76a]/35 pl-4 font-serif text-[15px] leading-7 text-[#d9d3c8]">
                      {evidence.text}
                    </blockquote>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-500">
                No evidence rows are linked to this claim.
              </p>
            )}
          </section>
        </aside>
      </div>

      <div className="mt-8 grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <ProvenanceDetails claim={claim} />
        <ReviewActions
          claimId={claim.id}
          currentStatus={claim.reviewStatus}
        />
      </div>
      <ClaimEditForm claim={claim} />
    </article>
  );
}
