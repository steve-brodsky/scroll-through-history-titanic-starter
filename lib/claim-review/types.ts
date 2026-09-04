export type ReviewStatus =
  | "pending"
  | "approved"
  | "needs_review"
  | "rejected";

export type ReviewStatusFilter = ReviewStatus | "all";

export type JsonRecord = Record<string, unknown>;

export type EpisodeOption = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
};

export type SourceFilterOption = {
  id: string;
  title: string;
};

export type TemporalInfo = {
  rawText: string | null;
  kind: string | null;
  relation: string | null;
  granularity: string | null;
  certainty: string | null;
  calendarSystem: string | null;
  calendarSystemStatus: string | null;
  clockSystem: string | null;
  clockSystemStatus: string | null;
  anchorText: string | null;
};

export type SourceInfo = {
  id: string;
  slug: string;
  title: string;
  sourceType: string | null;
  url: string | null;
  citation: string | null;
  segmentId: string;
  segmentKey: string;
  segmentTitle: string | null;
  segmentLocator: string | null;
  contentStatus: string | null;
};

export type EvidenceItem = {
  id: string;
  text: string;
  type: string;
  sequenceIndex: number | null;
  source: SourceInfo;
};

export type ClaimProvenance = {
  candidateId: string | null;
  extractionIndex: number | null;
  extractionVersion: string | null;
  extractionModel: string | null;
  sourceSegmentId: string | null;
  sourceSegmentKey: string | null;
  contentStatus: string | null;
};

export type ClaimReviewItem = {
  id: string;
  statement: string;
  claimType: string | null;
  locationText: string | null;
  confidence: number | null;
  knowledgeNotes: string | null;
  reviewStatus: ReviewStatus;
  reviewNotes: string | null;
  reviewedAt: string | null;
  temporal: TemporalInfo;
  rawEntityMentions: string[];
  evidence: EvidenceItem[];
  sources: SourceInfo[];
  provenance: ClaimProvenance;
};

export type StatusCounts = Record<ReviewStatusFilter, number>;

export type ClaimReviewFilters = {
  episodeSlug?: string;
  status: ReviewStatusFilter;
  search: string;
  claimType: string;
  sourceId: string;
  page: number;
};

export type ClaimReviewPageData = {
  episodes: EpisodeOption[];
  selectedEpisode: EpisodeOption;
  claims: ClaimReviewItem[];
  counts: StatusCounts;
  claimTypes: string[];
  sources: SourceFilterOption[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
