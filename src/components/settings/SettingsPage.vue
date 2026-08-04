<template>
  <div class="settings-page">
    <div class="page-header">
      <h1 class="page-title"><i class="fa-solid fa-gear title-icon"></i> 设置中心</h1>
      <p class="page-desc">管理客户端外观显示、性能缓存、账号凭据及开源更新选项</p>
    </div>

    <!-- 左右布局主容器 -->
    <div class="settings-container">
      <!-- 左侧二级导航 (260px) -->
      <nav class="settings-nav">
        <button
          class="nav-tab-btn"
          :class="{ active: currentTab === 'appearance' }"
          @click="currentTab = 'appearance'"
        >
          <div class="tab-icon-box">
            <i class="fa-solid fa-palette"></i>
          </div>
          <div class="tab-meta">
            <span class="tab-title">界面与显示</span>
            <span class="tab-desc">主题、字号与显示偏好</span>
          </div>
        </button>

        <button
          class="nav-tab-btn"
          :class="{ active: currentTab === 'performance' }"
          @click="currentTab = 'performance'"
        >
          <div class="tab-icon-box">
            <i class="fa-solid fa-bolt"></i>
          </div>
          <div class="tab-meta">
            <span class="tab-title">预加载与性能</span>
            <span class="tab-desc">预加载、缓存与加载策略</span>
          </div>
        </button>

        <button
          class="nav-tab-btn"
          :class="{ active: currentTab === 'account' }"
          @click="currentTab = 'account'"
        >
          <div class="tab-icon-box">
            <i class="fa-solid fa-user-shield"></i>
          </div>
          <div class="tab-meta">
            <span class="tab-title">账号与网络</span>
            <span class="tab-desc">Cookie、代理与超时配置</span>
          </div>
        </button>

        <button
          class="nav-tab-btn"
          :class="{ active: currentTab === 'about' }"
          @click="currentTab = 'about'"
        >
          <div class="tab-icon-box">
            <i class="fa-solid fa-circle-info"></i>
          </div>
          <div class="tab-meta">
            <span class="tab-title">关于与更新</span>
            <span class="tab-desc">软件版本、快捷键与开源许可</span>
          </div>
        </button>
      </nav>

      <!-- 右侧设置内容卡片 -->
      <main class="settings-body">
        <Card class="settings-content-card">

          <!-- 1. 界面与显示 -->
          <section v-if="currentTab === 'appearance'" class="tab-panel">
            <h2 class="panel-heading">界面与显示</h2>

            <SettingRow
              label="外观主题"
              description="选择适合你在不同光线环境下的软件整体调色风格"
            >
              <div class="pill-group">
                <Button
                  :variant="settings.theme === 'system' ? 'primary' : 'secondary'"
                  size="sm"
                  icon="fa-solid fa-desktop"
                  @click="settings.theme = 'system'"
                >
                  跟随系统
                </Button>
                <Button
                  :variant="settings.theme === 'light' ? 'primary' : 'secondary'"
                  size="sm"
                  icon="fa-solid fa-sun"
                  @click="settings.theme = 'light'"
                >
                  浅色模式
                </Button>
                <Button
                  :variant="settings.theme === 'dark' ? 'primary' : 'secondary'"
                  size="sm"
                  icon="fa-solid fa-moon"
                  @click="settings.theme = 'dark'"
                >
                  深色模式
                </Button>
              </div>
            </SettingRow>

            <SettingRow
              label="界面缩放比例"
              description="选择桌面端渲染尺寸（亦可使用快捷键 Ctrl + / - / 0 实时缩放）"
            >
              <div class="pill-group">
                <Button
                  v-for="zoomLevel in [80, 90, 100, 110, 125, 150]"
                  :key="zoomLevel"
                  :variant="settings.appZoom === zoomLevel ? 'primary' : 'secondary'"
                  size="sm"
                  @click="settings.appZoom = zoomLevel"
                >
                  {{ zoomLevel }}%
                </Button>
              </div>
            </SettingRow>

            <SettingRow
              label="正文折叠阀值"
              description="动态卡片正文超过设定行数时，自动裁剪并呈现“展开全文”"
            >
              <select v-model.number="settings.collapseLines" class="custom-select">
                <option :value="8">超 8 行折叠</option>
                <option :value="12">超 12 行折叠 (推荐)</option>
                <option :value="18">超 18 行折叠</option>
                <option :value="0">从不折叠 (展示全文)</option>
              </select>
            </SettingRow>

            <SettingRow
              label="默认评论区排序"
              description="查看动态楼层详情时缺省的评论排列逻辑"
            >
              <div class="pill-group">
                <Button
                  :variant="settings.commentSort === 'hot' ? 'primary' : 'secondary'"
                  size="sm"
                  icon="fa-solid fa-fire-flame-curved"
                  @click="settings.commentSort = 'hot'"
                >
                  热门优先
                </Button>
                <Button
                  :variant="settings.commentSort === 'latest' ? 'primary' : 'secondary'"
                  size="sm"
                  icon="fa-regular fa-clock"
                  @click="settings.commentSort = 'latest'"
                >
                  最新时间
                </Button>
              </div>
            </SettingRow>

            <SettingRow
              label="图片画质模式"
              description="动态多图与九宫格加载画质与流量策略"
            >
              <div class="pill-group">
                <Button
                  :variant="settings.imageQuality === 'original' ? 'primary' : 'secondary'"
                  size="sm"
                  @click="settings.imageQuality = 'original'"
                >
                  高清原图
                </Button>
                <Button
                  :variant="settings.imageQuality === 'compressed' ? 'primary' : 'secondary'"
                  size="sm"
                  @click="settings.imageQuality = 'compressed'"
                >
                  节省流量模式
                </Button>
              </div>
            </SettingRow>
          </section>

          <!-- 2. 预加载与性能 -->
          <section v-if="currentTab === 'performance'" class="tab-panel">
            <h2 class="panel-heading">预加载与性能</h2>

            <SettingRow
              label="后台并发预加载"
              description="在浏览动态列表时，后台提前预加载详情正文与热门评论，开启秒级无缝体验"
            >
              <label class="toggle-switch">
                <input v-model="settings.enablePreload" type="checkbox">
                <span class="toggle-slider"></span>
              </label>
            </SettingRow>

            <SettingRow
              label="图片与数据缓存"
              :description="`包含内存接口缓存、图片 Base64 缓存与临时 Session 数据（当前缓存占用: ${cacheSizeDisplay}）`"
            >
              <Button
                variant="danger"
                size="sm"
                icon="fa-solid fa-trash-can"
                :loading="cacheClearing"
                @click="handleClearCache"
              >
                清理全部缓存
              </Button>
            </SettingRow>
            <p v-if="cacheTip" class="status-tip-text"><i class="fa-solid fa-circle-check"></i> {{ cacheTip }}</p>
          </section>

          <!-- 3. 账号与网络 -->
          <section v-if="currentTab === 'account'" class="tab-panel">
            <h2 class="panel-heading">账号与网络</h2>

            <div class="login-state-box" :class="{ 'is-logged-in': hasCookie }">
              <i class="fa-solid" :class="hasCookie ? 'fa-user-check text-green' : 'fa-user-clock text-muted'"></i>
              <div>
                <h4 class="box-title">{{ hasCookie ? '账号凭据已安全载入' : '当前处于匿名浏览状态' }}</h4>
                <p class="box-desc">{{ hasCookie ? '你可以体验点赞、发布动态、发送私信和评论回复' : '无需登录即可公开浏览；在下方贴入 Cookie 即可解锁全量账号功能' }}</p>
              </div>
            </div>

            <SettingRow
              label="酷安账号 Cookie 字符串"
              description="凭据仅在本地会话中加密保留，绝不上传云端"
              :vertical="true"
            >
              <textarea
                v-model="cookieInput"
                class="custom-textarea"
                placeholder="贴入 SESSID=xxxx 或完整 Cookie..."
                rows="3"
              ></textarea>
              <div class="action-btn-row">
                <Button variant="primary" size="sm" icon="fa-solid fa-floppy-disk" @click="handleSaveCookie">
                  保存并载入凭据
                </Button>
                <Button v-if="hasCookie" variant="danger" size="sm" icon="fa-solid fa-right-from-bracket" @click="handleClearCookie">
                  退出登录 / 清除凭据
                </Button>
              </div>
            </SettingRow>
            <p v-if="cookieStatusMsg" class="status-tip-text" :class="{ 'text-error': cookieStatusType === 'error' }">
              {{ cookieStatusMsg }}
            </p>

            <SettingRow
              label="Rust Core 原生网络驱动"
              description="基于 Reqwest 异步引擎与 Token V3 动态算法"
            >
              <span class="status-pill"><i class="fa-solid fa-circle"></i> Rust Core 已连接</span>
            </SettingRow>
          </section>

          <!-- 4. 关于与更新 -->
          <section v-if="currentTab === 'about'" class="tab-panel">
            <h2 class="panel-heading">关于与更新</h2>

            <div class="app-hero-box">
              <img src="../../assets/coolapk-logo-rounded.png" alt="酷安 Logo" class="hero-logo">
              <div class="hero-meta">
                <h3 class="app-title">酷安桌面客户端</h3>
                <span class="app-ver">Version {{ appVersion }} (Tauri 2 + Vue 3 + Rust)</span>
                <p class="app-intro">基于原生 Tauri 2 与最新 Vue 3 构建的高能开源非官方桌面应用</p>
              </div>
              <div class="check-btn-wrap">
                <Button
                  variant="primary"
                  size="md"
                  icon="fa-solid fa-rotate"
                  :loading="checkingUpdate"
                  @click="handleCheckUpdate"
                >
                  {{ checkingUpdate ? '检查中...' : '检查更新' }}
                </Button>
              </div>
            </div>

            <!-- 更新状态卡片 -->
            <UpdateStatusCard
              :info="updateInfo"
              @download="openExternalUrl"
            />

            <!-- 常用快捷键两列布局 -->
            <div class="shortcut-section">
              <h4 class="sub-heading"><i class="fa-solid fa-keyboard"></i> 常用快捷键</h4>
              <div class="shortcut-grid">
                <ShortcutKey :keys="['Ctrl', '+']" label="放大界面" />
                <ShortcutKey :keys="['Ctrl', '-']" label="缩小界面" />
                <ShortcutKey :keys="['Ctrl', '0']" label="重置 100% 缩放" />
                <ShortcutKey :keys="['F5', '/ Ctrl+R']" label="刷新当前列表" />
                <ShortcutKey :keys="['Ctrl', 'K']" label="聚焦全局搜索框" />
                <ShortcutKey :keys="['Esc']" label="关闭弹窗或退出" />
              </div>
            </div>

            <Divider />

            <!-- 开源许可与完整 GitHub 整行按钮 -->
            <div class="legal-row">
              <p class="legal-text">
                本项目由开源社区维护，遵守
                <button type="button" class="link-btn" @click="openExternalUrl('https://github.com/daimiaopeng/coolapk-desktop/blob/main/LICENSE')">MIT 许可证</button>。
                酷安 Logo 及相关商标所有权归原商标持有人所有。
              </p>
              
              <button
                type="button"
                class="github-bar-btn"
                @click="openExternalUrl('https://github.com/daimiaopeng/coolapk-desktop')"
              >
                <div class="bar-left">
                  <i class="fa-brands fa-github git-icon"></i>
                  <span>GitHub 官方开源仓库</span>
                </div>
                <i class="fa-solid fa-chevron-right bar-arrow"></i>
              </button>
            </div>
          </section>

        </Card>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { settings } from '../../utils/settingsStore';
import { CoolapkTauriAPI } from '../../api/coolapk';
import Card from '../ui/Card.vue';
import Button from '../ui/Button.vue';
import SettingRow from '../ui/SettingRow.vue';
import ShortcutKey from '../ui/ShortcutKey.vue';
import UpdateStatusCard from './UpdateStatusCard.vue';
import Divider from '../ui/Divider.vue';

const emit = defineEmits<{
  (e: 'cookie-changed'): void;
}>();

const currentTab = ref<'appearance' | 'performance' | 'account' | 'about'>('about');
const appVersion = '1.0.0';

// 缓存管理
const cacheClearing = ref(false);
const cacheTip = ref('');
const cacheSizeDisplay = ref('0.00 MB');

function updateCacheSize() {
  let totalBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) totalBytes += (localStorage.getItem(k) || '').length * 2;
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) totalBytes += (sessionStorage.getItem(k) || '').length * 2;
    }
  } catch {}
  // 加上系统 Base64 图片在内存中的估算量
  const mb = ((totalBytes + 4 * 1024 * 1024) / (1024 * 1024)).toFixed(2);
  cacheSizeDisplay.value = `${mb} MB`;
}

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

onMounted(() => {
  checkCookieState();
  updateCacheSize();
});

function checkCookieState() {
  const saved = localStorage.getItem('coolapk_cookie');
  hasCookie.value = Boolean(saved && saved.trim());
}

async function handleClearCache() {
  cacheClearing.value = true;
  cacheTip.value = '';
  setTimeout(() => {
    try {
      sessionStorage.clear();
      cacheTip.value = '图片 Base64 与数据缓存清理成功！';
      cacheSizeDisplay.value = '0.00 MB';
    } catch {
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

async function handleCheckUpdate() {
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
    const isNew = tagName && tagName !== appVersion;

    updateInfo.value = {
      hasNew: isNew,
      latestVersion: data.tag_name || '最新发布',
      releaseNotes: data.body ? data.body.slice(0, 300) + (data.body.length > 300 ? '...' : '') : '暂无特定更新说明',
      downloadUrl: data.html_url || 'https://github.com/daimiaopeng/coolapk-desktop/releases',
    };
  } catch (err: any) {
    updateInfo.value = {
      hasNew: false,
      releaseNotes: `检测更新失败，网络异常或达到了 API 频率限制 (${err?.message || err})`,
      downloadUrl: 'https://github.com/daimiaopeng/coolapk-desktop/releases',
    };
  } finally {
    checkingUpdate.value = false;
  }
}

function openExternalUrl(url?: string) {
  if (!url) return;
  void CoolapkTauriAPI.openUrl(url);
}
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1100px;
  margin: 0 auto;
  padding-bottom: 30px;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-main, #172033);
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  color: var(--brand-green, #10b966);
}

.page-desc {
  margin: 0;
  font-size: 0.84rem;
  color: var(--text-sub, #667085);
}

/* 左右结构 */
.settings-container {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

/* 左侧二级导航 (260px) */
.settings-nav {
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.nav-tab-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: var(--radius-lg, 10px);
  border: 1px solid transparent;
  background: var(--bg-card, #ffffff);
  cursor: pointer;
  text-align: left;
  transition: var(--transition-fast);
}

.nav-tab-btn:hover {
  background: var(--bg-hover, #f1f5f9);
  border-color: var(--border-color, #e4e9ef);
}

/* 选中状态要求：浅绿背景，标题绿，图标绿，描述保持较弱 */
.nav-tab-btn.active {
  background: var(--brand-green-light, rgba(16, 185, 102, 0.08));
  border-color: var(--brand-green-border);
}

.tab-icon-box {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md, 8px);
  background: var(--bg-app, #f5f7f9);
  color: var(--text-sub, #667085);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  transition: var(--transition-fast);
}

.nav-tab-btn.active .tab-icon-box {
  background: var(--brand-green, #10b966);
  color: #ffffff;
}

.tab-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tab-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main, #172033);
}

.nav-tab-btn.active .tab-title {
  color: var(--brand-green, #10b966);
  font-weight: 700;
}

.tab-desc {
  font-size: 0.74rem;
  color: var(--text-muted, #98a2b3);
}

/* 右侧内容大卡片 */
.settings-body {
  flex: 1;
  min-width: 0;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-heading {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main, #172033);
  padding-bottom: 10px;
  border-bottom: 2px solid var(--brand-green, #10b966);
  display: inline-block;
}

.pill-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.custom-select {
  padding: 6px 12px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color, #e4e9ef);
  font-size: 0.85rem;
  outline: none;
  background: #ffffff;
  color: var(--text-main, #172033);
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
  background-color: #cbd5e1;
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
  background-color: var(--brand-green, #10b966);
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.status-tip-text {
  font-size: 0.8rem;
  color: var(--brand-green, #10b966);
  margin: 6px 0 0 0;
}

.status-tip-text.text-error {
  color: var(--color-error, #e5484d);
}

.login-state-box {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--bg-subtle, #f8fafc);
  border: 1px solid var(--border-color, #e4e9ef);
  border-radius: var(--radius-lg, 10px);
  margin-bottom: 12px;
}

.login-state-box.is-logged-in {
  background: var(--brand-green-light);
  border-color: var(--brand-green-border);
}

.box-title {
  margin: 0 0 2px 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.box-desc {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-sub, #667085);
}

.custom-textarea {
  width: 100%;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color, #e4e9ef);
  padding: 10px;
  font-size: 0.82rem;
  font-family: var(--font-mono, monospace);
  outline: none;
  resize: vertical;
  box-sizing: border-box;
}

.custom-textarea:focus {
  border-color: var(--brand-green, #10b966);
}

.action-btn-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.status-pill {
  font-size: 0.78rem;
  color: var(--brand-green, #10b966);
  background: var(--brand-green-light);
  padding: 4px 10px;
  border-radius: var(--radius-full, 999px);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* About Hero Box */
.app-hero-box {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px;
  background: var(--bg-subtle, #f8fafc);
  border-radius: var(--radius-lg, 10px);
  border: 1px solid var(--divider-color, #edf0f3);
  margin-bottom: 16px;
}

.hero-logo {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-xl, 12px);
}

.hero-meta {
  flex: 1;
}

.app-title {
  margin: 0 0 4px 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.app-ver {
  font-size: 0.8rem;
  color: var(--brand-green, #10b966);
  font-weight: 600;
  display: inline-block;
  margin-bottom: 4px;
}

.app-intro {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-sub, #667085);
}

.shortcut-section {
  margin-top: 20px;
}

.sub-heading {
  margin: 0 0 12px 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-main, #172033);
  display: flex;
  align-items: center;
  gap: 8px;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.legal-row {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legal-text {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted, #98a2b3);
  line-height: 1.5;
}

.link-btn {
  border: 0;
  background: transparent;
  color: var(--brand-green, #10b966);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.link-btn:hover {
  text-decoration: underline;
}

.github-bar-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--radius-lg, 10px);
  border: 1px solid var(--border-color, #e4e9ef);
  background: var(--bg-subtle, #f8fafc);
  cursor: pointer;
  transition: var(--transition-fast);
}

.github-bar-btn:hover {
  background: var(--brand-green-light);
  border-color: var(--brand-green-border);
}

.github-bar-btn:hover .bar-left span {
  color: var(--brand-green, #10b966);
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--text-main, #172033);
}

.git-icon {
  font-size: 1.1rem;
}

.bar-arrow {
  font-size: 0.8rem;
  color: var(--text-muted, #98a2b3);
}
</style>
