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

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">时间显示格式</span>
          <span class="row-sub">动态时间展示为“X 分钟前”或完整日期时间</span>
        </div>
        <select v-model="settingsStore.settings.timeDisplay" class="select-control">
          <option value="relative">相对时间 (推荐)</option>
          <option value="absolute">绝对时间 (yyyy-MM-dd HH:mm)</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">图片点击打开方式</span>
          <span class="row-sub">点击图片时使用内置查看器，或交给系统默认图片查看器</span>
        </div>
        <select v-model="settingsStore.settings.imageOpenMode" class="select-control">
          <option value="internal">内置查看器 (推荐)</option>
          <option value="system">系统默认查看器</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">Live 图片自动播放声音</span>
          <span class="row-sub">打开 Live 图片时自动播放原声；关闭后默认静音，可在查看器中手动开启</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.autoPlayLivePhotoSound" />
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">不再提醒 Live 图片编码问题</span>
          <span class="row-sub">关闭后仍保留静态封面，可在此处重新开启提示</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.suppressUnsupportedLivePhotoCodecPrompt" />
      </div>

      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">打开图片自动加载原图</span>
          <span class="row-sub">进入内置图片查看器时直接加载原图，可能增加等待时间和流量消耗</span>
        </div>
        <AppSwitch v-model="settingsStore.settings.autoLoadOriginalImage" />
      </div>
    </div>

    <div class="setting-group">
      <h4 class="group-title">关键词屏蔽</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">屏蔽关键词</span>
          <span class="row-sub">正文或标题包含任一关键词的动态，将不在时间线中显示</span>
        </div>
      </div>
      <div class="keyword-input-row">
        <input
          v-model="keywordInput"
          type="text"
          class="text-input"
          placeholder="输入要屏蔽的关键词，回车或点击添加"
          @keydown.enter.prevent="addKeyword"
        />
        <AppButton variant="secondary" size="sm" @click="addKeyword">添加</AppButton>
      </div>
      <div v-if="blockedKeywords.length > 0" class="keyword-chips">
        <span v-for="kw in blockedKeywords" :key="kw" class="keyword-chip">
          <span class="chip-text">{{ kw }}</span>
          <button class="chip-remove" type="button" title="移除" @click="removeKeyword(kw)">
            <i class="fas fa-times"></i>
          </button>
        </span>
      </div>
      <p v-else class="tray-tip">
        <i class="fas fa-info-circle"></i>
        暂无屏蔽关键词，添加后可过滤不想看到的动态（如“广告”、“抽奖”等）。
      </p>
    </div>

    <div class="setting-group">
      <h4 class="group-title">链接</h4>
      <div class="setting-row">
        <div class="row-info">
          <span class="row-label">外部链接打开方式</span>
          <span class="row-sub">点击站外链接时在应用内新窗口浏览，或调用系统浏览器</span>
        </div>
        <select v-model="settingsStore.settings.externalLinkMode" class="select-control">
          <option value="internal">应用内新窗口 (推荐)</option>
          <option value="system">系统浏览器</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import AppSwitch from '../../components/common/AppSwitch.vue';
import AppButton from '../../components/common/AppButton.vue';

const settingsStore = useSettingsStore();
const keywordInput = ref('');

const blockedKeywords = computed(() => settingsStore.settings.blockedKeywords);

function addKeyword() {
  const kw = keywordInput.value.trim();
  if (!kw) return;
  if (!settingsStore.settings.blockedKeywords.includes(kw)) {
    settingsStore.settings.blockedKeywords = [...settingsStore.settings.blockedKeywords, kw];
  }
  keywordInput.value = '';
}

function removeKeyword(kw: string) {
  settingsStore.settings.blockedKeywords = settingsStore.settings.blockedKeywords.filter(
    (k) => k !== kw
  );
}
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

.text-input {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 6px 12px;
  font-size: var(--font-size-sub);
  color: var(--text-primary);
  outline: none;
  flex: 1;
  min-width: 0;
  transition: border-color var(--duration-fast) var(--ease-default);
}

.text-input:hover,
.text-input:focus {
  border-color: var(--brand-primary);
}

.keyword-input-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.keyword-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.keyword-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 12px;
  border-radius: var(--radius-pill);
  background-color: var(--brand-soft);
  border: 1px solid var(--brand-green-border);
  color: var(--brand-primary);
  font-size: var(--font-size-sub);
}

.chip-text {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--brand-primary);
  font-size: 11px;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-default);
}

.chip-remove:hover {
  background-color: var(--brand-soft-hover);
}

.tray-tip {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

</style>
