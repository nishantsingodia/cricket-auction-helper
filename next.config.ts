import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client ships optional native bindings used by the local `file:` path. Keeping it
  // external stops the bundler tracing them; on Vercel the client talks to Turso over HTTP and
  // never loads a native binding at all.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
