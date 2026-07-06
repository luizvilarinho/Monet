import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Copia os assets do pdfjs (decoders WASM, fontes padrão e cmaps CJK) de
// node_modules para public/pdfjs — servidos pelo Vite em dev e copiados para
// dist/ no build. Sem eles, PDFs escaneados (JBIG2/JPEG2000) e PDFs sem fontes
// embutidas renderizam quebrados. public/pdfjs está no .gitignore (derivado).
// Um marcador .version dentro de public/pdfjs invalida a cópia quando o
// pdfjs-dist é atualizado (senão os assets ficariam velhos para sempre).
function copyPdfjsAssets(): Plugin {
  return {
    name: "copy-pdfjs-assets",
    buildStart() {
      const src = path.resolve(__dirname, "node_modules/pdfjs-dist");
      const dest = path.resolve(__dirname, "public/pdfjs");
      const version = JSON.parse(
        fs.readFileSync(path.join(src, "package.json"), "utf8"),
      ).version as string;
      const marker = path.join(dest, ".version");
      const copied = fs.existsSync(marker)
        ? fs.readFileSync(marker, "utf8")
        : null;
      if (copied === version) return;
      fs.rmSync(dest, { recursive: true, force: true });
      for (const dir of ["wasm", "standard_fonts", "cmaps"]) {
        const from = path.join(src, dir);
        if (fs.existsSync(from)) {
          fs.cpSync(from, path.join(dest, dir), { recursive: true });
        }
      }
      fs.writeFileSync(marker, version);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), copyPdfjsAssets()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
