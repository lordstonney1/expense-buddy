// Generates dist/client/index.html — the static shell Capacitor loads inside
// the Android WebView. The SSR build has no index.html (HTML is produced by the
// server at runtime), so we synthesise one from the TanStack Start manifest:
// same entry script + stylesheet as production, then the app hydrates client-side.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const clientDir = "dist/client";
const serverDir = "dist/server";

if (!existsSync(clientDir)) {
  console.error("[shell] dist/client not found — run vite build first");
  process.exit(1);
}

const manifestFile = readdirSync(serverDir).find((f) =>
  f.startsWith("_tanstack-start-manifest_"),
);
if (!manifestFile) {
  console.error("[shell] TanStack Start manifest not found");
  process.exit(1);
}

const manifest = readFileSync(join(serverDir, manifestFile), "utf8");
const entry = manifest.match(/src: "(\/assets\/[^"]+\.js)"/)?.[1];
if (!entry) {
  console.error("[shell] could not find client entry script");
  process.exit(1);
}

const css = readdirSync(join(clientDir, "assets")).filter((f) => f.endsWith(".css"));

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>CediTrack — Daily Expense Tracker</title>
    <meta name="theme-color" content="#1e3a8a" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="manifest" href="/manifest.webmanifest" />
${css.map((f) => `    <link rel="stylesheet" href="/assets/${f}" />`).join("\n")}
  </head>
  <body>
    <script type="module" async src="${entry}"></script>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), html);
console.log(`[shell] wrote ${clientDir}/index.html (entry ${entry})`);
