import { defineConfig } from 'vite'
import path from 'path'
import os from 'os'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Dev-only: expose a local music folder to the Set list (GET /__music lists it,
// /__music/<path> serves a file). Override with MUSIC_DIR=/some/folder npm run dev.
const MUSIC_DIR = process.env.MUSIC_DIR ?? path.join(os.homedir(), 'Músicas')
const musicDir = {
  name: 'music-dir',
  apply: 'serve' as const,
  configureServer(server: any) {
    server.middlewares.use('/__music', (req: any, res: any) => {
      const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '')
      const file = path.resolve(MUSIC_DIR, rel)
      if (!file.startsWith(path.resolve(MUSIC_DIR))) { res.statusCode = 403; return res.end() }
      if (!rel) {
        const list = fs.existsSync(MUSIC_DIR)
          ? (fs.readdirSync(MUSIC_DIR, { recursive: true }) as string[]).filter(f => /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(f)).sort()
          : []
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify(list))
      }
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end() }
      fs.createReadStream(file).pipe(res)
    })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), musicDir],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
