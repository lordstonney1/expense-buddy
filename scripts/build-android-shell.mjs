// Produces dist/client/index.html — the static shell the Capacitor Android app
// loads inside its WebView.
//
// The web app is server-rendered, so the production build has no index.html.
// Instead of hand-writing one (client hydration fails without the router's
// dehydrated state), we boot the built server locally in the Cloudflare worker
// runtime, request "/", and snapshot the real HTML it returns.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CONFIG = "dist/server/wrangler.json";
const PORT = 4197;

if (!existsSync(CONFIG)) {
  console.error("[shell] run `bun run build` first");
  process.exit(1);
}

// Local workerd may lag behind the generated compatibility date, and needs
// nodejs_compat explicitly.
const cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
cfg.compatibility_date = "2026-08-11";
cfg.compatibility_flags = Array.from(
  new Set([...(cfg.compatibility_flags ?? []), "nodejs_compat"]),
);
writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));

const server = spawn(
  "bunx",
  ["wrangler", "dev", "--config", CONFIG, "--port", String(PORT), "--ip", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let html = null;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/`);
    if (res.status === 200) {
      html = await res.text();
      break;
    }
  } catch {
    /* server still booting */
  }
}
server.kill("SIGKILL");

if (!html) {
  console.error("[shell] could not render / from the built server");
  process.exit(1);
}

writeFileSync("dist/client/index.html", html);
console.log(`[shell] wrote dist/client/index.html (${html.length} bytes)`);
process.exit(0);
