import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const orchestratorUrl = env.VITE_ORCHESTRATOR_URL ?? "http://localhost:4000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@mega/shared": path.resolve(__dirname, "../../packages/shared/src")
      }
    },
    server: {
      port: Number(env.VITE_PANEL_PORT ?? 5173),
      strictPort: true,
      proxy: {
        "/sessions": orchestratorUrl,
        "/socket.io": {
          target: orchestratorUrl,
          changeOrigin: true,
          ws: true
        },
        "/embed": {
          target: orchestratorUrl,
          changeOrigin: true
        }
      },
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin'
      }
    },
    build: {
      target: "esnext",
      sourcemap: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log']
        }
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
            'state-vendor': ['jotai', '@tanstack/react-query']
          }
        }
      }
    }
  };
});
