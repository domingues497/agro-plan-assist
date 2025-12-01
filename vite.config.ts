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
