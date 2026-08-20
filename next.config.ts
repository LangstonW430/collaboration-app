import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { dependencies } from "./package.json";

// Taken from the declared dependencies rather than by reading node_modules,
// which assumes a flat npm layout and picks up transitive packages the app
// does not use.
const tiptapPackages = Object.keys(dependencies).filter((name) =>
  name.startsWith("@tiptap/")
);

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
  webpack: { disableSentryConfig: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
