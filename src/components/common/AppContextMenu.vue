<template>
  <Teleport to="body">
    <div
      v-if="menu"
      class="app-context-menu"
      :style="menuStyle"
      role="menu"
      @contextmenu.prevent
      @mousedown.stop
    >
      <template v-for="(item, index) in menu.items" :key="item.id">
        <div v-if="item.separator" class="context-menu-separator"></div>
        <button
          v-else
          type="button"
          class="context-menu-item"
          :class="{ 'is-danger': item.danger, 'is-disabled': item.disabled }"
          :disabled="item.disabled"
          role="menuitem"
          @click.stop="run(item)"
        >
          <i :class="item.icon"></i>
          <span>{{ item.label }}</span>
          <kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../../stores/app';
import { useSettingsStore } from '../../stores/settings';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { openFeedDetail } from '../../utils/feedNavigation';
import { showToast } from '../../utils/toast';
import { getOriginalImageUrl } from '../../utils/image';

type ContextKind = 'page' | 'selection' | 'link' | 'image' | 'comment' | 'feed';

type ContextState = {
  x: number;
  y: number;
  kind: ContextKind;
  selectedText: string;
  linkUrl: string;
  linkText: string;
  imageUrl: string;
  imageUrls: string[];
  feedId: string;
  feedText: string;
  feedUrl: string;
  commentId: string;
  commentUsername: string;
  commentText: string;
};

type MenuItem = {
  id: string;
  label?: string;
  icon?: string;
  shortcut?: string;
  separator?: boolean;
  danger?: boolean;
  disabled?: boolean;
  action?: () => void | Promise<unknown>;
};

type MenuData = ContextState & { items: MenuItem[] };

const router = useRouter();
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const menu = ref<MenuData | null>(null);

const menuStyle = computed(() => ({
  left: `${menu.value?.x || 0}px`,
  top: `${menu.value?.y || 0}px`,
}));

function selectedText(): string {
  return window.getSelection?.()?.toString().trim() || '';
}

function parseImageUrls(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === 'string' && url.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function getImageUrl(element: HTMLElement): string {
  const carrier = element.closest<HTMLElement>('[data-context-image-url]');
  if (carrier?.dataset.contextImageUrl) return carrier.dataset.contextImageUrl;
  const image = element.closest('img') as HTMLImageElement | null;
  return image?.dataset.originalUrl || image?.currentSrc || image?.src || '';
}

function buildContext(event: MouseEvent): ContextState | null {
  const element = event.target instanceof HTMLElement ? event.target : null;
  if (!element) return null;
  if (element.closest('.app-context-menu')) return null;

  const text = selectedText();
  const interactive = element.closest('input, textarea, select, [contenteditable="true"]');
  if (interactive && !text) return null;

  const comment = element.closest<HTMLElement>('[data-context-kind="comment"]');
  if (comment && !element.closest('img, [data-context-image-url]')) {
    return {
      x: event.clientX,
      y: event.clientY,
      kind: 'comment',
      selectedText: text,
      linkUrl: '',
      linkText: '',
      imageUrl: '',
      imageUrls: [],
      feedId: comment.dataset.contextFeedId || '',
      feedText: '',
      feedUrl: '',
      commentId: comment.dataset.contextCommentId || '',
      commentUsername: comment.dataset.commentUsername || '',
      commentText: comment.dataset.commentText || element.textContent?.trim() || '',
    };
  }

  const imageUrl = getImageUrl(element);
  if (imageUrl && (element.closest('img') || element.closest('[data-context-image-url]'))) {
    return {
      x: event.clientX,
      y: event.clientY,
      kind: 'image',
      selectedText: text,
      linkUrl: '',
      linkText: '',
      imageUrl,
      imageUrls: [],
      feedId: '',
      feedText: '',
      feedUrl: '',
      commentId: '',
      commentUsername: '',
      commentText: '',
    };
  }

  const link = element.closest<HTMLAnchorElement>('a[href]');
  if (link && link.href) {
    return {
      x: event.clientX,
      y: event.clientY,
      kind: 'link',
      selectedText: text,
      linkUrl: link.href,
      linkText: link.textContent?.trim() || link.href,
      imageUrl: '',
      imageUrls: [],
      feedId: '',
      feedText: '',
      feedUrl: '',
      commentId: '',
      commentUsername: '',
      commentText: '',
    };
  }

  if (text) {
    return {
      x: event.clientX,
      y: event.clientY,
      kind: 'selection',
      selectedText: text,
      linkUrl: '',
      linkText: '',
      imageUrl: '',
      imageUrls: [],
      feedId: '',
      feedText: '',
      feedUrl: '',
      commentId: '',
      commentUsername: '',
      commentText: '',
    };
  }

  const feed = element.closest<HTMLElement>('[data-feed-id]');
  if (feed?.dataset.feedId) {
    const feedId = feed.dataset.feedId;
    return {
      x: event.clientX,
      y: event.clientY,
      kind: 'feed',
      selectedText: '',
      linkUrl: '',
      linkText: '',
      imageUrl: '',
      imageUrls: parseImageUrls(feed.dataset.feedImages || ''),
      feedId,
      feedText: feed.dataset.feedText || feed.querySelector('.feed-body')?.textContent?.trim() || '',
      feedUrl: `https://www.coolapk.com/feed/${encodeURIComponent(feedId)}`,
      commentId: '',
      commentUsername: '',
      commentText: '',
    };
  }

  return {
    x: event.clientX,
    y: event.clientY,
    kind: 'page',
    selectedText: '',
    linkUrl: '',
    linkText: '',
    imageUrl: '',
    imageUrls: [],
    feedId: '',
    feedText: '',
    feedUrl: '',
    commentId: '',
    commentUsername: '',
    commentText: '',
  };
}

function item(id: string, label: string, icon: string, action: () => void | Promise<unknown>, extra: Partial<MenuItem> = {}): MenuItem {
  return { id, label, icon, action, ...extra };
}

function separator(id: string): MenuItem {
  return { id, separator: true };
}

function createItems(state: ContextState): MenuItem[] {
  if (state.kind === 'comment') {
    return [
      item('reply-comment', '回复评论', 'fas fa-reply', () => replyComment(state)),
      item('copy-comment', '复制评论', 'far fa-copy', () => copyText(state.commentText)),
    ];
  }

  if (state.kind === 'image') {
    return [
      item('view-image', '查看大图', 'fas fa-expand', () => appStore.openImageViewer([state.imageUrl])),
      item('view-original', '查看原图', 'fas fa-file-image', () => appStore.openImageViewer([state.imageUrl])),
      separator('image-separator'),
      item('save-image', '保存图片', 'fas fa-download', () => saveImage(state.imageUrl)),
      item('copy-image', '复制图片', 'far fa-copy', () => copyImage(state.imageUrl)),
      item('copy-image-url', '复制图片地址', 'fas fa-link', () => copyText(state.imageUrl)),
      item('open-image-system', '使用系统程序打开', 'fas fa-external-link-alt', () => CoolapkTauriAPI.openUrl(state.imageUrl, 'system')),
    ];
  }

  if (state.kind === 'link') {
    return [
      item('open-link-app', '在应用内打开', 'fas fa-window-maximize', () => openLink(state.linkUrl)),
      item('open-link-system', '使用系统浏览器打开', 'fas fa-external-link-alt', () => CoolapkTauriAPI.openUrl(state.linkUrl, 'system')),
      item('copy-link', '复制链接地址', 'fas fa-link', () => copyText(state.linkUrl)),
      separator('link-separator'),
      item('search-link-text', '搜索链接文字', 'fas fa-search', () => searchInApp(state.linkText), { disabled: !state.linkText }),
    ];
  }

  if (state.kind === 'selection') {
    return [
      item('copy-selection', '复制选中文字', 'far fa-copy', () => copyText(state.selectedText), { shortcut: 'Ctrl+C' }),
      item('search-selection-app', '在酷安内搜索', 'fas fa-search', () => searchInApp(state.selectedText)),
      item('search-selection-system', '在浏览器中搜索', 'fas fa-globe', () => searchInSystem(state.selectedText)),
      item('copy-selection-markdown', '复制为 Markdown', 'fab fa-markdown', () => copyText(state.selectedText)),
    ];
  }

  if (state.kind === 'feed') {
    return [
      item('open-feed', '打开动态详情', 'far fa-file-alt', () => openFeedDetail(router, state.feedId)),
      item('copy-feed-text', '复制动态正文', 'far fa-copy', () => copyText(state.feedText)),
      item('copy-feed-link', '复制动态链接', 'fas fa-link', () => copyText(state.feedUrl)),
      item('share-feed', '分享动态', 'fas fa-share-alt', () => shareText(state.feedUrl)),
      separator('feed-image-separator'),
      item('save-feed-images', `一键保存全部原图（${state.imageUrls.length}张）`, 'fas fa-images', () => saveAllImages(state.imageUrls), { disabled: state.imageUrls.length === 0 }),
    ];
  }

  const density = settingsStore.settings.density;
  const nextDensity = density === 'compact' ? 'comfortable' : density === 'comfortable' ? 'standard' : 'compact';
  const fontSize = settingsStore.settings.fontSize || 15;
  return [
    item('back', '返回', 'fas fa-arrow-left', () => router.back(), { shortcut: 'Alt+←' }),
    item('forward', '前进', 'fas fa-arrow-right', () => router.go(1), { shortcut: 'Alt+→' }),
    item('refresh', '刷新页面', 'fas fa-sync-alt', () => window.location.reload(), { shortcut: 'Ctrl+R' }),
    separator('page-separator-1'),
    item('scroll-top', '返回顶部', 'fas fa-arrow-up', () => scrollToTop()),
    item('toggle-sidebar', settingsStore.settings.sidebarCollapsed ? '显示侧边栏' : '隐藏侧边栏', 'fas fa-columns', () => settingsStore.toggleSidebar()),
    item('toggle-theme', document.documentElement.getAttribute('data-theme') === 'dark' ? '切换日间模式' : '切换夜间模式', 'fas fa-moon', () => toggleTheme()),
    item('toggle-density', `切换布局密度（${nextDensity === 'compact' ? '紧凑' : nextDensity === 'comfortable' ? '舒适' : '标准'}）`, 'fas fa-compress-arrows-alt', () => setDensity(nextDensity)),
    item('font-smaller', '减小字体', 'fas fa-font', () => adjustFontSize(-1)),
    item('font-larger', '增大字体', 'fas fa-text-height', () => adjustFontSize(1)),
    separator('page-separator-2'),
    item('copy-page-url', '复制当前页面地址', 'fas fa-link', () => copyText(window.location.href)),
    item('open-page-system', '使用系统浏览器打开当前页', 'fas fa-external-link-alt', () => CoolapkTauriAPI.openUrl(window.location.href, 'system')),
    item('open-settings', '打开设置', 'fas fa-cog', () => router.push('/settings')),
  ];
}

async function copyText(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast('已复制');
  }
}

async function copyImage(url: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    if ('ClipboardItem' in window && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
      showToast('图片已复制');
      return;
    }
  } catch {
    // 图片跨域或系统剪贴板不可用时回退为复制地址。
  }
  await copyText(url);
}

async function saveImage(url: string) {
  try {
    await CoolapkTauriAPI.saveImage(url);
    showToast('图片保存成功');
  } catch (error) {
    showToast(`图片保存失败：${String(error)}`, 'error', 2400);
  }
}

async function saveAllImages(urls: string[]) {
  const originalUrls = [...new Set(urls.map((url) => getOriginalImageUrl(url)).filter(Boolean))];
  if (!originalUrls.length) {
    showToast('当前动态没有可保存的图片', 'error');
    return;
  }

  showToast(`正在保存 ${originalUrls.length} 张原图...`, 'success', 3000);
  let saved = 0;
  let failed = 0;
  const savedPaths: string[] = [];
  for (const url of originalUrls) {
    try {
      const savedPath = await CoolapkTauriAPI.saveImage(url);
      if (savedPath) savedPaths.push(savedPath);
      saved += 1;
    } catch (error) {
      failed += 1;
      console.warn('保存动态原图失败:', url, error);
    }
  }

  const directories = [...new Set(savedPaths.map((path) => path.replace(/[\\/][^\\/]*$/, '')).filter(Boolean))];
  const savedLocation = directories.length === 1 ? `，路径：${directories[0]}` : '';

  showToast(
    failed ? `原图保存完成：成功 ${saved} 张，失败 ${failed} 张${savedLocation}` : `原图保存完成：共 ${saved} 张${savedLocation}`,
    failed ? 'error' : 'success',
    6000,
  );
}

function replyComment(state: ContextState) {
  window.dispatchEvent(new CustomEvent('coolapk-context-reply-comment', {
    detail: {
      feedId: state.feedId,
      commentId: state.commentId,
      username: state.commentUsername,
    },
  }));
}

function openLink(url: string) {
  const feedMatch = url.match(/\/feed\/(\d+)/);
  if (feedMatch?.[1]) {
    openFeedDetail(router, feedMatch[1]);
    return;
  }
  const path = new URL(url, window.location.origin).pathname;
  if (path.startsWith('/u/')) {
    router.push(`/user/${path.slice(3)}`);
    return;
  }
  if (path.startsWith('/t/')) {
    router.push(`/topic/${path.slice(3)}`);
    return;
  }
  void CoolapkTauriAPI.openUrl(url, 'internal');
}

function searchInApp(value: string) {
  const query = value.trim();
  if (query) void router.push({ path: '/search', query: { q: query } });
}

function searchInSystem(value: string) {
  const query = value.trim();
  if (query) void CoolapkTauriAPI.openUrl(`https://www.baidu.com/s?wd=${encodeURIComponent(query)}`, 'system');
}

async function shareText(url: string) {
  try {
    if (navigator.share) {
      await navigator.share({ title: '酷安动态', url });
      return;
    }
  } catch {
    // 用户取消分享时不提示错误。
  }
  await copyText(url);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  const scrollables = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((element) => (
    element.scrollTop > 0 && element.scrollHeight > element.clientHeight
  ));
  scrollables.forEach((element) => element.scrollTo({ top: 0, behavior: 'smooth' }));
}

function toggleTheme() {
  settingsStore.setTheme(settingsStore.settings.theme === 'dark' ? 'light' : 'dark');
}

function setDensity(density: typeof settingsStore.settings.density) {
  settingsStore.settings.density = density;
  const label = density === 'compact' ? '紧凑' : density === 'comfortable' ? '舒适' : '标准';
  showToast(`已切换为${label}布局`);
}

function adjustFontSize(delta: number) {
  const next = Math.min(20, Math.max(12, (settingsStore.settings.fontSize || 15) + delta));
  settingsStore.settings.fontSize = next;
  showToast(`字体大小：${next}px`);
}

function closeMenu() {
  menu.value = null;
}

function openMenu(event: MouseEvent) {
  const state = buildContext(event);
  if (!state) return;
  event.preventDefault();
  event.stopPropagation();
  const items = createItems(state);
  const width = 258;
  const estimatedHeight = Math.min(520, items.length * 38 + 16);
  menu.value = {
    ...state,
    items,
    x: Math.max(8, Math.min(state.x, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(state.y, window.innerHeight - estimatedHeight - 8)),
  };
}

async function run(itemToRun: MenuItem) {
  if (!itemToRun.action || itemToRun.disabled) return;
  closeMenu();
  try {
    await itemToRun.action();
  } catch (error) {
    console.error('右键菜单操作失败:', error);
    showToast(`操作失败：${String(error)}`, 'error', 2400);
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu();
}

onMounted(() => {
  window.addEventListener('contextmenu', openMenu, true);
  window.addEventListener('click', closeMenu);
  window.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, true);
});

onUnmounted(() => {
  window.removeEventListener('contextmenu', openMenu, true);
  window.removeEventListener('click', closeMenu);
  window.removeEventListener('keydown', handleKeydown, true);
  window.removeEventListener('resize', closeMenu);
  window.removeEventListener('scroll', closeMenu, true);
});
</script>

<style scoped>
.app-context-menu {
  position: fixed;
  z-index: 20000;
  width: 258px;
  max-height: min(520px, calc(100vh - 16px));
  overflow-y: auto;
  padding: 7px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--surface-elevated, var(--surface));
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2), 0 2px 8px rgba(15, 23, 42, 0.12);
  color: var(--text-primary);
  user-select: none;
}

.context-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 34px;
  gap: 10px;
  padding: 7px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.context-menu-item i {
  width: 16px;
  color: var(--text-secondary);
  text-align: center;
}

.context-menu-item span {
  flex: 1;
}

.context-menu-item kbd {
  color: var(--text-tertiary);
  font-size: 11px;
}

.context-menu-item:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--brand-primary);
}

.context-menu-item:hover:not(:disabled) i {
  color: var(--brand-primary);
}

.context-menu-item.is-danger {
  color: var(--danger);
}

.context-menu-item.is-disabled,
.context-menu-item:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.context-menu-separator {
  height: 1px;
  margin: 6px 5px;
  background: var(--border-light);
}
</style>
