import type { Metadata } from "next";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-3xl">Your Library</h1>
      <p className="mt-2 text-muted">Shelves and reading progress arrive in build step 3.</p>
    </div>
  );
}
