<template>
  <div class="settings-section">
    <h3 class="section-title">内容偏好设置</h3>

    <div class="setting-group">
      <h4 class="group-title">正文与列表</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">正文折叠阈值</span>
          <span class="row-sub">列表卡片正文超过设置行数时自动显示“展开全文”按钮</span>
        </div>
        <select v-model.number="settingsStore.settings.collapseLines" class="select-control">
          <option :value="8">超 8 行折叠</option>
          <option :value="12">超 12 行折叠 (推荐)</option>
          <option :value="18">超 18 行折叠</option>
          <option :value="0">从不折叠 (展示全部正文)</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">卡片展开评论 (行内评论)</span>
          <span class="row-sub">在列表卡片下方直接展开评论，默认使用右侧抽屉展现</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.inlineComments" />
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">无限滚动</span>
          <span class="row-sub">滚动到底部时自动加载下一页动态</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.infiniteScroll" />
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">评论区</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">默认评论排序</span>
          <span class="row-sub">加载评论楼层时缺省的排列顺序</span>
        </div>
        <div class="pill-group">
          <button
            class="pill-btn"
            :class="{ 'is-active': settingsStore.settings.commentSort === 'hot' }"
            @click="settingsStore.settings.commentSort = 'hot'"
          >
            <i class="fas fa-fire"></i> 热门优先
          </button>
          <button
            class="pill-btn"
            :class="{ 'is-active': settingsStore.settings.commentSort === 'latest' }"
            @click="settingsStore.settings.commentSort = 'latest'"
          >
            <i class="far fa-clock"></i> 最新时间
          </button>
        </div>
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">动态展示</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">动图自动播放</span>
          <span class="row-sub">关闭后列表中的 GIF 动图将不加载，节省流量</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.autoPlayGif" />
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">显示发帖设备信息</span>
          <span class="row-sub">在动态头部展示作者使用的设备型号</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.showDeviceInfo" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../../stores/settings';
import AppSwitch from '../../components/common/AppSwitch.vue';

const settingsStore = useSettingsStore();
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
  gap: var(--space-3);
}

.group-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-light);
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.select-control {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 6px 12px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.select-control:hover {
  border-color: var(--brand-primary);
}

.pill-group {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.pill-btn:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.pill-btn.is-active {
  background: var(--brand-soft);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}
</style>
