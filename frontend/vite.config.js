var _a;
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Se a API não estiver na 3000, defina no ambiente: ATIVADASH_API_PORT=3001 */
var apiPort = (_a = process.env.ATIVADASH_API_PORT) !== null && _a !== void 0 ? _a : "3000";
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        /** Evita falha de WebSocket (HMR) em alguns ambientes Windows / IPv6 */
        host: "127.0.0.1",
        hmr: {
            protocol: "ws",
            host: "127.0.0.1",
            port: 5173,
            clientPort: 5173,
        },
        proxy: {
            "/api": {
                target: "http://127.0.0.1:".concat(apiPort),
                changeOrigin: true,
            },
        },
    },
});
