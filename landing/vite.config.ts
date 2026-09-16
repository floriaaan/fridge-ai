/// <reference types="vitest/config" />
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // The Start plugin builds a server + client app; unit tests only need React.
  plugins: process.env.VITEST ? [viteReact()] : [tailwindcss(), tanstackStart(), viteReact()],
  test: { environment: 'jsdom' },
})
