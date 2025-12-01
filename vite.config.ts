import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import dns from "node:dns";

dns.setDefaultResultOrder("verbatim");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const devPort = 5173;
  const hmr = mode === "development"
    ? (process.env.VITE_HMR_HOST
        ? { host: process.env.VITE_HMR_HOST, protocol: "wss", clientPort: 443 }
        : { host: "localhost", protocol: "ws", port: devPort, clientPort: devPort })
    : undefined;

  return {
    server: {
      host: true,
      port: devPort,
      strictPort: true,
      ...(hmr ? { hmr } : {}),
      proxy: {
        "/auth/login": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/auth/me": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/user_roles/me": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/users": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/users/": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/consultores": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/import_history": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/programacoes": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/programacao_cultivares": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/programacao_adubacao": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/cultivares": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/cultivares_tratamentos": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/cultivares_catalog": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/tratamentos_sementes": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/fertilizantes": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/defensivos": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/defensivos/": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/defensivos/sync": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/defensivos/sync/test": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/fertilizantes/sync": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/fertilizantes/sync/test": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/talhoes": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/fazendas": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/produtores": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/epocas": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/calendario_aplicacoes": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/aplicacoes_defensivos": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/config": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/user_produtores": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/user_fazendas": { target: "http://127.0.0.1:5000", changeOrigin: true },
        "/gestor_consultores": { target: "http://127.0.0.1:5000", changeOrigin: true },
      },
    },
    preview: {
      port: devPort,
      strictPort: true,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
