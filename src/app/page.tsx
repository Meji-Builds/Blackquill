import Link from "next/link";

const ROWS = ["Fresh Shelf", "Rising", "Trending", "Continue Reading"];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <section className="max-w-2xl">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          Stories found by how deeply they are read.
        </h1>
        <p className="mt-4 text-lg text-muted">
          Publish serialized fiction for free. Every new story gets a Fresh Shelf slot and a real audience in its
          first week.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/browse" className="rounded-md bg-accent-strong px-4 py-2 font-medium text-white hover:bg-accent">
            Start reading
          </Link>
          <Link href="/studio" className="rounded-md border border-border px-4 py-2 hover:bg-surface-2">
            Start writing
          </Link>
        </div>
      </section>

      {ROWS.map((row) => (
        <section key={row} className="mt-14">
          <h2 className="mb-4 font-serif text-2xl">{row}</h2>
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">
            Coming in build step 4 (home page rows) and step 5 (discovery).
          </div>
        </section>
      ))}
    </div>
  );
}
