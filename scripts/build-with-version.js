import { spawn } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import https from 'node:https';

const args = process.argv.slice(2);
const versionArg = args.find((a) => /^[0-9]+(\.[0-9]+){0,2}$/.test(a));

async function runViteBuild() {
  try {
    const vite = await import('vite');
    await vite.build();
  } catch (e) {
    await new Promise((resolve, reject) => {
      const proc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], { stdio: 'inherit' });
      proc.on('close', (code) => {
        if (code === 0) resolve(); else reject(new Error(`vite build exited with code ${code}`));
      });
    });
  }
}

function postJson(url, payload) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const data = JSON.stringify(payload);
      const req = lib.request({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(true));
      });
      req.on('error', () => resolve(false));
      req.write(data);
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function recordVersion() {
  let version = versionArg || null;
  try {
    if (!version) {
      const pkg = (await import('../package.json', { assert: { type: 'json' } })).default;
      version = pkg?.version || null;
    }
  } catch {}

  const distAssetsDir = join(process.cwd(), 'dist', 'assets');
  let buildHash = null;
  try {
    const files = readdirSync(distAssetsDir);
    const idx = files.find((f) => /^index-.*\.js$/.test(f));
    if (idx) {
      buildHash = (idx.match(/^index-(.*)\.js$/) || [])[1] || null;
    }
  } catch {}

  const payload = {
    version: version || 'unknown',
    build: buildHash || null,
    environment: process.env.NODE_ENV === 'development' ? 'dev' : 'prod',
    notes: process.env.BUILD_NOTES || null,
  };
  try {
    writeFileSync(join(process.cwd(), 'dist', 'build.json'), JSON.stringify(payload));
  } catch {}

  const base = process.env.BUILD_API_URL || 'http://127.0.0.1:5000';
  const ok = await postJson(`${base.replace(/\/$/, '')}/versions`, payload);
}

(async () => {
  try {
    await runViteBuild();
    await recordVersion();
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
})();
