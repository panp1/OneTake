import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone", // required for Docker/K8s deployment
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
