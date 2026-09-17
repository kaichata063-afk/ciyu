import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// BASE_PATH 用于部署到子路径（如 GitHub Pages 的 /ciyu/）；默认根路径
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [vue()],
})
