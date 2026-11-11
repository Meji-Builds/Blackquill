import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/literata/400.css";
import "@fontsource/literata/600.css";
import "./globals.css";
import { SiteHeader, SiteTabBar } from "@/components/SiteHeader";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { siteUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: { default: "Obsidian Quill", template: "%s · Obsidian Quill" },
  description: "Serialized web novels and light novels, discovered by how deeply people read them.",
  applicationName: "Obsidian Quill",
  appleWebApp: { capable: true, title: "Obsidian Quill", statusBarStyle: "black-translucent" },
  metadataBase: new URL(siteUrl()),
  openGraph: { siteName: "Obsidian Quill", type: "website", locale: "en" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0b0a0d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteTabBar />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
