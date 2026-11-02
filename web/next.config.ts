import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  output: "standalone",
  // The standalone build has to trace the workspace packages from the repository root.
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default config;
