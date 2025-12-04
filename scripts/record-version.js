// type: commonjs (package.json sets type: module, but Node can run this file via node)
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const argvEnv = process.env.npm_config_argv;
let versionArg = undefined;
try {
  const parsed = JSON.parse(argvEnv || '{}');
  const original = Array.isArray(parsed?.original) ? parsed.original : [];
  // Find first argument that looks like a semantic version (e.g., 1.0, 1.0.0)
  versionArg = original.find((a) => /^[0-9]+(\.[0-9]+){0,2}$/.test(a));
} catch {}

let version = versionArg || process.env.BUILD_VERSION || null;
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
  notes: null,
};

const url = 'http://127.0.0.1:5000/versions';
try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  // Do not throw on non-200; keep build green
} catch (e) {
  // Silent per project rules
}

