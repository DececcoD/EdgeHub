/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // Docker (see Dockerfile) copies just this trimmed output, not the full node_modules tree.
  experimental: {
    typedRoutes: false
  },
  // Section 14 QA pass - baseline security headers this app had none of
  // before. CSP is handled separately (see middleware.ts) since it needs a
  // per-request nonce for Next's inline hydration scripts, which a static
  // header here can't generate.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // clickjacking - this app has no legitimate reason to be framed
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, // none of these are used anywhere in the app
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
        ]
      }
    ];
  }
};

export default nextConfig;
