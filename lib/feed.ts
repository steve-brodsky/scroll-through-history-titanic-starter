import { titanicDemoPosts } from "@/lib/demo-data";
import type { FeedPost } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export async function getTitanicFeed(): Promise<FeedPost[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return titanicDemoPosts;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("posts")
    .select(`
      id,
      feed_time,
      content,
      accuracy_type,
      historical_entities!posts_author_entity_id_fkey (
        name,
        role
      ),
      post_sources (
        sources (
          title,
          url
        )
      )
    `)
    .eq("status", "published")
    .order("feed_time", { ascending: true });

  if (error || !data?.length) {
    return titanicDemoPosts;
  }

  return data.map((row: any) => {
    const entity = Array.isArray(row.historical_entities)
      ? row.historical_entities[0]
      : row.historical_entities;

    const sourceJoin = row.post_sources?.[0]?.sources;
    const source = Array.isArray(sourceJoin) ? sourceJoin[0] : sourceJoin;

    return {
      id: row.id,
      feedTime: row.feed_time,
      author: entity?.name ?? "Unknown",
      role: entity?.role ?? "Historical account",
      content: row.content,
      accuracyType: row.accuracy_type,
      sourceLabel: source?.title,
      sourceUrl: source?.url
    };
  });
}
