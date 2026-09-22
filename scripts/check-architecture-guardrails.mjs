import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const failures = [];

function absolute(relativePath) {
  return path.join(root, relativePath.replaceAll('/', path.sep));
}

function read(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file)) {
    failures.push(`缺少文件: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function walk(relativeDirectory) {
  const directory = absolute(relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(relativeDirectory, entry.name).replaceAll(path.sep, '/');
    if (entry.isDirectory()) result.push(...walk(relative));
    else if (/\.(vue|ts|tsx|js|mjs)$/.test(entry.name)) result.push(relative);
  }
  return result;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const app = read('src/App.vue');
const appShell = read('src/components/layout/AppShell.vue');
const routeOutlet = read('src/presentation/RouteOutlet.vue');
const policy = read('src/utils/presentationPolicy.ts');
const capabilities = read('src/config/featureCapabilities.ts');

assert(app.includes('DesktopPresentation') && app.includes('MobilePresentation'), '根 App 必须只在 Presentation 层接线 Desktop/Mobile。');
assert(app.includes('v-if="presentationStore.presentation === \'desktop\'"'), '根 App 必须用 v-if 挂载当前 Presentation。');
assert(!app.includes('v-show'), '根 App 禁止用 v-show 隐藏另一套完整 Presentation。');
assert(!appShell.includes('MobileTopBar') && !appShell.includes('MobileBottomNav'), 'Desktop AppShell 不得挂载 Mobile 栏。');
assert(routeOutlet.includes('<keep-alive'), '路由出口必须保留页面缓存，不能因 Presentation 切换重建 Router/Pinia。');
assert(policy.includes('DESKTOP_TO_MOBILE_BREAKPOINT = 720') && policy.includes('MOBILE_TO_DESKTOP_BREAKPOINT = 760'), '唯一 Presentation Policy 必须声明 720/760 迟滞阈值。');

const mobileFiles = walk('src/mobile');
for (const file of mobileFiles) {
  const content = read(file);
  assert(!/components[\\/]layout|presentation[\\/]DesktopPresentation/.test(content), `Mobile 文件不得依赖 Desktop Presentation: ${file}`);
}

const sharedRoots = ['src/api', 'src/stores', 'src/utils', 'src/types', 'src/config'];
for (const directory of sharedRoots) {
  for (const file of walk(directory)) {
    const content = read(file);
    if (file === 'src/stores/presentation.ts') continue;
    assert(!/(?:from|import\(|require\()\s*["'][^"']*(?:mobile|presentation)[/\\][^"']*["']/.test(content), `Shared 文件不得依赖 Presentation: ${file}`);
  }
}

const modeLiterals = [...policy.matchAll(/\b(?:innerWidth|matchMedia|720|760)\b/g)].length;
assert(modeLiterals > 0, 'Presentation Policy 未发现宽度策略实现。');
assert(!/\b(?:innerWidth|matchMedia)\b/.test(mobileFiles.map(read).join('\n')), 'Mobile Feature 不得自行读取 viewport 决定 Presentation。');
assert(capabilities.includes('featureCapabilities'), '必须存在 Feature Capability manifest。');
assert(fs.existsSync(absolute('docs/architecture/feature-inventory.md')), '必须存在真实 Router/Feature inventory。');
assert(walk('src/mobile').some((file) => /__tests__|\.test\./.test(file)), 'Mobile Feature 必须存在基本测试。');
for (const [, entry] of capabilities.matchAll(/mobileEntry:\s*'([^']+)'/g)) {
  assert(fs.existsSync(absolute(entry)), `Feature manifest 的 Mobile entry 不存在: ${entry}`);
}
assert(/onUnmounted/.test(app) && /presentationStore\.stop\(\)/.test(app), 'Presentation listener 必须由根 App 生命周期清理。');
assert(!/app-shell|main-sidebar|page-tab-bar/.test(mobileFiles.map(read).join('\n')), 'Mobile global/style 文件不得修改 Desktop shell selector。');

const protectedConfigPath = 'docs/architecture/desktop-protected.json';
const protectedConfig = JSON.parse(read(protectedConfigPath) || '{}');
for (const file of protectedConfig.paths || []) {
  assert(fs.existsSync(absolute(file)), `Desktop protected path 不存在: ${file}`);
}

if (failures.length) {
  console.error(['架构 guardrail 检查失败:', ...failures.map((failure) => `- ${failure}`)].join('\n'));
  process.exitCode = 1;
} else {
  console.log('架构 guardrail 检查通过。');
}
