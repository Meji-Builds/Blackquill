import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: { default: "Blackquill", template: "%s · Blackquill" },
  description: "Serialized web novels and light novels, discovered by how deeply people read them.",
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
      </body>
    </html>
  );
}
