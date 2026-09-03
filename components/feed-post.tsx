import type { FeedPost } from "@/lib/types";

const labels = {
  documented: "Documented",
  reconstructed: "AI reconstruction",
  composite: "Composite character",
  context: "Historical context"
};

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Etc/GMT+3"
  }).format(new Date(value));
}

export function FeedPostCard({ post }: { post: FeedPost }) {
  return (
    <article className="border-b border-white/10 px-5 py-6 sm:px-7">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-sm font-bold text-amber-100">
          {post.author
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0])
            .join("")}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-semibold text-slate-100">{post.author}</span>
            <span className="text-sm text-slate-500">{post.role}</span>
          </div>

          <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">
            {timeLabel(post.feedTime)}
          </div>

          <p className="mt-4 text-[17px] leading-7 text-slate-200">
            {post.content}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1 text-xs text-slate-400">
              {labels[post.accuracyType]}
            </span>

            {post.sourceUrl && (
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-amber-200/80 underline decoration-amber-200/30 underline-offset-4 hover:text-amber-100"
              >
                Historical basis
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
