export default {
  providers: [
    {
      // CONVEX_SITE_URL is auto-set by Convex to your deployment's HTTP URL
      // e.g. https://xxxxx.convex.site
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
