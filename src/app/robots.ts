import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/studio", "/library", "/settings", "/notifications", "/admin", "/login", "/auth/", "/offline", "/sb/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
