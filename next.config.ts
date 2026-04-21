import type { NextConfig } from 'next'
import { readdirSync } from 'fs'
import { join } from 'path'

// Auto-discover every @tiptap/* package so no manual list is needed.
const tiptapPackages = readdirSync(
  join(process.cwd(), 'node_modules/@tiptap')
).map((pkg) => `@tiptap/${pkg}`)

const nextConfig: NextConfig = {
  transpilePackages: [
    ...tiptapPackages,
    'lowlight',
    'chart.js',
    'react-chartjs-2',
  ],
}

export default nextConfig
