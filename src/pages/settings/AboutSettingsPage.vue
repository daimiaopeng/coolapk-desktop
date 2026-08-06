<template>
  <div class="settings-section">
    <h3 class="section-title">关于酷安桌面版</h3>

    <!-- 应用信息 -->
    <div class="setting-group">
      <div class="about-head">
        <img src="../../assets/coolapk-logo-rounded.png" alt="酷安 Logo" class="about-logo" />
        <div class="about-info">
          <div class="about-name-row">
            <span class="about-name">酷安桌面版</span>
            <span class="about-version">v{{ appVersion }}</span>
            <span class="about-channel">{{ channelLabel }}</span>
          </div>
          <p class="about-desc">
            基于 Tauri 2、Vue 3 与 Rust 构建的非官方酷安桌面客户端，数据来自酷安公开接口。
          </p>
        </div>
        <AppButton variant="secondary" size="sm" icon="fas fa-sync-alt" @click="checkUpdate">
          检查更新
        </AppButton>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">技术栈</span>
          <span class="row-sub">Tauri 2 · Vue 3 · TypeScript · Rust · Pinia</span>
        </div>
        <div class="tech-badges">
          <span v-for="t in techStack" :key="t" class="tech-badge">{{ t }}</span>
        </div>
      </div>

      <div v-if="repoStats" class="setting-row">
        <div class="row-info">
          <span class="row-label">社区数据</span>
          <span class="row-sub">数据来自 GitHub API</span>
        </div>
        <div class="repo-stats">
          <span class="repo-stat"><i class="fas fa-star"></i> {{ formatCount(repoStats.stars) }}</span>
          <span class="repo-stat"><i class="fas fa-code-branch"></i> {{ formatCount(repoStats.forks) }}</span>
          <span class="repo-stat"><i class="fas fa-exclamation-circle"></i> {{ formatCount(repoStats.issues) }}</span>
        </div>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">开源协议</span>
          <span class="row-sub">MIT License · 第三方非官方客户端</span>
        </div>
        <span class="license-badge">MIT</span>
      </div>
    </div>

    <!-- 联系与支持 -->
    <div class="setting-group">
      <h4 class="group-title">联系与支持</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">项目主页</span>
          <span class="row-sub">GitHub 仓库 · 源码与 Release</span>
        </div>
        <AppIconButton icon="fas fa-arrow-up-right-from-square" size="sm" title="打开项目主页" @click="open('https://github.com/daimiaopeng/coolapk-desktop')" />
      </div>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">反馈问题</span>
          <span class="row-sub">提交 Bug 或功能建议</span>
        </div>
        <AppIconButton icon="fas fa-bug" size="sm" title="打开反馈页面" @click="open('https://github.com/daimiaopeng/coolapk-desktop/issues')" />
      </div>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">联系作者</span>
          <span class="row-sub">daimiaopeng · GitHub</span>
        </div>
        <AppIconButton icon="fas fa-user" size="sm" title="打开作者主页" @click="open('https://github.com/daimiaopeng')" />
      </div>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">邮箱</span>
          <span class="row-sub">daimiaopeng@gmail.com</span>
        </div>
        <AppIconButton icon="fas fa-envelope" size="sm" title="发送邮件" @click="open('mailto:daimiaopeng@gmail.com')" />
      </div>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">酷安主页</span>
          <span class="row-sub">oxygen的喵 · 酷友交流</span>
        </div>
        <AppIconButton icon="fas fa-smile" size="sm" title="打开酷安主页" @click="open('https://www.coolapk.com/u/oxygen%E7%9A%84%E5%96%B5')" />
      </div>
    </div>

    <p class="copyright">© 2026 daimiaopeng · MIT License</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { APP_VERSION } from '../../constants/version';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useSettingsStore } from '../../stores/settings';
import AppButton from '../../components/common/AppButton.vue';
import AppIconButton from '../../components/common/AppIconButton.vue';

const appVersion = APP_VERSION;
const settingsStore = useSettingsStore();

const channelLabel = settingsStore.settings.updateChannel === 'beta' ? '测试版渠道' : '稳定版';

const techStack = ['Tauri 2', 'Vue 3', 'TypeScript', 'Rust', 'Pinia'];

type RepoStats = { stars: number; forks: number; issues: number };
const repoStats = ref<RepoStats | null>(null);

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function open(url: string) {
  void CoolapkTauriAPI.openUrl(url, 'system');
}

function checkUpdate() {
  window.dispatchEvent(new Event('check-for-update'));
}

onMounted(() => {
  fetch('https://api.github.com/repos/daimiaopeng/coolapk-desktop', {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: any) => {
      if (data && typeof data.stargazers_count === 'number') {
        repoStats.value = {
          stars: data.stargazers_count,
          forks: data.forks_count ?? 0,
          issues: data.open_issues_count ?? 0,
        };
      }
    })
    .catch(() => {
      // 网络不可用时隐藏社区数据行
    });
});
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 720px;
}

.section-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-3);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.group-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-light);
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-label {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.row-sub {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

/* 应用信息头 */
.about-head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0 var(--space-5);
  border-bottom: 1px solid var(--border-light);
}

.about-logo {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
}

.about-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.about-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.about-name {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.about-version {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  border: 1px solid var(--brand-green-border);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
}

.about-channel {
  font-size: 11px;
  color: var(--text-tertiary);
  background-color: var(--background);
  border: 1px solid var(--border);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
}

.about-desc {
  margin: 0;
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  line-height: 1.6;
}

/* 技术栈与社区数据 */
.tech-badges {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tech-badge {
  font-size: 11px;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-green-border);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-weight: var(--font-weight-medium);
}

.repo-stats {
  display: flex;
  gap: var(--space-3);
}

.repo-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.repo-stat i {
  font-size: 12px;
  color: var(--brand-primary);
}

.license-badge {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  background-color: var(--background);
  border: 1px solid var(--border);
  padding: 2px 12px;
  border-radius: var(--radius-pill);
}

/* 链接行（与其他 setting-row 观感一致） */
.copyright {
  margin: 0;
  text-align: center;
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  padding: var(--space-2) 0 var(--space-4);
}
</style>
