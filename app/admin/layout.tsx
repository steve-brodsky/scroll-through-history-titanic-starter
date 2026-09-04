import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell min-h-screen bg-[#0a0d10] text-stone-100">
      <header className="border-b border-white/10 bg-[#0a0d10]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-5">
            <Link href="/" className="font-serif text-lg tracking-wide text-stone-100">
              Scroll Through History
            </Link>
            <span className="border-l border-white/15 pl-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c4a76a]">
              Admin
            </span>
          </div>
          <nav aria-label="Admin navigation">
            <Link
              href="/admin/claims"
              className="border-b border-[#c4a76a] pb-1 text-sm text-stone-200"
            >
              Claims
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
