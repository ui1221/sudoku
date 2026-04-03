import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages でのデプロイ先に合わせて base を設定
  // 例: https://<username>.github.io/sudoku/ の場合は '/sudoku/'
  // カスタムドメインや username.github.io の場合は '/'
  base: '/sudoku/',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },

  server: {
    port: 5173,
    open: true,
  },
});
