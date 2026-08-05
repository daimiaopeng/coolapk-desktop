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
    </div>
  </div>
</template>

<script setup lang="ts">
import { APP_VERSION } from '../../constants/version';

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
</style>
