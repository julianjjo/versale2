import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Item 11: crawlers are welcome on the public catalog; account, checkout and
// moderation surfaces carry no SEO value and shouldn't be crawled.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/cart",
          "/orders",
          "/favoritos",
          "/mis-productos",
          "/mis-ventas",
          "/profile",
          "/sell",
          "/login",
          "/signup",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
