export function GET() {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>캐시 초기화 중…</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh; margin: 0;
           background: #f5f2fe; color: #1e1b2e; gap: 12px; text-align: center; padding: 20px; }
    p  { margin: 0; font-size: 15px; color: #7268a0; }
    .spinner { width: 36px; height: 36px; border: 3px solid #d4ccf5;
               border-top-color: #7c6bc4; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <strong>앱 캐시를 초기화하고 있어요</strong>
  <p>잠시만 기다려 주세요…</p>
  <script>
    (async function () {
      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map(r => r.unregister()))
        }
      } catch (_) {}
      window.location.replace('/home')
    })()
  </script>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
