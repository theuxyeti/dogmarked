import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  async redirects() {
    return [
      {
        source: "/place/hale-patisserie",
        destination: "/place/hale-patisserie-coral-gables",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
