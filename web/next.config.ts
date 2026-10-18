import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  devIndicators: false, // sem o selo do Next nas capturas de tela
  partialPrefetching: true,
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [
      // painel, login e landing não abrem dentro de iframe de outro site (clickjacking)
      { source: "/((?!chat/).*)", headers: [...base, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
      // o chat do site é feito para ser embutido (widget.js)
      { source: "/chat/:key*", headers: [...base, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
