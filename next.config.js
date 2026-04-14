/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 로컬 SVG 등 정적 이미지 최적화 설정
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
}

module.exports = nextConfig
