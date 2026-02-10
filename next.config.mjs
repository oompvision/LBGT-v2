/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // TODO: ~478 type errors remain — mostly from incomplete Supabase Database types,
    // Next.js 15 async page params, and missing await on createClient().
    // Fix these then remove this flag.
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  eslint: {
    // No eslint.config.js exists yet — enable once ESLint is configured
    ignoreDuringBuilds: true,
  },
}

export default nextConfig