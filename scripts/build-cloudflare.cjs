const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const allowlist = [
  'index.html',
  'css/style.css',
  'css/planner.css',
  'css/glass.css',
  'js/security.js',
  'js/lock.js',
  'js/store.js',
  'js/app.js',
  'js/planner.js',
  'js/source-rules.js'
];

function copy(relative) {
  const src = path.join(root, relative);
  const dest = path.join(out, relative);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
    throw new Error('Required deployment asset is missing: ' + relative);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
allowlist.forEach(copy);

// Pages' _worker.js is the private API entrypoint. Do not copy the repository
// root: the repository contains local DBs, uploads and other files that must
// never be placed in the public asset manifest.
copy('cloudflare/worker.js');
fs.renameSync(path.join(out, 'cloudflare/worker.js'), path.join(out, '_worker.js'));
fs.rmSync(path.join(out, 'cloudflare'), { recursive: true, force: true });

console.log('Built Noor Cloudflare bundle with ' + (allowlist.length + 1) + ' allowlisted assets.');
