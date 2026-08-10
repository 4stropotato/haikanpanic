import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// The build shows itself in More. Too many bug reports were really a phone
// holding a cached bundle, and there was no way to tell from a screenshot
// which version was on screen.
const stamp = (() => {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim()
    const subject = execSync('git log -1 --pretty=%s').toString().trim()
    const tag = subject.match(/^v[\d.]+/)
    return `${tag ? tag[0] : ''} ${sha}`.trim()
  } catch {
    return 'dev'
  }
})()

// https://vite.dev/config/
export default defineConfig({
  base: '/haikanpanic/',
  define: { __BUILD__: JSON.stringify(stamp) },
  plugins: [react()],
  server: {
    host: true  // Expose to all network interfaces (Tailscale, LAN, etc.)
  }
})
