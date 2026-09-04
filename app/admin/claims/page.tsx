import Link from "next/link";
import { ClaimFilters } from "@/app/admin/claims/components/claim-filters";
import { ClaimReviewCard } from "@/app/admin/claims/components/claim-review-card";
import { getClaimReviewPage } from "@/lib/claim-review/data";
import type {
  ClaimReviewFilters,
  ReviewStatusFilter
} from "@/lib/claim-review/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): ReviewStatusFilter {
  if (
    value === "approved" ||
    value === "needs_review" ||
    value === "rejected" ||
    value === "all"
  ) {
    return value;
  }
  return "pending";
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function queryString(params: SearchParams) {
  const query = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params)) {
    const value = first(rawValue);
    if (value) query.set(key, value);
  }
  return query.toString();
}

function pageHref(params: SearchParams, page: number) {
  const next = new URLSearchParams(queryString(params));
  next.set("page", String(page));
  return `/admin/claims?${next}`;
}

function ErrorState({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : "The claims database is unavailable.";

  return (
    <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-300">
        Claims unavailable
      </p>
      <h1 className="mt-4 font-serif text-4xl text-stone-100">
        The editorial database could not be loaded.
      </h1>
      <p className="mt-5 max-w-2xl leading-7 text-stone-400">{message}</p>
      <p className="mt-4 text-sm text-stone-600">
        Confirm that SUPABASE_URL and SUPABASE_SECRET_KEY are available to the
        Next.js server. Secret values are never sent to this page.
      </p>
    </main>
  );
}

export default async function ClaimsAdminPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters: ClaimReviewFilters = {
    episodeSlug: first(params.episode),
    status: parseStatus(first(params.status)),
    search: first(params.q)?.trim() ?? "",
    claimType: first(params.type)?.trim() ?? "",
    sourceId: first(params.source)?.trim() ?? "",
    page: parsePage(first(params.page))
  };

  let data;
  try {
    data = await getClaimReviewPage(filters);
  } catch (error) {
    return <ErrorState error={error} />;
  }

  if (!data.selectedEpisode) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c4a76a]">
          Claim review
        </p>
        <h1 className="mt-4 font-serif text-4xl text-stone-100">No episodes found</h1>
        <p className="mt-4 leading-7 text-stone-400">
          Import an episode and its validated claims before beginning editorial review.
        </p>
      </main>
    );
  }

  return (
    <main>
      <header className="mx-auto max-w-[1500px] px-5 pb-8 pt-10 sm:px-8 sm:pt-14">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c4a76a]">
              Editorial workbench
            </p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-stone-100 sm:text-5xl">
              Claim review
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">
              Review canonical claims against their verbatim evidence and extraction
              provenance. Evidence and source records are read-only here.
            </p>
          </div>
          <div className="border-l border-white/10 pl-5 text-sm lg:max-w-md">
            <p className="text-stone-500">Selected episode</p>
            <p className="mt-1 font-serif text-xl text-stone-200">
              {data.selectedEpisode.title}
            </p>
            {data.selectedEpisode.subtitle && (
              <p className="mt-1 text-xs text-stone-600">
                {data.selectedEpisode.subtitle}
              </p>
            )}
          </div>
        </div>
      </header>

      <ClaimFilters
        episodes={data.episodes}
        selectedEpisode={data.selectedEpisode}
        counts={data.counts}
        filters={filters}
        claimTypes={data.claimTypes}
        sources={data.sources}
      />

      <section className="mx-auto max-w-[1500px] px-5 sm:px-8">
        <div className="flex items-center justify-between border-b border-white/10 py-5 text-xs text-stone-600">
          <span>
            {data.totalFiltered === 0
              ? "No matching claims"
              : `${data.totalFiltered} matching claim${data.totalFiltered === 1 ? "" : "s"}`}
          </span>
          {data.totalFiltered > 0 && (
            <span className="tabular-nums">
              Page {data.page} of {data.totalPages}
            </span>
          )}
        </div>

        {data.claims.length ? (
          data.claims.map((claim, index) => (
            <ClaimReviewCard
              key={claim.id}
              claim={claim}
              ordinal={(data.page - 1) * data.pageSize + index + 1}
            />
          ))
        ) : (
          <div className="py-24 text-center">
            <p className="font-serif text-3xl text-stone-300">
              {filters.status === "pending" && !filters.search
                ? "No pending claims"
                : "No claims found"}
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-600">
              Try another status, source, claim type, or search phrase for this episode.
            </p>
          </div>
        )}

        {data.totalPages > 1 && (
          <nav
            aria-label="Claim pages"
            className="flex items-center justify-between border-t border-white/10 py-8"
          >
            {data.page > 1 ? (
              <Link
                href={pageHref(params, data.page - 1)}
                className="text-sm text-[#d5bc86] hover:text-[#ead7ae]"
              >
                ← Previous page
              </Link>
            ) : (
              <span />
            )}
            {data.page < data.totalPages && (
              <Link
                href={pageHref(params, data.page + 1)}
                className="text-sm text-[#d5bc86] hover:text-[#ead7ae]"
              >
                Next page →
              </Link>
            )}
          </nav>
        )}
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs leading-5 text-stone-600 sm:px-8">
        Development-only administrative route. Add authenticated authorization before a
        public production launch.
      </footer>
    </main>
  );
}
