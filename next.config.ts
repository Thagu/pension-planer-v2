import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled: with cacheComponents many app routes (auth, scenarios/new, …) were
  // omitted from the route manifest and returned 404 in dev.
};

export default nextConfig;
