<template>
  <component v-if="profileSection" :is="profileSection" :embedded="true" />
  <section v-else class="mobile-profile-page" data-mobile-page="profile" aria-label="我的">
    <div v-if="loading && !profile" class="mobile-profile-state">
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
      <span>正在加载个人资料…</span>
    </div>

    <div v-else class="mobile-profile-scroll">
      <section v-if="!loggedIn" class="mobile-profile-login-card">
        <div class="mobile-profile-login-icon"><i class="fas fa-user"></i></div>
        <div>
          <h1>登录酷安</h1>
          <p>登录后查看你的动态、收藏和个人卡片</p>
        </div>
        <button type="button" class="profile-primary-button" @click="authStore.openLoginModal()">登录</button>
      </section>

      <section class="mobile-profile-hero" :class="{ 'is-guest': !loggedIn }">
        <div class="mobile-profile-quick-actions" aria-label="个人快捷入口">
          <button type="button" aria-label="扫一扫" @click="openScan"><i class="fas fa-expand"></i></button>
          <button type="button" aria-label="设置" @click="router.push('/settings')"><i class="fas fa-gear"></i></button>
          <button type="button" aria-label="应用游戏" @click="router.push('/apps')"><i class="fas fa-box"></i></button>
          <button type="button" aria-label="私信" @click="router.push('/messages')"><i class="far fa-envelope"></i></button>
        </div>

        <div
          class="mobile-profile-identity"
          role="button"
          tabindex="0"
          aria-label="打开个人主页"
          @click="openProfileRoute"
          @keydown.enter.prevent="openProfileRoute"
        >
          <div class="mobile-profile-avatar">
            <img v-if="avatarUrl" :src="avatarUrl" alt="" referrerpolicy="no-referrer" />
            <i v-else class="fas fa-user" aria-hidden="true"></i>
          </div>
          <div class="mobile-profile-identity-copy">
            <div class="mobile-profile-name-row">
              <h1>{{ profileName }}</h1>
              <span class="mobile-profile-level">Lv.{{ profileLevel }}</span>
            </div>
            <div class="mobile-profile-exp-row">
              <span class="mobile-profile-exp">{{ profileExp }}/{{ profileMaxExp }}</span>
              <span class="mobile-profile-progress"><i :style="{ width: `${progress}%` }"></i></span>
            </div>
          </div>
          <button type="button" class="mobile-profile-qr" aria-label="我的二维码名片" @click.stop="openProfileQr">
            <i class="fas fa-qrcode"></i>
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </section>

      <Teleport to="body">
        <div
          v-if="qrDialogOpen"
          class="mobile-profile-qr-dialog"
          role="presentation"
          @click.self="closeProfileQr"
        >
          <section class="mobile-profile-qr-card" role="dialog" aria-modal="true" aria-labelledby="mobile-profile-qr-title">
            <header class="mobile-profile-qr-header">
              <h2 id="mobile-profile-qr-title">我的二维码名片</h2>
              <button type="button" aria-label="关闭二维码" @click="closeProfileQr">
                <i class="fas fa-xmark"></i>
              </button>
            </header>
            <div class="mobile-profile-qr-content">
              <div class="mobile-profile-qr-user">
                <div class="mobile-profile-qr-avatar">
                  <img v-if="avatarUrl" :src="avatarUrl" alt="" referrerpolicy="no-referrer" />
                  <i v-else class="fas fa-user" aria-hidden="true"></i>
                </div>
                <strong>{{ profileName }}</strong>
                <span>扫一扫，在手机酷安打开主页</span>
              </div>
              <div class="mobile-profile-qr-image">
                <i v-if="qrLoading" class="fas fa-circle-notch fa-spin" aria-label="正在生成二维码"></i>
                <img v-else-if="qrImageUrl" :src="qrImageUrl" alt="用户二维码" />
                <span v-else>{{ qrError || '二维码暂时无法加载' }}</span>
              </div>
            </div>
          </section>
        </div>
      </Teleport>

      <section class="mobile-profile-stats" aria-label="个人统计">
        <button v-for="item in stats" :key="item.key" type="button" @click="openStat(item.key)">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </button>
      </section>

      <section v-if="loggedIn && securityVisible" class="mobile-profile-security">
        <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
        <span>您的账户不安全，请尽快绑定邮箱</span>
        <button type="button" @click="router.push('/settings/account')">去设置</button>
        <button type="button" aria-label="关闭提示" @click="securityVisible = false"><i class="fas fa-xmark"></i></button>
      </section>

      <section class="mobile-profile-action-card" aria-label="个人功能">
        <button v-for="item in actions" :key="item.key" type="button" @click="openAction(item)">
          <span class="mobile-profile-action-icon" :class="`tone-${item.tone}`"><i :class="item.icon"></i></span>
          <span>{{ item.label }}</span>
        </button>
      </section>

      <button type="button" class="mobile-profile-notice" @click="router.push('/settings/about')">
        <i class="fas fa-volume-high"></i>
        <span>有疑惑请参考「酷安常见问题」&gt;&gt;&gt;</span>
        <i class="fas fa-chevron-right"></i>
      </button>

      <header class="mobile-profile-section-heading">
        <h2>我的卡片</h2>
        <button type="button" @click="router.push('/settings/content')">卡片管理</button>
      </header>

      <section class="mobile-profile-card-list">
        <button
          v-for="card in cards"
          :key="card.key"
          type="button"
          class="mobile-profile-card"
          @click="openCard(card)"
        >
          <strong>{{ card.title }}</strong>
          <span>{{ card.subtitle }}</span>
          <i class="fas fa-chevron-right"></i>
        </button>
        <div v-if="!cards.length" class="mobile-profile-empty-card">
          <strong>我关注的话题</strong>
          <span>暂时没有可展示的卡片</span>
        </div>
      </section>

      <div class="mobile-profile-bottom-space"></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import MyCommentsPage from '../../../pages/MyCommentsPage.vue';
import MyFeedsPage from '../../../pages/MyFeedsPage.vue';
import { useAuthStore } from '../../../stores/auth';
import { useSettingsStore } from '../../../stores/settings';
import { asUserSpaceProfile } from '../../../types/userSpace';

defineOptions({ name: 'MobileProfilePage' });

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const loading = ref(false);
const profile = ref<Record<string, any> | null>(null);
const securityVisible = ref(true);
const qrDialogOpen = ref(false);
const qrImageUrl = ref('');
const qrLoading = ref(false);
const qrError = ref('');

const profileSection = computed(() => {
  const section = String(route.query.section || '');
  if (section === 'my_feeds') return MyFeedsPage;
  if (section === 'my_comments') return MyCommentsPage;
  return null;
});

const profileCache = (globalThis as typeof globalThis & { __coolapkMobileProfileCache?: Map<string, Record<string, any>> }).__coolapkMobileProfileCache
  ||= new Map<string, Record<string, any>>();

const loggedIn = computed(() => Boolean(authStore.isLoggedIn && authStore.user?.uid));
const uid = computed(() => String(authStore.user?.uid || '').trim());
const profileName = computed(() => String(profile.value?.username || authStore.user?.username || '酷友'));
const profileLevel = computed(() => Number(profile.value?.level || authStore.user?.level || 0));
const avatarUrl = computed(() => String(profile.value?.userAvatar || profile.value?.avatar || authStore.user?.userAvatar || avatarForUid(uid.value) || ''));
const profileExp = computed(() => Number(profile.value?.levelExperience || profile.value?.level_experience || profile.value?.experience || profile.value?.exp || authStore.user?.exp || 0));
const profileMaxExp = computed(() => Number(profile.value?.nextLevelExperience || profile.value?.maxExp || authStore.user?.maxExp || Math.max(100, (profileLevel.value + 1) * 100)));
const progress = computed(() => Math.min(100, Math.max(0, Math.round((profileExp.value / Math.max(1, profileMaxExp.value)) * 100))));

const stats = computed(() => [
  { key: 'feed', label: '动态', value: Number(profile.value?.feedNum || profile.value?.feed_num || 0) },
  { key: 'follow', label: '关注', value: Number(profile.value?.followNum || profile.value?.follow || authStore.user?.follow || 0) },
  { key: 'fans', label: '粉丝', value: Number(profile.value?.fansNum || profile.value?.fans || authStore.user?.fans || 0) },
]);

type ProfileAction = {
  key: string;
  label: string;
  icon: string;
  tone: string;
  path?: string;
  url?: string;
};

const actions: readonly ProfileAction[] = [
  { key: 'following', label: '我的关注', icon: 'fas fa-heart', tone: 'cyan', path: '/following' },
  { key: 'favorites', label: '我的收藏', icon: 'fas fa-star', tone: 'blue', path: '/favorites' },
  { key: 'reviews', label: '我的点评', icon: 'fas fa-face-smile', tone: 'pink' },
  { key: 'night', label: '夜间模式', icon: 'fas fa-moon', tone: 'purple', path: '' },
  { key: 'feeds', label: '我的图文', icon: 'fas fa-note-sticky', tone: 'red', path: '/my?section=my_feeds' },
  { key: 'comments', label: '我的回复', icon: 'fas fa-comment', tone: 'orange', path: '/my?section=my_comments' },
  { key: 'pendants', label: '我的挂件', icon: 'fas fa-shirt', tone: 'blue', url: 'https://m.coolapk.com/mp/userPlugin/myPlugin?noMenu=1&autoTheme=1' },
  { key: 'more', label: '更多', icon: 'fas fa-ellipsis', tone: 'cyan', path: '/more' },
];

const cards = computed(() => {
  const rows = Array.isArray(profile.value?.homeTabCardRows) ? profile.value?.homeTabCardRows : [];
  return rows.slice(0, 6).map((row: any, index: number) => ({
    key: String(row?.id || row?.entityId || index),
    title: String(row?.title || row?.name || (index === 0 ? '我关注的话题' : '我的动态')),
    subtitle: String(row?.subTitle || row?.description || row?.message || '查看详情'),
    route: String(row?.url || ''),
  }));
});

function avatarForUid(value: string): string {
  if (!value || value === '10000') return '';
  const padded = value.padStart(9, '0');
  return `https://avatar.coolapk.com/data/${padded.slice(0, 3)}/${padded.slice(3, 5)}/${padded.slice(5, 7)}/${value.slice(-2)}_avatar_middle.jpg`;
}

async function loadProfile() {
  if (!uid.value) return;
  const cached = profileCache.get(uid.value);
  if (cached) {
    profile.value = cached;
    return;
  }
  loading.value = true;
  try {
    const response: any = await CoolapkTauriAPI.getUserSpace(uid.value);
    const value = asUserSpaceProfile(response?.data || response, uid.value) as Record<string, any>;
    profile.value = value;
    profileCache.set(uid.value, value);
    authStore.updateProfileStats(value);
  } catch (error) {
    console.warn('移动端个人页加载失败:', error);
    profile.value = { ...(authStore.user || {}), uid: uid.value };
  } finally {
    loading.value = false;
  }
}

function openScan() {
  void router.push({ path: '/external', query: { url: 'coolapk://scan' } });
}

function openProfileRoute() {
  if (uid.value) void router.push(`/user/${encodeURIComponent(uid.value)}`);
  else authStore.openLoginModal();
}

async function openProfileQr() {
  if (!uid.value) {
    authStore.openLoginModal();
    return;
  }
  qrDialogOpen.value = true;
  qrImageUrl.value = '';
  qrError.value = '';
  qrLoading.value = true;
  try {
    const response: any = await CoolapkTauriAPI.getUserQrImage(uid.value);
    const data = response?.data ?? response;
    const image = typeof data === 'string'
      ? data
      : data?.image || data?.imageUrl || data?.image_url || data?.url || '';
    if (!image) throw new Error('接口未返回二维码图片');
    qrImageUrl.value = String(image);
  } catch (error: any) {
    qrError.value = error?.message || '二维码加载失败，请稍后重试';
  } finally {
    qrLoading.value = false;
  }
}

function closeProfileQr() {
  qrDialogOpen.value = false;
  qrImageUrl.value = '';
  qrError.value = '';
}

function openStat(key: string) {
  if (!loggedIn.value || !uid.value) {
    authStore.openLoginModal();
    return;
  }
  const profilePath = `/user/${encodeURIComponent(uid.value)}`;
  if (key === 'feed') void router.push({ path: profilePath, query: { tab: 'feed' } });
  else if (key === 'follow') void router.push('/following');
  else if (key === 'fans') void router.push(`${profilePath}/relations/fans`);
}

function openAction(item: ProfileAction) {
  if (item.key === 'night') {
    settingsStore.setTheme(settingsStore.settings.theme === 'dark' ? 'light' : 'dark');
    return;
  }
  if (item.key === 'reviews') {
    if (!loggedIn.value || !uid.value) {
      authStore.openLoginModal();
      return;
    }
    void router.push({ path: `/user/${encodeURIComponent(uid.value)}`, query: { tab: 'rating' } });
    return;
  }
  if (item.url) {
    void CoolapkTauriAPI.openUrl(item.url, 'internal');
    return;
  }
  if (item.path) void router.push(item.path);
}

function openCard(card: { route: string }) {
  if (card.route.startsWith('/')) void router.push(card.route);
  else if (uid.value) void router.push(`/user/${encodeURIComponent(uid.value)}`);
}

onMounted(() => {
  void loadProfile();
});
</script>

<style scoped>
.mobile-profile-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #f2f2f6;
  color: #242424;
}

.mobile-profile-scroll {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 0 max(12px, env(safe-area-inset-left, 0px)) calc(18px + env(safe-area-inset-bottom, 0px));
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.mobile-profile-state {
  display: grid;
  place-content: center;
  gap: 10px;
  flex: 1;
  color: #7c7c80;
  font-size: 14px;
}

.mobile-profile-login-card,
.mobile-profile-hero,
.mobile-profile-stats,
.mobile-profile-security,
.mobile-profile-action-card,
.mobile-profile-notice,
.mobile-profile-card,
.mobile-profile-empty-card {
  border-radius: 22px;
  background: #fff;
}

.mobile-profile-login-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 14px;
}

.mobile-profile-login-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #e5f7ee;
  color: #0f9d58;
  font-size: 20px;
}

.mobile-profile-login-card h1,
.mobile-profile-login-card p {
  margin: 0;
}

.mobile-profile-login-card h1 { font-size: 17px; }
.mobile-profile-login-card p { margin-top: 3px; color: #8b8b90; font-size: 12px; }
.mobile-profile-login-card > div:nth-child(2) { flex: 1; min-width: 0; }

.profile-primary-button,
.mobile-profile-security button {
  border: 1px solid #0f9d58;
  border-radius: 999px;
  background: transparent;
  color: #0f9d58;
  font: inherit;
  white-space: nowrap;
}

.profile-primary-button { min-height: 34px; padding: 0 14px; }

.mobile-profile-hero {
  padding: 14px 14px 17px;
  background: transparent;
}

.mobile-profile-quick-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  min-height: 40px;
}

.mobile-profile-quick-actions button,
.mobile-profile-qr {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 38px;
  min-height: 38px;
  border: 0;
  background: transparent;
  color: #77777b;
  font: inherit;
  font-size: 20px;
  touch-action: manipulation;
}

.mobile-profile-identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  margin-top: 44px;
  cursor: pointer;
}

.mobile-profile-identity:focus-visible {
  outline: 3px solid rgba(15, 157, 88, .28);
  outline-offset: 5px;
  border-radius: 16px;
}

.mobile-profile-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 76px;
  width: 76px;
  height: 76px;
  overflow: hidden;
  border-radius: 50%;
  background: #fff;
  color: #8e8e93;
  font-size: 26px;
}

.mobile-profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
.mobile-profile-identity-copy { flex: 1; min-width: 0; }
.mobile-profile-name-row { display: flex; align-items: baseline; gap: 8px; }
.mobile-profile-name-row h1 { margin: 0; overflow: hidden; font-size: clamp(22px, 6vw, 30px); font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.mobile-profile-level { color: #cfcfd2; font-size: 18px; font-style: italic; font-weight: 700; }
.mobile-profile-exp-row { display: flex; align-items: center; gap: 8px; margin-top: 9px; }
.mobile-profile-exp { min-width: 46px; color: #303034; font-size: 12px; }
.mobile-profile-progress { flex: 1; height: 9px; overflow: hidden; border-radius: 999px; background: #d9d9dc; }
.mobile-profile-progress i { display: block; height: 100%; border-radius: inherit; background: #d4d4d6; }
.mobile-profile-qr { flex: 0 0 auto; flex-direction: column; gap: 3px; color: #27272a; font-size: 28px; }
.mobile-profile-qr i:last-child { font-size: 17px; }

.mobile-profile-qr-dialog {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(20, 22, 26, .48);
}

.mobile-profile-qr-card {
  width: min(100%, 360px);
  overflow: hidden;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 60px rgba(20, 24, 30, .24);
}

.mobile-profile-qr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid #f0f0f1;
}

.mobile-profile-qr-header h2 { margin: 0; font-size: 18px; }
.mobile-profile-qr-header button { width: 34px; height: 34px; border: 0; border-radius: 50%; background: #f4f4f5; color: #777; font: inherit; }
.mobile-profile-qr-content { padding: 20px 20px 24px; text-align: center; }
.mobile-profile-qr-user { display: grid; justify-items: center; gap: 6px; }
.mobile-profile-qr-avatar { display: grid; place-items: center; width: 54px; height: 54px; overflow: hidden; border-radius: 50%; background: #e5f7ee; color: #0f9d58; font-size: 20px; }
.mobile-profile-qr-avatar img { width: 100%; height: 100%; object-fit: cover; }
.mobile-profile-qr-user strong { font-size: 17px; }
.mobile-profile-qr-user span { color: #96969b; font-size: 12px; }
.mobile-profile-qr-image { display: grid; place-items: center; min-height: 230px; margin-top: 18px; border-radius: 16px; background: #f7f7f8; color: #0f9d58; }
.mobile-profile-qr-image i { font-size: 28px; }
.mobile-profile-qr-image img { display: block; width: min(100%, 230px); height: auto; aspect-ratio: 1; object-fit: contain; }
.mobile-profile-qr-image span { padding: 24px; color: #85858a; font-size: 13px; }

.mobile-profile-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 0 2px 12px;
  padding: 16px 4px;
}

.mobile-profile-stats button { position: relative; border: 0; background: transparent; font: inherit; }
.mobile-profile-stats button + button::before { position: absolute; top: 8px; bottom: 8px; left: 0; width: 1px; content: ''; background: #ededee; }
.mobile-profile-stats strong { display: block; font-size: 27px; line-height: 1.05; }
.mobile-profile-stats span { display: block; margin-top: 5px; color: #858589; font-size: 15px; }

.mobile-profile-security {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 2px 12px;
  padding: 12px 13px;
  background: #f5e2e5;
  color: #e3483b;
  font-size: 13px;
}

.mobile-profile-security > span { flex: 1; min-width: 0; }
.mobile-profile-security button { min-height: 32px; padding: 0 12px; border-color: #e3483b; color: #e3483b; }
.mobile-profile-security button:last-child { min-width: 32px; padding: 0; border: 0; font-size: 19px; }

.mobile-profile-action-card { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px 4px; margin: 0 2px 12px; padding: 18px 6px 17px; }
.mobile-profile-action-card button { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; border: 0; background: transparent; color: #242424; font: inherit; font-size: 14px; touch-action: manipulation; }
.mobile-profile-action-icon { display: grid; place-items: center; width: 42px; height: 42px; font-size: 28px; }
.tone-cyan { color: #08b7c9; }.tone-blue { color: #278ee8; }.tone-pink { color: #e85ac7; }.tone-purple { color: #9864ed; }.tone-red { color: #fb433d; }.tone-orange { color: #fb433d; }

.mobile-profile-notice { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0 2px 16px; padding: 14px 15px; border: 0; color: #242424; font: inherit; text-align: left; }
.mobile-profile-notice i:first-child { color: #268de8; font-size: 22px; }.mobile-profile-notice span { flex: 1; min-width: 0; overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }.mobile-profile-notice i:last-child { color: #bcbcc0; }
.mobile-profile-section-heading { display: flex; align-items: center; justify-content: space-between; padding: 0 8px 10px; }.mobile-profile-section-heading h2 { margin: 0; font-size: 22px; }.mobile-profile-section-heading button { border: 0; background: transparent; color: #78787c; font: inherit; font-size: 14px; }
.mobile-profile-card-list { display: grid; gap: 10px; }.mobile-profile-card, .mobile-profile-empty-card { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; min-height: 78px; padding: 16px; border: 0; text-align: left; }.mobile-profile-card strong, .mobile-profile-empty-card strong { font-size: 17px; }.mobile-profile-card span, .mobile-profile-empty-card span { color: #8d8d91; font-size: 13px; }.mobile-profile-card > i { position: absolute; top: 50%; right: 16px; color: #c2c2c5; transform: translateY(-50%); }
.mobile-profile-bottom-space { height: 24px; }

@media (min-width: 720px) {
  .mobile-profile-scroll { width: min(100%, 720px); margin: 0 auto; padding-inline: 24px; }
  .mobile-profile-action-card { gap: 26px 16px; }
}
</style>
