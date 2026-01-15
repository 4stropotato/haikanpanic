import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/haikanpanic/',
  plugins: [react()],
  server: {
    host: true  // Expose to all network interfaces (Tailscale, LAN, etc.)
  }
})
