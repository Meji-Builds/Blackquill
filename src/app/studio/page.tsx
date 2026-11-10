import type { Metadata } from "next";

export const metadata: Metadata = { title: "Writer Studio" };

export default function StudioPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-3xl">Writer Studio</h1>
      <p className="mt-2 text-muted">Story creation, the chapter editor and scheduling arrive in build step 2.</p>
    </div>
  );
}
