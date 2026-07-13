/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
 
  eslint: {
    ignoreDuringBuilds: true,
  },

  // /embed is meant to be framed by partner and branch sites, so it opts out of
  // the deny-by-default framing posture. Nothing else on the site does.
  async headers() {
    return [
      {
        source: "/embed",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ]
  },
}

export default nextConfig