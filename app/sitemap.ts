import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicSiteUrl().replace(/\/$/, "");
  const now = new Date();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5
    },
    {
      url: `${base}/register`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: `${base}/docs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9
    }
  ];
}
