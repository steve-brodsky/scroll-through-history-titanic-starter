export type AccuracyType =
  | "documented"
  | "reconstructed"
  | "composite"
  | "context";

export type FeedPost = {
  id: string;
  feedTime: string;
  author: string;
  role: string;
  content: string;
  accuracyType: AccuracyType;
  sourceLabel?: string;
  sourceUrl?: string;
};
