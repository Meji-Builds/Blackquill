import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: { default: "Obsidian Quill", template: "%s · Obsidian Quill" },
  description: "Serialized web novels and light novels, discovered by how deeply people read them.",
  applicationName: "Obsidian Quill",
  appleWebApp: { capable: true, title: "Obsidian Quill", statusBarStyle: "black-translucent" },
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
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
