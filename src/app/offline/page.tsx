import type { Metadata } from "next";
import { OfflineLibrary } from "@/components/reader/OfflineLibrary";

export const metadata: Metadata = { title: "Downloaded stories" };

// Static on purpose: the service worker stores this page and shows it when a page is not available offline.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-12 sm:pt-10">
      <h1 className="font-display text-[38px] leading-tight font-semibold">Downloaded stories</h1>
      <p className="mt-1 text-sm text-muted">Saved on this device for reading without a connection.</p>
      <OfflineLibrary />
    </div>
  );
}
