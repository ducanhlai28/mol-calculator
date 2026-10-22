import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages phục vụ app tại https://<user>.github.io/mol-calculator/
  base: command === 'build' ? '/mol-calculator/' : '/',
  plugins: [react()],
  // Ketcher dùng biến của Node (process.env, global) — trình duyệt không có
  define: { 'process.env': {}, global: 'globalThis' },
  // Ketcher + Indigo WASM là một chunk lớn (~29 MB, tải lười khi mở trình vẽ) — không cần cảnh báo
  build: { chunkSizeWarningLimit: 32000 },
  // Trên ổ D: (Windows) watcher mặc định đôi khi bỏ lỡ thay đổi khi sửa file liên tiếp → dùng polling
  server: { watch: { usePolling: true, interval: 200 } },
}))
