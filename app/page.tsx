import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-amber-200/70">
        Scroll Through History
      </div>
      <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight sm:text-7xl">
        History, as it happened.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
        Follow historical events through a source-backed social feed. Episode 001 begins
        aboard RMS Titanic on the night of April 14, 1912.
      </p>
      <div className="mt-10">
        <Link
          href="/episodes/titanic"
          className="inline-flex rounded-full bg-amber-100 px-6 py-3 font-semibold text-slate-950 transition hover:bg-white"
        >
          Enter Titanic — Episode 001
        </Link>
      </div>
    </main>
  );
}
