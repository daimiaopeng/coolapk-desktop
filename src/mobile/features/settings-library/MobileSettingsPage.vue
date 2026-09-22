<template>
  <section class="mobile-settings-page" data-mobile-page="settings" aria-label="设置">
    <div class="mobile-settings-scroll">
      <section class="mobile-settings-hero">
        <span class="mobile-settings-hero-icon"><i class="fas fa-gear"></i></span>
        <div><h1>设置</h1><p>调整酷安的显示、通知和使用方式</p></div>
      </section>

      <nav class="mobile-settings-menu" aria-label="设置分类">
        <button v-for="item in menu" :key="item.key" type="button" :class="{ active: section === item.key }" @click="goSection(item.key)">
          <span class="mobile-settings-menu-icon"><i :class="item.icon"></i></span>
          <span>{{ item.label }}</span>
          <i class="fas fa-chevron-right"></i>
        </button>
      </nav>

      <section class="mobile-settings-card">
        <header><h2>{{ currentMenu.label }}</h2><span>{{ currentMenu.description }}</span></header>

        <template v-if="section === 'appearance'">
          <div class="mobile-settings-row"><span>主题模式</span><div class="mobile-settings-segment"><button v-for="item in themeOptions" :key="item.value" type="button" :class="{ active: settingsStore.settings.theme === item.value }" @click="settingsStore.setTheme(item.value)">{{ item.label }}</button></div></div>
          <div class="mobile-settings-row"><span>强调色</span><div class="mobile-settings-colors"><button v-for="color in colors" :key="color.value" type="button" :class="[`color-${color.value}`, { active: settingsStore.settings.accentColor === color.value }]" :aria-label="color.label" @click="settingsStore.setAccent(color.value)"></button></div></div>
          <div class="mobile-settings-row"><span>字体大小</span><div class="mobile-settings-stepper"><button type="button" @click="changeFontSize(-1)">−</button><strong>{{ settingsStore.settings.fontSize }}</strong><button type="button" @click="changeFontSize(1)">+</button></div></div>
        </template>

        <template v-else-if="section === 'notifications'">
          <label v-for="item in notificationOptions" :key="item.key" class="mobile-settings-row"><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span><input v-model="settingsStore.settings[item.key]" type="checkbox" class="mobile-switch" /></label>
        </template>

        <template v-else-if="section === 'content'">
          <div class="mobile-settings-row"><span>信息流密度</span><div class="mobile-settings-segment"><button v-for="item in densityOptions" :key="item.value" type="button" :class="{ active: settingsStore.settings.density === item.value }" @click="settingsStore.settings.density = item.value">{{ item.label }}</button></div></div>
          <label class="mobile-settings-row"><span><strong>自动播放动图</strong><small>在信息流中自动播放 GIF</small></span><input v-model="settingsStore.settings.autoPlayGif" type="checkbox" class="mobile-switch" /></label>
          <label class="mobile-settings-row"><span><strong>无图模式</strong><small>节省移动网络流量</small></span><input v-model="settingsStore.settings.noImageMode" type="checkbox" class="mobile-switch" /></label>
          <label class="mobile-settings-row"><span><strong>显示设备信息</strong><small>在动态中显示发布设备</small></span><input v-model="settingsStore.settings.showDeviceInfo" type="checkbox" class="mobile-switch" /></label>
        </template>

        <template v-else-if="section === 'downloads'">
          <div class="mobile-settings-row"><span>下载目录</span><span class="mobile-settings-value">{{ settingsStore.settings.downloadPath || '系统默认目录' }}</span></div>
          <div class="mobile-settings-row"><span>同时下载任务</span><div class="mobile-settings-stepper"><button type="button" @click="changeConcurrent(-1)">−</button><strong>{{ settingsStore.settings.maxConcurrentDownloads }}</strong><button type="button" @click="changeConcurrent(1)">+</button></div></div>
          <button type="button" class="mobile-settings-action" @click="router.push('/downloads')"><i class="fas fa-download"></i> 查看下载任务 <i class="fas fa-chevron-right"></i></button>
        </template>

        <template v-else-if="section === 'about'">
          <div class="mobile-settings-about"><img src="../../../assets/coolapk-logo-rounded.png" alt="酷安" /><strong>酷安桌面版</strong><span>v{{ APP_VERSION }}</span><p>一个更适合桌面和移动设备的酷安客户端</p></div>
          <button type="button" class="mobile-settings-action" @click="openRelease"><i class="fas fa-arrow-up-right-from-square"></i> 查看更新与开源信息 <i class="fas fa-chevron-right"></i></button>
        </template>

        <template v-else-if="section === 'profile'">
          <button type="button" class="mobile-settings-action" @click="router.push('/user/me')"><i class="fas fa-id-card"></i> 编辑个人资料 <i class="fas fa-chevron-right"></i></button>
          <button type="button" class="mobile-settings-action" @click="router.push('/my')"><i class="fas fa-user"></i> 查看我的主页 <i class="fas fa-chevron-right"></i></button>
        </template>

        <template v-else-if="section === 'account'">
          <div class="mobile-settings-row"><span>当前账号</span><span class="mobile-settings-value">{{ authStore.user?.username || '未登录' }}</span></div>
          <button type="button" class="mobile-settings-action danger" @click="authStore.isLoggedIn ? authStore.logout() : authStore.openLoginModal()"><i class="fas fa-right-from-bracket"></i> {{ authStore.isLoggedIn ? '退出登录' : '登录酷安' }} <i class="fas fa-chevron-right"></i></button>
        </template>

        <template v-else>
          <button v-for="item in genericRows" :key="item" type="button" class="mobile-settings-action"><span>{{ item }}</span><i class="fas fa-chevron-right"></i></button>
        </template>
      </section>
      <div class="mobile-settings-bottom-space"></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { APP_VERSION } from '../../../constants/version';
import { useAuthStore } from '../../../stores/auth';
import { useSettingsStore } from '../../../stores/settings';
import type { AccentColor, FeedDensity, ThemeMode } from '../../../types/settings';

defineOptions({ name: 'MobileSettingsPage' });

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const menu = [
  { key: 'profile', label: '个人信息', description: '头像、昵称和个人主页', icon: 'fas fa-id-card' },
  { key: 'account', label: '账号与安全', description: '登录、账号和安全设置', icon: 'fas fa-user-shield' },
  { key: 'notifications', label: '通知设置', description: '消息提醒和推送', icon: 'fas fa-bell' },
  { key: 'privacy', label: '隐私设置', description: '内容和隐私保护', icon: 'fas fa-lock' },
  { key: 'content', label: '内容偏好', description: '信息流和媒体显示', icon: 'fas fa-sliders' },
  { key: 'downloads', label: '下载与缓存', description: '下载目录和缓存管理', icon: 'fas fa-download' },
  { key: 'appearance', label: '外观设置', description: '主题、字体和强调色', icon: 'fas fa-palette' },
  { key: 'shortcuts', label: '快捷键', description: '键盘快捷操作', icon: 'fas fa-keyboard' },
  { key: 'startup', label: '启动与行为', description: '启动和窗口行为', icon: 'fas fa-power-off' },
  { key: 'device', label: '设备信息', description: '访问设备和网络信息', icon: 'fas fa-mobile-screen-button' },
  { key: 'about', label: '关于酷安', description: '版本、更新和开源信息', icon: 'fas fa-circle-info' },
] as const;
const themeOptions: Array<{ value: ThemeMode; label: string }> = [{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }];
const colors: Array<{ value: AccentColor; label: string }> = [{ value: 'green', label: '绿色' }, { value: 'blue', label: '蓝色' }, { value: 'violet', label: '紫色' }, { value: 'orange', label: '橙色' }];
const densityOptions: Array<{ value: FeedDensity; label: string }> = [{ value: 'compact', label: '紧凑' }, { value: 'standard', label: '标准' }, { value: 'comfortable', label: '宽松' }];
const notificationOptions = [
  { key: 'notifyReplies', label: '回复提醒', description: '有人回复你的动态时提醒' },
  { key: 'notifyAt', label: '@我的提醒', description: '有人提到你时提醒' },
  { key: 'notifyPm', label: '私信提醒', description: '收到私信时提醒' },
] as const;
const genericRows = computed(() => section.value === 'privacy' ? ['允许陌生人查看主页', '允许私信', '屏蔽与黑名单'] : section.value === 'shortcuts' ? ['全局搜索', '发布动态', '返回上一页'] : section.value === 'startup' ? ['启动时恢复上次页面', '启动时检查更新', '关闭窗口时最小化到托盘'] : ['当前设备', '网络请求和缓存', '查看设备指纹']);
const section = computed(() => String(route.params.section || route.path.split('/')[2] || 'appearance'));
const currentMenu = computed(() => menu.find((item) => item.key === section.value) || menu[6]);

function goSection(key: string) { void router.push(`/settings/${key}`); }
function changeFontSize(delta: number) { settingsStore.settings.fontSize = Math.min(20, Math.max(12, settingsStore.settings.fontSize + delta)); }
function changeConcurrent(delta: number) { settingsStore.settings.maxConcurrentDownloads = Math.min(8, Math.max(1, settingsStore.settings.maxConcurrentDownloads + delta)); }
function openRelease() { void router.push('/external?url=https%3A%2F%2Fgithub.com%2Fdaimiaopeng%2Fcoolapk-desktop'); }
onMounted(() => { settingsStore.initializeSettings(); });
</script>

<style scoped>
.mobile-settings-page { display: flex; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: #f2f2f6; color: #28282b; }.mobile-settings-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 12px calc(22px + env(safe-area-inset-bottom, 0px)); }.mobile-settings-hero { display: flex; align-items: center; gap: 12px; padding: 8px 4px 16px; }.mobile-settings-hero-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: #e3f6eb; color: #0f9d58; font-size: 21px; }.mobile-settings-hero h1 { margin: 0; font-size: 24px; }.mobile-settings-hero p { margin: 3px 0 0; color: #929296; font-size: 12px; }.mobile-settings-menu, .mobile-settings-card { border-radius: 22px; background: #fff; }.mobile-settings-menu { display: grid; margin-bottom: 12px; padding: 6px; }.mobile-settings-menu button { display: flex; align-items: center; gap: 11px; min-height: 48px; padding: 0 9px; border: 0; border-radius: 15px; background: transparent; color: #4e4e52; font: inherit; text-align: left; }.mobile-settings-menu button.active { background: #e7f6ed; color: #0c8d50; font-weight: 700; }.mobile-settings-menu button > span:nth-child(2) { flex: 1; }.mobile-settings-menu button > i { color: #c1c1c5; font-size: 12px; }.mobile-settings-menu-icon { display: grid; place-items: center; width: 32px; color: #0f9d58; }.mobile-settings-card { overflow: hidden; }.mobile-settings-card > header { padding: 17px 16px 13px; border-bottom: 1px solid #f0f0f1; }.mobile-settings-card h2 { margin: 0; font-size: 19px; }.mobile-settings-card header span { display: block; margin-top: 4px; color: #99999d; font-size: 12px; }.mobile-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 56px; padding: 0 16px; border-bottom: 1px solid #f2f2f3; font-size: 14px; }.mobile-settings-row > span:first-child { min-width: 0; }.mobile-settings-row strong, .mobile-settings-row small { display: block; }.mobile-settings-row small { margin-top: 4px; color: #999; font-size: 11px; }.mobile-settings-segment { display: flex; gap: 3px; padding: 3px; border-radius: 10px; background: #f3f3f5; }.mobile-settings-segment button { min-height: 30px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: #888; font: inherit; font-size: 11px; }.mobile-settings-segment button.active { background: #fff; color: #0f9d58; box-shadow: 0 1px 3px rgba(0,0,0,.08); }.mobile-settings-colors { display: flex; gap: 10px; }.mobile-settings-colors button { width: 25px; height: 25px; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px #ddd; }.mobile-settings-colors button.active { box-shadow: 0 0 0 2px #222; }.color-green { background: #0f9d58; }.color-blue { background: #3b82f6; }.color-purple { background: #8b5cf6; }.color-orange { background: #f97316; }.mobile-settings-stepper { display: flex; align-items: center; gap: 12px; }.mobile-settings-stepper button { width: 28px; height: 28px; border: 0; border-radius: 9px; background: #e8f6ed; color: #0f9d58; font-size: 18px; }.mobile-settings-stepper strong { min-width: 25px; text-align: center; }.mobile-settings-value { max-width: 58%; overflow: hidden; color: #999; text-overflow: ellipsis; white-space: nowrap; }.mobile-switch { position: relative; width: 42px; height: 25px; appearance: none; border-radius: 999px; outline: 0; background: #d5d5d9; transition: .18s; }.mobile-switch::after { position: absolute; top: 3px; left: 3px; width: 19px; height: 19px; content: ''; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: .18s; }.mobile-switch:checked { background: #0f9d58; }.mobile-switch:checked::after { transform: translateX(17px); }.mobile-settings-action { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 54px; padding: 0 16px; border: 0; border-bottom: 1px solid #f2f2f3; background: #fff; color: #3c3c40; font: inherit; text-align: left; }.mobile-settings-action span { flex: 1; }.mobile-settings-action > i:last-child { margin-left: auto; color: #c0c0c4; font-size: 12px; }.mobile-settings-action.danger { color: #e04b44; }.mobile-settings-about { display: grid; place-items: center; gap: 5px; padding: 26px 16px 18px; }.mobile-settings-about img { width: 58px; height: 58px; border-radius: 16px; }.mobile-settings-about strong { font-size: 17px; }.mobile-settings-about span, .mobile-settings-about p { color: #999; font-size: 12px; }.mobile-settings-about p { margin: 5px 0 0; }.mobile-settings-bottom-space { height: 24px; }
@media (min-width: 720px) { .mobile-settings-scroll { width: min(100%, 720px); margin: 0 auto; padding-inline: 24px; } }
</style>
