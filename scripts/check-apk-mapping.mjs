import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const mappingPath = path.join(root, 'docs', 'apk', 'mapping', '16.6.2-2609151.json');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const failures = [];

function absolute(relativePath) {
  return path.join(root, relativePath.replaceAll('/', path.sep));
}

for (const feature of mapping.features || []) {
  for (const target of feature.targets || []) {
    if (!fs.existsSync(absolute(target))) failures.push(`${feature.id}: target 不存在 ${target}`);
  }
}

const apkFlag = process.argv.indexOf('--apk');
if (apkFlag >= 0 && process.argv[apkFlag + 1]) {
  const apkPath = process.argv[apkFlag + 1];
  if (!fs.existsSync(apkPath)) {
    failures.push(`APK 不存在: ${apkPath}`);
  } else {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(apkPath)).digest('hex').toUpperCase();
    if (hash !== String(mapping.apk.sha256).toUpperCase()) failures.push(`APK SHA-256 不匹配: ${hash}`);
  }
}

if (!mapping.apk?.version || !mapping.apk?.versionCode || !mapping.apk?.sha256) failures.push('APK mapping 缺少 version/versionCode/sha256。');
if (!Array.isArray(mapping.features) || mapping.features.length === 0) failures.push('APK mapping 没有 feature 记录。');

if (failures.length) {
  console.error(['APK mapping 检查失败:', ...failures.map((failure) => `- ${failure}`)].join('\n'));
  process.exitCode = 1;
} else {
  console.log(`APK mapping 检查通过：${mapping.apk.version} (${mapping.apk.versionCode})`);
}
