import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl().replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/docs"],
        disallow: ["/dashboard", "/onboarding", "/checkout/", "/auth/", "/api/", "/reset-password", "/forgot-password"]
      }
    ],
    sitemap: `${base}/sitemap.xml`
  };
}
