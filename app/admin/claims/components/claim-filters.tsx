import Link from "next/link";
import type {
  ClaimReviewFilters,
  EpisodeOption,
  ReviewStatusFilter,
  SourceFilterOption,
  StatusCounts
} from "@/lib/claim-review/types";

const statusLabels: Record<ReviewStatusFilter, string> = {
  pending: "Pending",
  approved: "Approved",
  needs_review: "Needs review",
  rejected: "Rejected",
  all: "All"
};

const statusOrder: ReviewStatusFilter[] = [
  "pending",
  "approved",
  "needs_review",
  "rejected",
  "all"
];

function statusHref(
  episodeSlug: string,
  status: ReviewStatusFilter,
  filters: ClaimReviewFilters
) {
  const params = new URLSearchParams({ episode: episodeSlug, status });
  if (filters.search) params.set("q", filters.search);
  if (filters.claimType) params.set("type", filters.claimType);
  if (filters.sourceId) params.set("source", filters.sourceId);
  return `/admin/claims?${params}`;
}

export function ClaimFilters({
  episodes,
  selectedEpisode,
  counts,
  filters,
  claimTypes,
  sources
}: {
  episodes: EpisodeOption[];
  selectedEpisode: EpisodeOption;
  counts: StatusCounts;
  filters: ClaimReviewFilters;
  claimTypes: string[];
  sources: SourceFilterOption[];
}) {
  return (
    <section className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0d10]/95 backdrop-blur-xl">
      <div className="mx-auto max-w-[1500px] px-5 py-5 sm:px-8">
        <form method="get" className="grid gap-3 lg:grid-cols-[minmax(210px,1.25fr)_minmax(220px,2fr)_minmax(140px,.8fr)_minmax(180px,1fr)_auto]">
          <label>
            <span className="sr-only">Episode</span>
            <select
              name="episode"
              defaultValue={selectedEpisode.slug}
              className="h-10 w-full rounded-sm border border-white/10 bg-[#11161b] px-3 text-sm text-stone-200 outline-none focus:border-[#c4a76a]/60"
            >
              {episodes.map((episode) => (
                <option key={episode.id} value={episode.slug}>
                  {episode.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Search claims</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Search claim statements…"
              className="h-10 w-full rounded-sm border border-white/10 bg-[#11161b] px-3 text-sm text-stone-200 outline-none placeholder:text-stone-600 focus:border-[#c4a76a]/60"
            />
          </label>
          <label>
            <span className="sr-only">Claim type</span>
            <select
              name="type"
              defaultValue={filters.claimType}
              className="h-10 w-full rounded-sm border border-white/10 bg-[#11161b] px-3 text-sm text-stone-200 outline-none focus:border-[#c4a76a]/60"
            >
              <option value="">All claim types</option>
              {claimTypes.map((claimType) => (
                <option key={claimType} value={claimType}>
                  {claimType}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Source</span>
            <select
              name="source"
              defaultValue={filters.sourceId}
              className="h-10 w-full rounded-sm border border-white/10 bg-[#11161b] px-3 text-sm text-stone-200 outline-none focus:border-[#c4a76a]/60"
            >
              <option value="">All sources</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="status" value={filters.status} />
          <button
            type="submit"
            className="h-10 rounded-sm bg-[#d3b777] px-5 text-xs font-bold text-[#15130f] transition hover:bg-[#ead39e]"
          >
            Apply
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2">
          {statusOrder.map((status) => {
            const active = filters.status === status;
            return (
              <Link
                key={status}
                href={statusHref(selectedEpisode.slug, status, filters)}
                className={`rounded-sm px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-stone-500 hover:bg-white/5 hover:text-stone-300"
                }`}
              >
                {statusLabels[status]} <span className="ml-1 tabular-nums">{counts[status]}</span>
              </Link>
            );
          })}
          {(filters.search || filters.claimType || filters.sourceId) && (
            <Link
              href={`/admin/claims?episode=${encodeURIComponent(selectedEpisode.slug)}&status=${filters.status}`}
              className="ml-2 text-xs text-[#c4a76a] underline decoration-[#c4a76a]/30 underline-offset-4 hover:text-[#ead7ae]"
            >
              Clear filters
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
