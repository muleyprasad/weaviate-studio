#!/usr/bin/env node
/**
 * Renders a built webview bundle in a mock VS Code host so its layout and theming
 * can be reviewed in a normal browser, with sample data and no VS Code, extension
 * host, or live Weaviate instance.
 *
 *   npm run preview:webview                    # build, then serve on port 4180
 *   npm run preview:webview -- --no-build      # reuse the current dist/webview
 *   npm run preview:webview -- --port 5000
 *
 * Light theme is the default; append ?dark=1 to the served URL (or pass --dark) for
 * the Dark Modern palette. Edit scripts/webview-preview/harness.html to change the
 * sample collection, schema, objects, or mock host replies.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
};

const projectRoot = resolve(import.meta.dirname, '..');
const distDir = join(projectRoot, 'dist', 'webview');
const harnessSource = join(projectRoot, 'scripts', 'webview-preview', 'harness.html');
const harnessTarget = join(distDir, '__preview.html');

const webview = option('--webview', 'data-explorer');
const collection = option('--collection', 'ProductCatalog');
const port = Number(option('--port', 4180));
const shouldBuild = !flag('--no-build');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.wasm': 'application/wasm',
};

async function writeHarness() {
  const template = await readFile(harnessSource, 'utf8');
  const filled = template
    .replaceAll('{{STYLESHEET}}', `${webview}.css`)
    .replaceAll('{{BUNDLE}}', `${webview}.bundle.js`)
    .replaceAll('{{COLLECTION}}', collection);
  await writeFile(harnessTarget, filled);
}

async function serveFile(pathname, response) {
  const requested = pathname === '/' ? '/__preview.html' : pathname;
  const filePath = join(distDir, decodeURIComponent(requested));

  // Keep the static server inside dist/webview.
  if (!filePath.startsWith(distDir + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

async function cleanup() {
  await unlink(harnessTarget).catch(() => {});
}

async function main() {
  if (shouldBuild) {
    console.log('[preview] Building the webview bundle...');
    const build = spawnSync('npm', ['run', 'build:webview'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    if (build.status !== 0) {
      console.error('[preview] build:webview failed; not starting the preview.');
      process.exit(build.status ?? 1);
    }
  }

  // The webview build empties dist/webview, so the harness is written afterwards.
  await writeHarness();

  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname;
    void serveFile(pathname, response);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[preview] Port ${port} is already in use. Pass --port <n> for another one.`);
    } else {
      console.error('[preview] Server error:', error.message);
    }
    void cleanup().then(() => process.exit(1));
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[preview] Light theme: http://127.0.0.1:${port}/__preview.html`);
    console.log(`[preview] Dark theme:  http://127.0.0.1:${port}/__preview.html?dark=1`);
    console.log('[preview] Sample data: scripts/webview-preview/harness.html');
    console.log('[preview] Ctrl+C to stop.');
  });

  const shutdown = () => {
    console.log('\n[preview] Stopping.');
    server.close(() => {
      void cleanup().then(() => process.exit(0));
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

await main();
