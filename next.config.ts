import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GramJS (Telegram MTProto) is loaded at runtime in the Node serverless
  // function, not bundled — keeps the build light and avoids edge issues.
  serverExternalPackages: ["telegram"],
};

export default nextConfig;
