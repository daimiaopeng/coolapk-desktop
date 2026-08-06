<template>
  <div class="settings-section">
    <h3 class="section-title">关于酷安桌面版</h3>

    <div class="about-card">
      <img src="../../assets/coolapk-logo-rounded.png" alt="Logo" class="about-logo" />
      <h4 class="app-name">酷安</h4>
      <span class="app-ver">Version {{ appVersion }} (Tauri 2 Core)</span>
      <p class="app-desc">基于 Tauri 2、Vue 3、TypeScript 与 Rust 构建的第三方酷安桌面客户端。</p>

      <div class="tech-stack-list">
        <span class="tech-badge">Tauri 2</span>
        <span class="tech-badge">Vue 3</span>
        <span class="tech-badge">TypeScript</span>
        <span class="tech-badge">Rust Core</span>
        <span class="tech-badge">Token V3</span>
        <span class="tech-badge">Pinia</span>
      </div>

      <div class="links-list">
        <button
          class="link-item"
          type="button"
          @click="CoolapkTauriAPI.openUrl('https://github.com/daimiaopeng/coolapk-desktop')"
        >
          <i class="fas fa-code-branch"></i>
          <span>项目主页</span>
          <i class="fas fa-chevron-right link-arrow"></i>
        </button>
        <button
          class="link-item"
          type="button"
          @click="CoolapkTauriAPI.openUrl('https://github.com/daimiaopeng/coolapk-desktop/issues')"
        >
          <i class="fas fa-bug"></i>
          <span>反馈问题</span>
          <i class="fas fa-chevron-right link-arrow"></i>
        </button>
        <button
          class="link-item"
          type="button"
          @click="CoolapkTauriAPI.openUrl('https://github.com/daimiaopeng')"
        >
          <i class="fas fa-user"></i>
          <span>联系作者</span>
          <i class="fas fa-chevron-right link-arrow"></i>
        </button>
        <button
          class="link-item"
          type="button"
          @click="CoolapkTauriAPI.openUrl('mailto:daimiaopeng@gmail.com')"
        >
          <i class="fas fa-envelope"></i>
          <span>邮箱：daimiaopeng@gmail.com</span>
          <i class="fas fa-chevron-right link-arrow"></i>
        </button>
        <button
          class="link-item"
          type="button"
          @click="CoolapkTauriAPI.openUrl('https://www.coolapk.com/u/oxygen%E7%9A%84%E5%96%B5')"
        >
          <i class="fas fa-smile"></i>
          <span>酷安：oxygen的喵</span>
          <i class="fas fa-chevron-right link-arrow"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { APP_VERSION } from '../../constants/version';
import { CoolapkTauriAPI } from '../../api/coolapk';

const appVersion = APP_VERSION;
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);

  border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-3);
}

.about-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-8);
  background-color: var(--background);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
}

.about-logo {
  width: 64px;
  height: 64px;
  margin-bottom: var(--space-3);
}

.app-name {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.app-ver {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
}

.app-desc {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  max-width: 420px;
  line-height: var(--line-height-sub);
  margin-bottom: var(--space-4);
}

.tech-stack-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
}

.tech-badge {
  font-size: 11px;
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-weight: var(--font-weight-medium);
}

.links-list {
  width: 100%;
  max-width: 420px;
  margin-top: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.link-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.link-item:hover {
  background-color: var(--brand-soft);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.link-item i:first-child {
  width: 16px;
  color: var(--brand-primary);
}

.link-item span {
  flex: 1;
}

.link-arrow {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
