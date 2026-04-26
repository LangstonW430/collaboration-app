import type { NextConfig } from "next";
import { readdirSync } from "fs";
import { join } from "path";
import { withSentryConfig } from "@sentry/nextjs";

const tiptapPackages = readdirSync(
  join(process.cwd(), "node_modules/@tiptap")
).map((pkg) => `@tiptap/${pkg}`);

const nextConfig: NextConfig = {
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
