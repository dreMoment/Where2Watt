import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/privacy-policy", "/terms", "/support"].map((path) => ({
    url: `https://where2watt.cc${path}`,
  }));
}
