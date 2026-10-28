import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Bundle PDF decoder data locally. Private documents never go to an external viewer/CDN.
function pdfjsAssets(): Plugin {
  const root = path.resolve(import.meta.dirname, "node_modules/pdfjs-dist");
  const folders = ["cmaps", "standard_fonts", "wasm"];
  return {
    name: "local-pdfjs-assets",
    configureServer(server) {
      server.middlewares.use("/pdfjs", (req, res, next) => {
        const name = (req.url ?? "").split("?", 1)[0].replace(/^\//, "");
        if (!/^(cmaps|standard_fonts|wasm)\/[a-zA-Z0-9_.-]+$/.test(name)) return next();
        fs.readFile(path.join(root, name), (error, bytes) => {
          if (error) return next();
          res.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : name.endsWith(".js") ? "application/javascript" : "application/octet-stream");
          res.end(bytes);
        });
      });
    },
    writeBundle(options) {
      for (const folder of folders) fs.cpSync(path.join(root, folder), path.join(options.dir!, "pdfjs", folder), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [
    pdfjsAssets(),
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
