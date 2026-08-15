<template>
  <div class="discovery-skeleton">
    <!-- 1. 热门专区骨架 (4列自适应网格) -->
    <div class="skeleton-section">
      <div class="skeleton-title-bar">
        <div class="skeleton-line title-line"></div>
        <div class="skeleton-line more-line"></div>
      </div>
      <div class="skeleton-grid">
        <div v-for="i in 8" :key="i" class="skeleton-topic-card">
          <div class="skeleton-box topic-avatar"></div>
          <div class="skeleton-meta">
            <div class="skeleton-line topic-title"></div>
            <div class="skeleton-line topic-sub"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 精美 Banner 骨架 -->
    <div class="skeleton-banner"></div>

    <!-- 3. Pill 胶囊标签骨架 -->
    <div class="skeleton-pills">
      <div v-for="i in 7" :key="i" class="skeleton-pill"></div>
    </div>

    <!-- 4. 动态流骨架 -->
    <div class="skeleton-feeds">
      <div v-for="i in 2" :key="i" class="skeleton-feed-card">
        <div class="feed-header">
          <div class="skeleton-box feed-avatar"></div>
          <div class="skeleton-meta">
            <div class="skeleton-line feed-user"></div>
            <div class="skeleton-line feed-time"></div>
          </div>
        </div>
        <div class="skeleton-line line-full"></div>
        <div class="skeleton-line line-sub"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'DiscoverySkeleton' });
</script>

<style scoped>
.discovery-skeleton {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.skeleton-section,
.skeleton-feed-card {
  background: var(--surface);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: var(--radius-card, 12px);
}

.skeleton-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px 10px;
}

.title-line { width: 80px; height: 16px; }
.more-line { width: 40px; height: 14px; }

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 4px 14px 14px;
}

.skeleton-topic-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.06));
  border-radius: var(--radius-card, 12px);
  background: var(--surface);
}

.topic-avatar {
  width: 50px;
  height: 50px;
  flex: 0 0 50px;
  border-radius: 10px;
}

.skeleton-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.topic-title { width: 65%; height: 14px; }
.topic-sub { width: 40%; height: 11px; }

.skeleton-banner {
  height: clamp(140px, 13vw, 180px);
  border-radius: var(--radius-card, 14px);
  position: relative;
  overflow: hidden;
  background-color: var(--background-secondary, #eef1f4);
}

.skeleton-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 2px 0;
}

.skeleton-pill {
  width: 72px;
  height: 32px;
  border-radius: var(--radius-pill, 9999px);
  position: relative;
  overflow: hidden;
  background-color: var(--background-secondary, #eef1f4);
}

.skeleton-feeds {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skeleton-feed-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feed-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feed-avatar {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 50%;
}

.feed-user { width: 100px; height: 14px; }
.feed-time { width: 60px; height: 11px; }
.line-full { width: 100%; height: 14px; }
.line-sub { width: 60%; height: 14px; }

.skeleton-box,
.skeleton-line {
  position: relative;
  overflow: hidden;
  background-color: var(--background-secondary, #eef1f4);
  border-radius: 4px;
}

.skeleton-box::after,
.skeleton-line::after,
.skeleton-banner::after,
.skeleton-pill::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0.4) 20%,
    rgba(255, 255, 255, 0.7) 60%,
    rgba(255, 255, 255, 0)
  );
  animation: skeleton-shimmer 1.6s infinite ease-in-out;
}

@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 1180px) {
  .skeleton-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .skeleton-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
