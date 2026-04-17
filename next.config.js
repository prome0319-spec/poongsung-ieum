/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 클라이언트 Router Cache 완전 비활성화.
    // RSC 세그먼트 캐시 불일치로 인한 페이지 오류 방지.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
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
