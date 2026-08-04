import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = path.join(root, 'src/constants/version.ts');
const currentVersionText = fs.readFileSync(versionFile, 'utf8');
const requestedVersion = process.argv[2];
const version = requestedVersion || currentVersionText.match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1];

if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('用法: npm run version:set -- 1.2.3');
  process.exit(1);
}

const update = (relativePath, transform) => {
  const filePath = path.join(root, relativePath);
  fs.writeFileSync(filePath, transform(fs.readFileSync(filePath, 'utf8')));
};

function updateVersionSource(nextVersion) {
  update('src/constants/version.ts', (text) => text.replace(/(APP_VERSION\s*=\s*')[^']+(')/, `$1${nextVersion}$2`));
}

if (requestedVersion) {
  updateVersionSource(version);
}

update('package.json', (text) => text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`));
update('package-lock.json', (text) => text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`));
update('src-tauri/tauri.conf.json', (text) => text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`));
update('src-tauri/Cargo.toml', (text) => text.replace(/(^version\s*=\s*")[^"]+(")/m, `$1${version}$2`));
update('src-tauri/Cargo.lock', (text) => text.replace(/(name = "coolapk_desktop"\r?\nversion = ")[^"]+(")/, `$1${version}$2`));

console.log(`版本已同步为 ${version}`);
