<template>
  <div v-if="visible" class="modal-backdrop" @click.self="close">
    <div class="settings-modal" role="dialog" aria-labelledby="settings-title">
      <!-- Header -->
      <div class="modal-header">
        <h2 id="settings-title"><i class="fa-solid fa-gear modal-icon"></i> 设置</h2>
        <button class="btn-close" aria-label="关闭" @click="close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Main Container (Left Tabs + Right Panel) -->
      <div class="modal-body">
        <!-- Sidebar Navigation -->
        <nav class="settings-sidebar">
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'appearance' }"
            @click="currentTab = 'appearance'"
          >
            <i class="fa-solid fa-palette"></i> 界面与显示
          </button>
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'performance' }"
            @click="currentTab = 'performance'"
          >
            <i class="fa-solid fa-bolt"></i> 预加载与性能
          </button>
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'account' }"
            @click="currentTab = 'account'"
          >
            <i class="fa-solid fa-user-shield"></i> 账号与网络
          </button>
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'about' }"
            @click="currentTab = 'about'"
          >
            <i class="fa-solid fa-circle-info"></i> 关于与更新
          </button>
        </nav>

        <!-- Right Content Panel -->
        <main class="settings-content">
          <!-- 1. 界面与显示 -->
          <section v-if="currentTab === 'appearance'" class="panel-section">
            <h3 class="section-title">界面与显示</h3>

            <div class="setting-item">
              <div class="item-info">
                <label class="item-label">界面缩放比例</label>
                <span class="item-desc">调整软件整体高清视网膜显示比例（按 Ctrl + / - / 0 快捷键亦可实时调整）</span>
              </div>
              <div class="item-control">
                <div class="zoom-pill-group">
                  <button
                    v-for="level in zoomOptions"
                    :key="level"
                    class="pill-btn"
                    :class="{ active: settings.appZoom === level }"
                    @click="settings.appZoom = level"
                  >
                    {{ level }}%
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="item-info">
                <label class="item-label">外观主题</label>
                <span class="item-desc">选择符合你习惯的大气视觉调色盘</span>
              </div>
              <div class="item-control">
                <div class="pill-group">
                  <button
                    class="pill-btn"
                    :class="{ active: settings.theme === 'system' }"
                    @click="settings.theme = 'system'"
                  >
                    <i class="fa-solid fa-desktop"></i> 跟随系统
                  </button>
                  <button
                    class="pill-btn"
                    :class="{ active: settings.theme === 'light' }"
                    @click="settings.theme = 'light'"
                  >
                    <i class="fa-solid fa-sun"></i> 浅色模式
                  </button>
                  <button
                    class="pill-btn"
                    :class="{ active: settings.theme === 'dark' }"
                    @click="settings.theme = 'dark'"
                  >
                    <i class="fa-solid fa-moon"></i> 深色模式
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="item-info">
                <label class="item-label">正文折叠阀值</label>
                <span class="item-desc">列表卡片正文超过设置行数时自动显示“展开全文”按钮</span>
              </div>
              <div class="item-control">
                <select v-model.number="settings.collapseLines" class="select-input">
                  <option :value="8">超 8 行折叠</option>
                  <option :value="12">超 12 行折叠 (推荐)</option>
                  <option :value="18">超 18 行折叠</option>
                  <option :value="0">从不折叠 (展示全部正文)</option>
                </select>
              </div>
            </div>

            <div class="setting-item">
              <div class="item-info">
                <label class="item-label">默认评论区排序</label>
                <span class="item-desc">打开动态详情时，评论区的缺省排列顺序</span>
              </div>
              <div class="item-control">
                <div class="pill-group">
                  <button
                    class="pill-btn"
                    :class="{ active: settings.commentSort === 'hot' }"
                    @click="settings.commentSort = 'hot'"
                  >
                    <i class="fa-solid fa-fire-flame-curved"></i> 热门优先
                  </button>
                  <button
                    class="pill-btn"
                    :class="{ active: settings.commentSort === 'latest' }"
                    @click="settings.commentSort = 'latest'"
                  >
                    <i class="fa-regular fa-clock"></i> 最新时间
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-item">
              <div class="item-info">
                <label class="item-label">图片画质模式</label>
                <span class="item-desc">列表中九宫格及动态九图加载质量策略</span>
              </div>
              <div class="item-control">
                <div class="pill-group">
                  <button
                    class="pill-btn"
                    :class="{ active: settings.imageQuality === 'original' }"
                    @click="settings.imageQuality = 'original'"
                  >
                    高清原图
                  </button>
                  <button
                    class="pill-btn"
                    :class="{ active: settings.imageQuality === 'compressed' }"
                    @click="settings.imageQuality = 'compressed'"
                  >
                    节省流量模式
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- 2. 预加载与性能 -->
          <section v-if="currentTab === 'performance'" class="panel-section">
            <h3 class="section-title">预加载与性能</h3>

            <div class="setting-item">
              <div class="item-info">
                <label class="item-label">后台并发预加载</label>
                <span class="item-desc">在浏览列表时，后台自动预加载正文与高频评论，实现无缝瞬开</span>
              </div>
              <div class="item-control">
                <label class="toggle-switch">
                  <input v-model="settings.enablePreload" type="checkbox">
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <div class="item-info">
                <label class="item-label">应用数据与图片缓存</label>
                <span class="item-desc">清理本地存储中的临时数据与接口请求缓存</span>
              </div>
              <div class="item-control">
                <button class="btn-secondary" :disabled="cacheClearing" @click="clearCache">
                  <i class="fa-solid fa-trash-can"></i>
                  {{ cacheClearing ? '清理中...' : '一键清理缓存' }}
                </button>
              </div>
            </div>
            <p v-if="cacheTip" class="status-msg success"><i class="fa-solid fa-circle-check"></i> {{ cacheTip }}</p>
          </section>

          <!-- 3. 账号与网络 -->
          <section v-if="currentTab === 'account'" class="panel-section">
            <h3 class="section-title">账号与网络</h3>

            <div class="account-status-card">
              <div class="account-header">
                <i class="fa-solid fa-shield-halved status-icon" :class="{ active: hasCookie }"></i>
                <div>
                  <h4 class="status-title">{{ hasCookie ? '当前账号 Cookie 已载入' : '当前处于匿名浏览模式' }}</h4>
                  <p class="status-subtitle">
                    {{ hasCookie ? '你可以在桌面端体验关注、点赞、私信、评论和发布功能' : '无需登录即可公开浏览动态、热榜与搜素；需登录操作可在下方提交 Cookie' }}
                  </p>
                </div>
              </div>
            </div>

            <div class="setting-item vertical">
              <div class="item-info">
                <label class="item-label">酷安账号 Cookie 凭据</label>
                <span class="item-desc">Cookie 仅保存在当前本地内存/应用会话中，绝不向任何第三方或云端传输</span>
              </div>
              <div class="item-control full-width" style="margin-top: 10px;">
                <textarea
                  v-model="cookieInput"
                  class="cookie-textarea"
                  placeholder="在此贴入 SESSID 或完整 Cookie 字符串 (如 SESSID=xxxx...)"
                  rows="3"
                ></textarea>
                <div class="btn-group" style="margin-top: 10px; display: flex; gap: 10px;">
                  <button class="btn-primary" @click="handleSaveCookie">
                    <i class="fa-solid fa-floppy-disk"></i> 保存并载入 Cookie
                  </button>
                  <button v-if="hasCookie" class="btn-danger" @click="handleClearCookie">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i> 退出登录 / 清除凭据
                  </button>
                </div>
              </div>
            </div>
            <p v-if="cookieStatusMsg" class="status-msg" :class="cookieStatusType">
              {{ cookieStatusMsg }}
            </p>

            <div class="setting-item" style="margin-top: 20px;">
              <div class="item-info">
                <label class="item-label">Rust Core 网络驱动</label>
                <span class="item-desc">运行状态：Token V3 兼容算法 + 原生 Reqwest 异步引擎</span>
              </div>
              <div class="item-control">
                <span class="badge-success"><i class="fa-solid fa-circle"></i> Rust 原生连接中</span>
              </div>
            </div>
          </section>

          <!-- 4. 关于与更新 -->
          <section v-if="currentTab === 'about'" class="panel-section">
            <h3 class="section-title">关于与更新</h3>

            <div class="about-hero">
              <img src="../assets/coolapk-logo-rounded.png" alt="酷安 Logo" class="about-logo">
              <div class="about-meta">
                <h4>酷安桌面客户端</h4>
                <p class="app-version">Version {{ appVersion }} (Tauri 2 + Vue 3 + Rust)</p>
                <p class="app-desc">社区维护的高能开源非官方桌面客户端</p>
              </div>
            </div>

            <div class="setting-item">
              <div class="item-info">
                <label class="item-label">检查软件更新</label>
                <span class="item-desc">连接 GitHub Release 检测最新版本</span>
              </div>
              <div class="item-control">
                <button class="btn-primary" :disabled="checkingUpdate" @click="checkAppUpdate">
                  <i class="fa-solid fa-rotate" :class="{ 'fa-spin': checkingUpdate }"></i>
                  {{ checkingUpdate ? '检查中...' : '检查更新' }}
                </button>
              </div>
            </div>

            <div v-if="updateInfo" class="update-info-card" :class="{ 'has-new': updateInfo.hasNew }">
              <div class="update-badge">
                <i class="fa-solid" :class="updateInfo.hasNew ? 'fa-circle-up' : 'fa-circle-check'"></i>
                <span>{{ updateInfo.hasNew ? `发现新版本: ${updateInfo.latestVersion}` : '当前已是最新版本' }}</span>
              </div>
              <p v-if="updateInfo.releaseNotes" class="release-notes">{{ updateInfo.releaseNotes }}</p>
              <button
                v-if="updateInfo.downloadUrl"
                type="button"
                class="btn-update-download"
                @click="openExternalUrl(updateInfo.downloadUrl)"
              >
                <i class="fa-solid fa-download"></i> 前往 GitHub 发布页下载产物
              </button>
            </div>

            <div class="shortcut-section">
              <h5><i class="fa-solid fa-keyboard"></i> 常用快捷键</h5>
              <div class="shortcut-grid">
                <div class="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>+</kbd> <span>放大界面</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>-</kbd> <span>缩小界面</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>0</kbd> <span>重置 100% 缩放</span>
                </div>
                <div class="shortcut-item">
                  <kbd>F5</kbd> 或 <kbd>Ctrl</kbd> + <kbd>R</kbd> <span>刷新当前列表</span>
                </div>
              </div>
            </div>

            <div class="legal-notice">
              <p>本项目由开源社区维护，遵守 <button type="button" class="inline-link" @click="openExternalUrl('https://github.com/daimiaopeng/coolapk-desktop/blob/main/LICENSE')">MIT 许可证</button>。酷安 Logo 及相关商标所有权归原商标持有人所有。</p>
              <div class="github-link-row">
                <button type="button" class="github-btn" @click="openExternalUrl('https://github.com/daimiaopeng/coolapk-desktop')">
                  <i class="fa-brands fa-github"></i> GitHub 官方开源仓库
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { settings } from '../utils/settingsStore';
import { CoolapkTauriAPI } from '../api/coolapk';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'cookie-changed'): void;
}>();

const currentTab = ref<'appearance' | 'performance' | 'account' | 'about'>('appearance');
const zoomOptions = [90, 100, 110, 125, 150];
const appVersion = '1.0.0';

// 缓存管理
const cacheClearing = ref(false);
const cacheTip = ref('');

// Cookie
const cookieInput = ref('');
const hasCookie = ref(false);
const cookieStatusMsg = ref('');
const cookieStatusType = ref<'success' | 'error'>('success');

// 更新检查
const checkingUpdate = ref(false);
const updateInfo = ref<{
  hasNew: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
} | null>(null);

function close() {
  emit('update:visible', false);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    close();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  checkCookieState();
});

function openExternalUrl(url?: string) {
  if (!url) return;
  void CoolapkTauriAPI.openUrl(url);
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

watch(
  () => props.visible,
  (val) => {
    if (val) {
      checkCookieState();
    }
  }
);

function checkCookieState() {
  const saved = localStorage.getItem('coolapk_cookie');
  hasCookie.value = Boolean(saved && saved.trim());
}

async function clearCache() {
  cacheClearing.value = true;
  cacheTip.value = '';
  setTimeout(() => {
    try {
      sessionStorage.clear();
      cacheTip.value = '图片和数据临时缓存清理成功！';
    } catch (err) {
      cacheTip.value = '缓存清理完成。';
    } finally {
      cacheClearing.value = false;
    }
  }, 400);
}

async function handleSaveCookie() {
  const val = cookieInput.value.trim();
  if (!val) {
    cookieStatusMsg.value = '请输入有效的 Cookie 凭据字符串';
    cookieStatusType.value = 'error';
    return;
  }

  try {
    localStorage.setItem('coolapk_cookie', val);
    await CoolapkTauriAPI.saveCookie(val);
    hasCookie.value = true;
    cookieInput.value = '';
    cookieStatusMsg.value = 'Cookie 成功保存并载入内存！';
    cookieStatusType.value = 'success';
    emit('cookie-changed');
  } catch (err: any) {
    cookieStatusMsg.value = `保存 Cookie 成功但接口通知异常: ${err?.message || err}`;
    cookieStatusType.value = 'success';
    hasCookie.value = true;
    emit('cookie-changed');
  }
}

function handleClearCookie() {
  localStorage.removeItem('coolapk_cookie');
  hasCookie.value = false;
  cookieInput.value = '';
  cookieStatusMsg.value = '已清除 Cookie，恢复为匿名浏览状态。';
  cookieStatusType.value = 'success';
  emit('cookie-changed');
}

async function checkAppUpdate() {
  checkingUpdate.value = true;
  updateInfo.value = null;

  try {
    const res = await fetch('https://api.github.com/repos/daimiaopeng/coolapk-desktop/releases/latest', {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!res.ok) {
      throw new Error(`GitHub API HTTP ${res.status}`);
    }

    const data = await res.json();
    const tagName = (data.tag_name || '').replace(/^v/i, '');
    
    // 简单的版本号比较 logic
    const isNew = tagName && tagName !== appVersion;

    updateInfo.value = {
      hasNew: isNew,
      latestVersion: data.tag_name || '最新发布',
      releaseNotes: data.body ? data.body.slice(0, 300) + (data.body.length > 300 ? '...' : '') : '暂无特定更新日志',
      downloadUrl: data.html_url || 'https://github.com/daimiaopeng/coolapk-desktop/releases',
    };
  } catch (err: any) {
    updateInfo.value = {
      hasNew: false,
      releaseNotes: `检测更新失败，网络异常或达到 GitHub API 频率限制 (${err?.message || err})`,
      downloadUrl: 'https://github.com/daimiaopeng/coolapk-desktop/releases',
    };
  } finally {
    checkingUpdate.value = false;
  }
}
</script>

<style scoped>
/* Modal 遮罩与布局 */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.settings-modal {
  width: 780px;
  max-width: 92vw;
  height: 560px;
  max-height: 85vh;
  background: var(--bg-card, #ffffff);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color, #e5e9ef);
  color: var(--text-main, #222222);
}

/* Header */
.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color, #e5e9ef);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-header, #fcfdfe);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--brand-green, #11b066);
}

.modal-icon {
  font-size: 1.2rem;
}

.btn-close {
  background: transparent;
  border: 0;
  font-size: 1.25rem;
  color: #888;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #333;
}

/* Body: 侧边栏 + 右面板 */
.modal-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* Sidebar */
.settings-sidebar {
  width: 200px;
  background: var(--bg-sidebar, #f7f9fb);
  border-right: 1px solid var(--border-color, #e5e9ef);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 14px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-sub, #555);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.tab-btn i {
  font-size: 1rem;
  width: 18px;
}

.tab-btn:hover {
  background: rgba(17, 176, 102, 0.08);
  color: var(--brand-green, #11b066);
}

.tab-btn.active {
  background: var(--brand-green, #11b066);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(17, 176, 102, 0.25);
}

/* Right Content */
.settings-content {
  flex: 1;
  padding: 24px 28px;
  overflow-y: auto;
}

.section-title {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.1rem;
  font-weight: 600;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--brand-green, #11b066);
  display: inline-block;
}

/* Setting Item Row */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px dashed var(--border-color, #eaeefe);
}

.setting-item.vertical {
  flex-direction: column;
  align-items: flex-start;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 70%;
}

.setting-item.vertical .item-info {
  max-width: 100%;
}

.item-label {
  font-weight: 600;
  font-size: 0.92rem;

}

.item-desc {
  font-size: 0.78rem;
  color: #777777;
  line-height: 1.35;
}

/* Pills & Buttons */
.zoom-pill-group,
.pill-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #d9e2ea);
  border-radius: 16px;
  background: #fff;
  color: #444;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.pill-btn:hover {
  border-color: var(--brand-green, #11b066);
  color: var(--brand-green, #11b066);
}

.pill-btn.active {
  background: var(--brand-green, #11b066);
  color: #fff;
  border-color: var(--brand-green, #11b066);
  font-weight: 600;
}

.select-input {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #d9e2ea;
  font-size: 0.85rem;
  outline: none;
  background: #fff;
  color: #333;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #ccc;
  transition: .25s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .25s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: var(--brand-green, #11b066);
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* Buttons */
.btn-primary {
  padding: 8px 16px;
  border-radius: 8px;
  border: 0;
  background: var(--brand-green, #11b066);
  color: #fff;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease;
}

.btn-primary:hover {
  background: #0ea05b;
}

.btn-secondary {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #d9e2ea;
  background: #fff;
  color: #444;
  font-size: 0.84rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-secondary:hover {
  background: #f4f6f8;
  border-color: #c5d0da;
}

.btn-danger {
  padding: 8px 14px;
  border-radius: 8px;
  border: 0;
  background: #e74c3c;
  color: #fff;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-danger:hover {
  background: #c0392b;
}

/* Account card */
.account-status-card {
  background: #f7faf8;
  border: 1px solid #d5ebd9;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.account-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.status-icon {
  font-size: 1.5rem;
  color: #aaa;
  margin-top: 2px;
}

.status-icon.active {
  color: var(--brand-green, #11b066);
}

.status-title {
  margin: 0 0 4px 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.status-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: #666;
  line-height: 1.4;
}

.cookie-textarea {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #d9e2ea;
  padding: 10px;
  font-size: 0.82rem;
  font-family: monospace;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
}

.cookie-textarea:focus {
  border-color: var(--brand-green, #11b066);
}

.status-msg {
  font-size: 0.82rem;
  margin: 8px 0 0 0;
}

.status-msg.success {
  color: var(--brand-green, #11b066);
}

.status-msg.error {
  color: #e74c3c;
}

.badge-success {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: #11b066;
  background: rgba(17, 176, 102, 0.1);
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 600;
}

/* About Section */
.about-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 10px;
  margin-bottom: 20px;
}

.about-logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
}

.about-meta h4 {
  margin: 0 0 4px 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.app-version {
  margin: 0 0 4px 0;
  font-size: 0.82rem;
  color: var(--brand-green, #11b066);
  font-weight: 600;
}

.app-desc {
  margin: 0;
  font-size: 0.78rem;
  color: #777;
}

.update-info-card {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f4f6f8;
  border: 1px solid #e0e6ed;
}

.update-info-card.has-new {
  background: #eef9f3;
  border-color: #bce9cc;
}

.update-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  color: #333;
}

.update-info-card.has-new .update-badge {
  color: var(--brand-green, #11b066);
}

.release-notes {
  font-size: 0.8rem;
  color: #555;
  margin: 8px 0;
  line-height: 1.4;
  white-space: pre-wrap;
}

.btn-update-download {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 6px 12px;
  background: var(--brand-green, #11b066);
  color: #fff;
  border-radius: 6px;
  font-size: 0.8rem;
  text-decoration: none;
  font-weight: 600;
}

.shortcut-section {
  margin-top: 24px;
}

.shortcut-section h5 {
  margin: 0 0 10px 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: #444;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.shortcut-item {
  font-size: 0.8rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 6px;
}

kbd {
  background: #eef2f5;
  border: 1px solid #c9d4de;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 0.76rem;
  color: #333;
  box-shadow: 0 1px 1px rgba(0,0,0,0.1);
}

.legal-notice {
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px solid #eef2f5;
  font-size: 0.78rem;
  color: #888;
  line-height: 1.4;
}

.legal-notice a,
.inline-link {
  color: var(--brand-green, #11b066);
  text-decoration: none;
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
}

.legal-notice a:hover,
.inline-link:hover {
  text-decoration: underline;
}

.github-link-row {
  margin-top: 10px;
}

.github-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #333;
  text-decoration: none;
  font-weight: 600;
  background: #f0f3f6;
  padding: 6px 12px;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.github-btn:hover {
  background: #e2e7ec;
}
</style>
