import fs from "node:fs";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDirectory, "../..");

const andonApiTarget = process.env.ANDON_API_BASE_URL ?? "http://127.0.0.1:4318";

/**
 * Read the Andon loopback auth token in the dev server, never in the browser.
 *
 * The API requires a bearer token on mutating routes. Handing that token to the
 * page would put a credential into browser-accessible JavaScript where any
 * script on the origin could read it, so the browser talks to this dev server
 * at /api and the proxy attaches the header on the way out. Read per request so
 * a token minted after the dev server started is still picked up.
 */
function readAndonToken(): string | null {
  const override = process.env.ANDON_TOKEN_FILE?.trim();
  const tokenFile = override ? resolve(override) : join(os.homedir(), ".holistic", "andon-token");
  try {
    const value = fs.readFileSync(tokenFile, "utf8").trim();
    return value.length >= 32 ? value : null;
  } catch {
    return null;
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      allow: [repoRoot]
    },
    proxy: {
      "/api": {
        target: andonApiTarget,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const token = readAndonToken();
            if (token) {
              proxyReq.setHeader("Authorization", `Bearer ${token}`);
            }
          });
        }
      }
    }
  }
});
