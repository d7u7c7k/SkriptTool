import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Electron이 file:// 로 dist/index.html 을 열기 때문에 자산 경로는 상대 경로여야 합니다.
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Monaco는 오프라인에서도 동작하도록 앱에 포함되기 때문에 청크가 큽니다.
    chunkSizeWarningLimit: 3000
  }
});
