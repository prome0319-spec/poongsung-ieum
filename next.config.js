/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 로컬 SVG 등 정적 이미지 최적화 설정
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Supabase Storage 이미지 허용
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
