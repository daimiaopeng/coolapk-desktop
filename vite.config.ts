import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    host: process.env.TAURI_DEV_HOST || '127.0.0.1',
    port: 17520,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri 会把整个 dist 嵌入可执行文件，必须清空旧的哈希资源，避免单文件持续膨胀。
    emptyOutDir: true,
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'oxc' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    // 当前桌面端将页面与 Font Awesome 资源合并为单一主包，允许其在 Tauri 单文件场景下保持完整。
    chunkSizeWarningLimit: 2500,
  },
});
