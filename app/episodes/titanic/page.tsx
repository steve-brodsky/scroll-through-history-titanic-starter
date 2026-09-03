import Link from "next/link";
import { FeedPostCard } from "@/components/feed-post";
import { getTitanicFeed } from "@/lib/feed";

export default async function TitanicEpisodePage() {
  const posts = await getTitanicFeed();

  return (
    <main className="mx-auto min-h-screen max-w-2xl border-x border-white/10 bg-[#0a1019]/80">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#070b12]/90 px-5 py-4 backdrop-blur-xl sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-xs uppercase tracking-[0.22em] text-slate-500 hover:text-slate-300">
              Scroll Through History
            </Link>
            <h1 className="mt-1 text-xl font-semibold">Titanic — Episode 001</h1>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-500">Current window</div>
            <div className="mt-1 text-sm text-amber-100">Apr 14 → Apr 15, 1912</div>
          </div>
        </div>
      </header>

      <section className="border-b border-white/10 bg-gradient-to-b from-slate-900/70 to-transparent px-5 py-8 sm:px-7">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">
          North Atlantic
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          The night everything changed
        </h2>
        <p className="mt-3 max-w-xl leading-7 text-slate-400">
          This is the first vertical slice of the product. Posts are explicitly labeled
          by historical basis; the canonical production episode will be generated from
          reviewed claims and primary sources.
        </p>
      </section>

      <section>
        {posts.map((post) => (
          <FeedPostCard key={post.id} post={post} />
        ))}
      </section>

      <footer className="px-5 py-10 text-center text-sm text-slate-500 sm:px-7">
        End of the current development slice — next: source ingestion → claims → events.
      </footer>
    </main>
  );
}
