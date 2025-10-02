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
            }
        },
        build: {
            target: "es2021",
            sourcemap: true,
            rollupOptions: {
                output: {
                    manualChunks: {
                        vendor: ["react", "react-dom", "react-query"],
                        realtime: ["socket.io-client"],
                        virtualization: ["react-window", "react-virtualized-auto-sizer"]
                    }
                }
            }
        }
    };
});
