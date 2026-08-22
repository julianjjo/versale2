import type { NextConfig } from "next";

// Product photos only ever come from one host: the R2 bucket named by
// R2_PUBLIC_BASE_URL. apps/api's IsBucketImageUrlConstraint enforces the same
// host server-side when a listing is saved, so this allowlist can't drift
// out of sync with what actually gets stored.
const r2Hostname = process.env.R2_PUBLIC_BASE_URL
  ? new URL(process.env.R2_PUBLIC_BASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: r2Hostname
      ? [{ protocol: "https", hostname: r2Hostname }]
      : [],
  },
};

export default nextConfig;
