/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 사용자 데이터(역할·권한)가 서버에서 변경됐을 때 접속 중인 클라이언트가
    // 즉시 최신 데이터를 받도록 클라이언트 Router Cache를 비활성화
    staleTimes: {
      dynamic: 0,
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
