import type { NextConfig } from "next";
import { readdirSync } from "fs";
import { join } from "path";
import { withSentryConfig } from "@sentry/nextjs";

const tiptapPackages = readdirSync(
  join(process.cwd(), "node_modules/@tiptap")
).map((pkg) => `@tiptap/${pkg}`);

const nextConfig: NextConfig = {
  // Linting runs as its own step (`npm run lint`) against the flat config in
  // eslint.config.mjs. Next's build-time pass uses its own legacy invocation,
  // which cannot read that config.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    ...tiptapPackages,
    "lowlight",
    "chart.js",
    "react-chartjs-2",
  ],
};

export default withSentryConfig(nextConfig, {
  // Supply org/project/authToken at build time (CI/CD) for source-map uploads.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Skip webpack plugins when no auth token is present (local dev).
  disableSentryWebpackConfig: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
