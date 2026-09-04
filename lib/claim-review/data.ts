import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ClaimReviewFilters,
  ClaimReviewItem,
  ClaimReviewPageData,
  EpisodeOption,
  EvidenceItem,
  JsonRecord,
  ReviewStatus,
  SourceFilterOption,
  SourceInfo,
  StatusCounts
} from "@/lib/claim-review/types";

export const CLAIMS_PAGE_SIZE = 25;

type Relation<T> = T | T[] | null;

type RawEpisode = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
};

type RawClaim = {
  id: string;
  statement: string;
  claim_type: string | null;
  location_text: string | null;
  confidence: number | string | null;
  knowledge_notes: string | null;
  temporal_raw_text: string | null;
  temporal_kind: string | null;
  temporal_relation: string | null;
  temporal_granularity: string | null;
  temporal_certainty: string | null;
  calendar_system: string | null;
  calendar_system_status: string | null;
  clock_system: string | null;
  clock_system_status: string | null;
  temporal_anchor_text: string | null;
  review_status: ReviewStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  extraction_key: string | null;
  extraction_version: string | null;
  extraction_model: string | null;
  generation_meta: JsonRecord | null;
};

type RawClaimLink = {
  claims: Relation<RawClaim>;
};

type RawSource = {
  id: string;
  slug: string;
  title: string;
  source_type: string | null;
  url: string | null;
  citation: string | null;
};

type RawSegment = {
  id: string;
  segment_key: string;
  title: string | null;
  locator: string | null;
  metadata: JsonRecord | null;
  sources: Relation<RawSource>;
};

type RawEvidence = {
  id: string;
  claim_id: string;
  evidence_text: string;
  evidence_type: string;
  sequence_index: number | null;
  source_segments: Relation<RawSegment>;
};

type RawEpisodeSource = {
  source_id: string;
  sources: Relation<Pick<RawSource, "id" | "title">>;
};

type RawClaimTypeLink = {
  claims: Relation<{ claim_type: string | null }>;
};

function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function requireSuccess(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function contentStatus(metadata: JsonRecord | null): string | null {
  return asOptionalString(metadata?.content_status);
}

function mapSource(segment: RawSegment): SourceInfo | null {
  const source = one(segment.sources);
  if (!source) return null;

  return {
    id: source.id,
    slug: source.slug,
    title: source.title,
    sourceType: source.source_type,
    url: source.url,
    citation: source.citation,
    segmentId: segment.id,
    segmentKey: segment.segment_key,
    segmentTitle: segment.title,
    segmentLocator: segment.locator,
    contentStatus: contentStatus(segment.metadata)
  };
}

function sourceKey(source: SourceInfo) {
  return `${source.id}:${source.segmentId}`;
}

function mapClaim(
  claim: RawClaim,
  evidenceByClaim: Map<string, EvidenceItem[]>
): ClaimReviewItem {
  const generationMeta = claim.generation_meta ?? {};
  const rawEntities = Array.isArray(generationMeta.raw_named_entities)
    ? generationMeta.raw_named_entities.filter(
        (value): value is string => typeof value === "string" && Boolean(value.trim())
      )
    : [];
  const evidence = evidenceByClaim.get(claim.id) ?? [];
  const sources = Array.from(
    new Map(evidence.map((item) => [sourceKey(item.source), item.source])).values()
  );

  return {
    id: claim.id,
    statement: claim.statement,
    claimType: claim.claim_type,
    locationText: claim.location_text,
    confidence:
      claim.confidence === null ? null : Number.parseFloat(String(claim.confidence)),
    knowledgeNotes: claim.knowledge_notes,
    reviewStatus: claim.review_status,
    reviewNotes: claim.review_notes,
    reviewedAt: claim.reviewed_at,
    temporal: {
      rawText: claim.temporal_raw_text,
      kind: claim.temporal_kind,
      relation: claim.temporal_relation,
      granularity: claim.temporal_granularity,
      certainty: claim.temporal_certainty,
      calendarSystem: claim.calendar_system,
      calendarSystemStatus: claim.calendar_system_status,
      clockSystem: claim.clock_system,
      clockSystemStatus: claim.clock_system_status,
      anchorText: claim.temporal_anchor_text
    },
    rawEntityMentions: rawEntities,
    evidence,
    sources,
    provenance: {
      candidateId:
        asOptionalString(generationMeta.candidate_id) ?? claim.extraction_key,
      extractionIndex: asOptionalNumber(generationMeta.extraction_index),
      extractionVersion: claim.extraction_version,
      extractionModel: claim.extraction_model,
      sourceSegmentId: asOptionalString(generationMeta.source_segment_id),
      sourceSegmentKey: asOptionalString(generationMeta.source_segment_key),
      contentStatus: asOptionalString(generationMeta.content_status)
    }
  };
}

async function countClaims(episodeId: string, status?: ReviewStatus) {
  const supabase = createAdminClient();
  let query = supabase
    .from("episode_claims")
    .select("claims!inner(id)", { count: "exact", head: true })
    .eq("episode_id", episodeId);

  if (status) query = query.eq("claims.review_status", status);

  const { count, error } = await query;
  requireSuccess(error, `Could not count ${status ?? "all"} claims`);
  return count ?? 0;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function getClaimReviewPage(
  filters: ClaimReviewFilters
): Promise<ClaimReviewPageData | { episodes: []; selectedEpisode: null }> {
  const supabase = createAdminClient();
  const episodesResult = await supabase
    .from("episodes")
    .select("id,slug,title,subtitle")
    .order("title", { ascending: true });
  requireSuccess(episodesResult.error, "Could not load episodes");

  const episodes = (episodesResult.data ?? []) as unknown as EpisodeOption[];
  if (!episodes.length) return { episodes: [], selectedEpisode: null };

  const selectedEpisode =
    episodes.find((episode) => episode.slug === filters.episodeSlug) ?? episodes[0];

  const sourceMatchPromise = filters.sourceId
    ? supabase
        .from("claim_evidence")
        .select("claim_id,source_segments!inner(source_id)")
        .eq("source_segments.source_id", filters.sourceId)
    : Promise.resolve({ data: null, error: null });

  const [
    allCount,
    pendingCount,
    approvedCount,
    needsReviewCount,
    rejectedCount,
    sourceOptionsResult,
    claimTypesResult,
    sourceMatchesResult
  ] = await Promise.all([
    countClaims(selectedEpisode.id),
    countClaims(selectedEpisode.id, "pending"),
    countClaims(selectedEpisode.id, "approved"),
    countClaims(selectedEpisode.id, "needs_review"),
    countClaims(selectedEpisode.id, "rejected"),
    supabase
      .from("episode_sources")
      .select("source_id,sources(id,title)")
      .eq("episode_id", selectedEpisode.id),
    supabase
      .from("episode_claims")
      .select("claims!inner(claim_type)")
      .eq("episode_id", selectedEpisode.id)
      .limit(1000),
    sourceMatchPromise
  ]);

  requireSuccess(sourceOptionsResult.error, "Could not load source filters");
  requireSuccess(claimTypesResult.error, "Could not load claim type filters");
  requireSuccess(sourceMatchesResult.error, "Could not filter claims by source");

  const sources = ((sourceOptionsResult.data ?? []) as unknown as RawEpisodeSource[])
    .map((row): SourceFilterOption | null => {
      const source = one(row.sources);
      return source ? { id: source.id, title: source.title } : null;
    })
    .filter((source): source is SourceFilterOption => source !== null)
    .sort((a, b) => a.title.localeCompare(b.title));

  const claimTypes = Array.from(
    new Set(
      ((claimTypesResult.data ?? []) as unknown as RawClaimTypeLink[])
        .map((row) => one(row.claims)?.claim_type)
        .filter((value): value is string => Boolean(value))
    )
  ).sort();

  const sourceClaimIds = filters.sourceId
    ? Array.from(
        new Set(
          ((sourceMatchesResult.data ?? []) as unknown as Array<{ claim_id: string }>).map(
            (row) => row.claim_id
          )
        )
      )
    : null;

  const counts: StatusCounts = {
    all: allCount,
    pending: pendingCount,
    approved: approvedCount,
    needs_review: needsReviewCount,
    rejected: rejectedCount
  };

  if (sourceClaimIds?.length === 0) {
    return {
      episodes,
      selectedEpisode,
      claims: [],
      counts,
      claimTypes,
      sources,
      totalFiltered: 0,
      page: 1,
      pageSize: CLAIMS_PAGE_SIZE,
      totalPages: 1
    };
  }

  const requestedPage = Math.max(1, Math.floor(filters.page));
  const from = (requestedPage - 1) * CLAIMS_PAGE_SIZE;
  const to = from + CLAIMS_PAGE_SIZE - 1;

  let claimsQuery = supabase
    .from("episode_claims")
    .select(
      `
        claims!inner(
          id,statement,claim_type,location_text,confidence,knowledge_notes,
          temporal_raw_text,temporal_kind,temporal_relation,temporal_granularity,
          temporal_certainty,calendar_system,calendar_system_status,clock_system,
          clock_system_status,temporal_anchor_text,review_status,review_notes,
          reviewed_at,extraction_key,extraction_version,extraction_model,generation_meta
        )
      `,
      { count: "exact" }
    )
    .eq("episode_id", selectedEpisode.id)
    .order("created_at", { ascending: true })
    .range(from, to);

  if (filters.status !== "all") {
    claimsQuery = claimsQuery.eq("claims.review_status", filters.status);
  }
  if (filters.search) {
    claimsQuery = claimsQuery.ilike(
      "claims.statement",
      `%${escapeLike(filters.search)}%`
    );
  }
  if (filters.claimType) {
    claimsQuery = claimsQuery.eq("claims.claim_type", filters.claimType);
  }
  if (sourceClaimIds) {
    claimsQuery = claimsQuery.in("claims.id", sourceClaimIds);
  }

  const claimsResult = await claimsQuery;
  requireSuccess(claimsResult.error, "Could not load claims");

  const rawClaims = ((claimsResult.data ?? []) as unknown as RawClaimLink[])
    .map((row) => one(row.claims))
    .filter((claim): claim is RawClaim => claim !== null);
  const claimIds = rawClaims.map((claim) => claim.id);
  const evidenceByClaim = new Map<string, EvidenceItem[]>();

  if (claimIds.length) {
    const evidenceResult = await supabase
      .from("claim_evidence")
      .select(
        `
          id,claim_id,evidence_text,evidence_type,sequence_index,
          source_segments!inner(
            id,segment_key,title,locator,metadata,
            sources!inner(id,slug,title,source_type,url,citation)
          )
        `
      )
      .in("claim_id", claimIds)
      .order("sequence_index", { ascending: true });
    requireSuccess(evidenceResult.error, "Could not load claim evidence");

    for (const row of (evidenceResult.data ?? []) as unknown as RawEvidence[]) {
      const segment = one(row.source_segments);
      const source = segment ? mapSource(segment) : null;
      if (!source) continue;

      const evidence: EvidenceItem = {
        id: row.id,
        text: row.evidence_text,
        type: row.evidence_type,
        sequenceIndex: row.sequence_index,
        source
      };
      evidenceByClaim.set(row.claim_id, [
        ...(evidenceByClaim.get(row.claim_id) ?? []),
        evidence
      ]);
    }
  }

  const totalFiltered = claimsResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / CLAIMS_PAGE_SIZE));

  return {
    episodes,
    selectedEpisode,
    claims: rawClaims.map((claim) => mapClaim(claim, evidenceByClaim)),
    counts,
    claimTypes,
    sources,
    totalFiltered,
    page: Math.min(requestedPage, totalPages),
    pageSize: CLAIMS_PAGE_SIZE,
    totalPages
  };
}
