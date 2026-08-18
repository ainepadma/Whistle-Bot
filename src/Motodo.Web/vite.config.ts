import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
    root: resolve(__dirname, 'src/renderer'),
    base: './',
    plugins: [react()],
    css: { postcss: { plugins: [tailwindcss, autoprefixer] } },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/renderer'),
            '@shared': resolve(__dirname, 'src/shared')
        }
    },
    build: {
        outDir: resolve(__dirname, '../PetApp/wwwroot/motodo'),
        emptyOutDir: true,
        sourcemap: false
    }
})
