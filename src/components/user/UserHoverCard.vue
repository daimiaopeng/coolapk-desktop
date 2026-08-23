<template>
  <div
    ref="triggerRef"
    class="user-hover-trigger"
    @mouseenter="handleTriggerMouseEnter"
    @mouseleave="handleTriggerMouseLeave"
  >
    <slot />

    <!-- 传送至 body 防止被父级 overflow 裁切 -->
    <Teleport to="body">
      <Transition name="hover-card-fade">
        <div
          v-if="hasMounted"
          v-show="visible"
          ref="cardRef"
          class="user-hover-popover custom-scrollbar"
          :style="popoverStyle"
          @mouseenter="handleCardMouseEnter"
          @mouseleave="handleCardMouseLeave"
          @click.stop
        >
          <!-- 顶部背景图或轻奢微渐变 -->
          <div class="card-cover-header">
            <AppImage
              v-if="profile?.cover"
              :src="profile.cover"
              fit="cover"
              image-class="cover-img"
            />
            <div v-else class="cover-gradient"></div>
            <div class="cover-mask"></div>
          </div>

          <div class="card-body">
            <!-- 头部头像与操作按钮 -->
            <div class="card-avatar-row">
              <div class="avatar-box" @click="goToUser">
                <AppAvatar
                  :src="currentAvatar"
                  :plugin-url="profile?.avatar_plugin_url"
                  size="lg"
                  class="card-avatar"
                />
              </div>

              <div class="card-actions">
                <template v-if="isSelf">
                  <button class="btn-self" @click="goToUser">
                    我的主页
                  </button>
                </template>
                <template v-else>
                  <button
                    :class="['btn-follow', { 'is-following': isFollowing }]"
                    :disabled="followLoading"
                    @click="toggleFollow"
                  >
                    <i :class="isFollowing ? 'fas fa-check' : 'fas fa-plus'"></i>
                    {{ isFollowing ? '已关注' : '关注' }}
                  </button>
                  <button class="btn-msg" title="发私信" @click="sendDirectMessage">
                    <i class="far fa-envelope"></i>
                  </button>
                </template>
              </div>
            </div>

            <!-- 用户名与等级/认证 -->
            <div class="user-name-box" @click="goToUser">
              <span class="user-nickname">{{ currentUsername }}</span>
              <span v-if="currentLevel" :class="['user-level-badge', `level-${Math.min(currentLevel, 12)}`]">
                Lv.{{ currentLevel }}
              </span>
              <span v-if="currentVerify" class="verify-badge" :title="currentVerify">
                <i class="fas fa-check-circle"></i>
                <span class="verify-text">{{ currentVerify }}</span>
              </span>
            </div>

            <!-- 个人简介 / 签名（带加载骨架平滑过渡） -->
            <div class="bio-container">
              <div v-if="loading && !profile" class="skeleton-line skeleton-pulse"></div>
              <p v-else class="user-bio" :title="userBioText">
                {{ userBioText }}
              </p>
            </div>

            <!-- 属性标签（机型、IP属地） -->
            <div v-if="tagList.length > 0" class="user-tags-row">
              <span v-for="(tag, idx) in tagList" :key="idx" class="user-chip">
                <i v-if="tag.icon" :class="tag.icon"></i>
                {{ tag.text }}
              </span>
            </div>

            <!-- 数据统计行（关注 / 粉丝 / 获赞 / 动态） -->
            <div class="stats-grid" @click="goToUser">
              <div class="stat-item" :title="`关注: ${followCount}`">
                <span v-if="loading && !profile" class="stat-skeleton skeleton-pulse"></span>
                <span v-else class="stat-num">{{ formatNum(followCount) }}</span>
                <span class="stat-label">关注</span>
              </div>
              <div class="stat-item" :title="`粉丝: ${fansCount}`">
                <span v-if="loading && !profile" class="stat-skeleton skeleton-pulse"></span>
                <span v-else class="stat-num">{{ formatNum(fansCount) }}</span>
                <span class="stat-label">粉丝</span>
              </div>
              <div class="stat-item" :title="`获赞: ${likeCount}`">
                <span v-if="loading && !profile" class="stat-skeleton skeleton-pulse"></span>
                <span v-else class="stat-num">{{ formatNum(likeCount) }}</span>
                <span class="stat-label">获赞</span>
              </div>
              <div class="stat-item" :title="`动态: ${feedCount}`">
                <span v-if="loading && !profile" class="stat-skeleton skeleton-pulse"></span>
                <span v-else class="stat-num">{{ formatNum(feedCount) }}</span>
                <span class="stat-label">动态</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { preloadUserProfile, getUserProfileCached, getCachedUserProfileSync } from '../../utils/userProfilePreloader';
import AppAvatar from '../common/AppAvatar.vue';
import AppImage from '../common/AppImage.vue';

interface Props {
  uid?: string | number;
  username?: string;
  avatar?: string;
  level?: number | string;
  verifyTitle?: string;
  device?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const router = useRouter();
const authStore = useAuthStore();

const triggerRef = ref<HTMLElement | null>(null);
const cardRef = ref<HTMLElement | null>(null);

const visible = ref(false);
const hasMounted = ref(false);
const loading = ref(false);
const profile = ref<any>(null);
const isFollowing = ref(false);
const followLoading = ref(false);

const popoverStyle = ref({
  top: '0px',
  left: '0px',
});

let showTimer: any = null;
let hideTimer: any = null;

const currentUid = computed(() => String(props.uid || '').trim());
const isSelf = computed(() => authStore.user?.uid && String(authStore.user.uid) === currentUid.value);

// 初始化时若缓存中有数据直接同步展示
const cachedInit = getCachedUserProfileSync(currentUid.value);
if (cachedInit) {
  profile.value = cachedInit;
  isFollowing.value = Number(cachedInit?.isFollow) === 1;
}

const currentUsername = computed(() => profile.value?.username || props.username || '酷友');
// 关键：绝对优先锁定使用外层已加载完成的头像地址 props.avatar，绝不发生二次请求与闪烁
const currentAvatar = computed(() => {
  return (
    props.avatar ||
    profile.value?.userAvatar ||
    profile.value?.avatar ||
    profile.value?.user_avatar ||
    ''
  );
});
const currentLevel = computed(() => Number(profile.value?.level ?? props.level ?? 0));
const currentVerify = computed(() => profile.value?.verify_title || props.verifyTitle || '');

const userBioText = computed(() => {
  if (profile.value?.bio && String(profile.value.bio).trim()) {
    return String(profile.value.bio).trim();
  }
  return '这个酷友很懒，什么都没写~';
});

// 统计数字精准适配各种返回字段
const followCount = computed(() => {
  if (!profile.value) return '-';
  return profile.value.follow ?? profile.value.followNum ?? profile.value.follow_num ?? profile.value.follownum ?? 0;
});

const fansCount = computed(() => {
  if (!profile.value) return '-';
  return profile.value.fans ?? profile.value.fansNum ?? profile.value.fans_num ?? profile.value.fansnum ?? 0;
});

const likeCount = computed(() => {
  if (!profile.value) return '-';
  return profile.value.be_like_num ?? profile.value.likeNum ?? profile.value.beLikeNum ?? profile.value.likenum ?? 0;
});

const feedCount = computed(() => {
  if (!profile.value) return '-';
  return profile.value.feed ?? profile.value.feedNum ?? profile.value.feed_num ?? profile.value.feed_count ?? profile.value.feednum ?? 0;
});

const tagList = computed(() => {
  const tags: { text: string; icon?: string }[] = [];
  const ip = profile.value?.ip_location || profile.value?.city || profile.value?.ipLocation;
  if (ip) {
    tags.push({ text: `IP: ${ip}`, icon: 'fas fa-location-dot' });
  }
  const dev = profile.value?.device_title || profile.value?.device || props.device;
  if (dev) {
    tags.push({ text: dev, icon: 'fas fa-mobile-alt' });
  }
  return tags;
});

function formatNum(val: any): string {
  if (val === undefined || val === null || val === '' || val === '-') return '-';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  if (n >= 10000) {
    const w = (n / 10000).toFixed(1);
    return w.endsWith('.0') ? `${Math.floor(n / 10000)}w` : `${w}w`;
  }
  return n.toLocaleString();
}

function calculatePosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const popoverWidth = 300;
  const popoverHeight = 250;

  // 水平定位：尽量与触发器左对齐，并做视口防溢出
  let left = rect.left;
  if (left + popoverWidth > window.innerWidth - 12) {
    left = window.innerWidth - popoverWidth - 12;
  }
  if (left < 12) left = 12;

  // 垂直定位：优先放在下方，空间不够则放在上方
  let top = rect.bottom + 8;
  if (top + popoverHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - popoverHeight - 8);
  }

  popoverStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  };
}

async function fetchUserData() {
  if (!currentUid.value) return;

  const cached = getCachedUserProfileSync(currentUid.value);
  if (cached) {
    profile.value = cached;
    isFollowing.value = Number(cached?.isFollow) === 1;
    return;
  }

  loading.value = true;
  try {
    const data = await getUserProfileCached(currentUid.value, {
      username: props.username,
      userAvatar: props.avatar,
      level: props.level,
      verify_title: props.verifyTitle,
    });
    if (data) {
      profile.value = data;
      isFollowing.value = Number(data?.isFollow) === 1;
    }
  } finally {
    loading.value = false;
  }
}

// 挂载与 UID 变化时，立即后台静默预加载
onMounted(() => {
  if (currentUid.value) {
    preloadUserProfile(currentUid.value);
  }
});

watch(currentUid, (newUid) => {
  if (newUid) {
    const syncData = getCachedUserProfileSync(newUid);
    if (syncData) {
      profile.value = syncData;
      isFollowing.value = Number(syncData?.isFollow) === 1;
    }
    preloadUserProfile(newUid);
  }
});

function handleTriggerMouseEnter() {
  if (props.disabled || !currentUid.value) return;

  // 移入时再次确保预加载或立即读取缓存
  void fetchUserData();

  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  showTimer = setTimeout(() => {
    hasMounted.value = true;
    calculatePosition();
    visible.value = true;
    void nextTick(() => {
      calculatePosition();
    });
  }, 280);
}

function handleTriggerMouseLeave() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  hideTimer = setTimeout(() => {
    visible.value = false;
  }, 220);
}

function handleCardMouseEnter() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function handleCardMouseLeave() {
  hideTimer = setTimeout(() => {
    visible.value = false;
  }, 220);
}

function goToUser() {
  if (!currentUid.value) return;
  visible.value = false;
  router.push(`/user/${encodeURIComponent(currentUid.value)}`);
}

function sendDirectMessage() {
  if (!currentUid.value) return;
  visible.value = false;
  router.push({ path: '/messages', query: { targetUid: currentUid.value, name: currentUsername.value } });
}

async function toggleFollow() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (followLoading.value || !currentUid.value) return;

  followLoading.value = true;
  const targetFollow = !isFollowing.value;
  try {
    if (targetFollow) {
      await CoolapkTauriAPI.followUser(currentUid.value);
      isFollowing.value = true;
    } else {
      await CoolapkTauriAPI.unfollowUser(currentUid.value);
      isFollowing.value = false;
    }
    // 更新缓存
    if (profile.value) {
      profile.value.isFollow = isFollowing.value ? 1 : 0;
    }
  } catch (err: any) {
    console.error('关注操作失败', err);
  } finally {
    followLoading.value = false;
  }
}

onUnmounted(() => {
  if (showTimer) clearTimeout(showTimer);
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<style scoped>
.user-hover-trigger {
  display: inline-flex;
  vertical-align: middle;
}

.user-hover-popover {
  position: fixed;
  z-index: 9999;
  width: 300px;
  background-color: var(--surface, #ffffff);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: 14px;
  box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  user-select: none;
  backdrop-filter: blur(16px);
  animation: popoverIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes popoverIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 顶部封面图/背景渐变 */
.card-cover-header {
  position: relative;
  width: 100%;
  height: 68px;
  background-color: var(--background-secondary, #f1f5f9);
  overflow: hidden;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.25s ease;
}

.cover-gradient {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(59, 130, 246, 0.18) 100%);
}

.cover-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 35%, var(--surface, #ffffff) 100%);
}

.card-body {
  padding: 0 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 头像与关注按钮行 */
.card-avatar-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: -30px;
  position: relative;
  z-index: 2;
}

.avatar-box {
  cursor: pointer;
  border-radius: 50%;
  padding: 2px;
  background: var(--surface, #ffffff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s ease;
}

.avatar-box:hover {
  transform: scale(1.05);
}

.card-avatar {
  display: block;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.btn-follow {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 12.5px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.35);
  transition: all 0.15s ease;
}

.btn-follow:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}

.btn-follow.is-following {
  background: var(--surface-hover, #f1f5f9);
  color: var(--text-secondary, #64748b);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  box-shadow: none;
}

.btn-follow.is-following:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.btn-msg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--surface-hover, #f1f5f9);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-msg:hover {
  color: var(--brand-primary, #10b981);
  border-color: var(--brand-primary, #10b981);
  background: var(--surface, #ffffff);
}

.btn-self {
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  background: var(--surface-hover, #f1f5f9);
  color: var(--text-secondary, #64748b);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  cursor: pointer;
}

/* 昵称与等级认证 */
.user-name-box {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  cursor: pointer;
}

.user-nickname {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
}

.user-nickname:hover {
  color: var(--brand-primary, #10b981);
}

.user-level-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  color: #ffffff;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.verify-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #d97706;
  background: rgba(245, 158, 11, 0.12);
  padding: 1px 6px;
  border-radius: 10px;
}

.verify-text {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 简介签名 */
.bio-container {
  min-height: 18px;
}

.user-bio {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-secondary, #64748b);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  transition: opacity 0.2s ease;
}

/* 骨架屏动画 */
.skeleton-pulse {
  background: linear-gradient(90deg, var(--surface-hover, #f1f5f9) 25%, var(--background-secondary, #e2e8f0) 50%, var(--surface-hover, #f1f5f9) 75%);
  background-size: 200% 100%;
  animation: skeletonPulse 1.4s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes skeletonPulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-line {
  width: 75%;
  height: 14px;
  border-radius: 4px;
}

.stat-skeleton {
  width: 28px;
  height: 16px;
  margin-bottom: 2px;
}

/* 标签行 */
.user-tags-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-tertiary, #94a3b8);
  background: var(--background-secondary, #f1f5f9);
  padding: 2px 7px;
  border-radius: 6px;
}

/* 4 格数据统计 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border-light, rgba(0, 0, 0, 0.05));
  cursor: pointer;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  border-radius: 8px;
  transition: background-color 0.15s ease;
}

.stat-item:hover {
  background-color: var(--surface-hover, #f8fafc);
}

.stat-num {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
}

.stat-label {
  font-size: 11px;
  color: var(--text-tertiary, #94a3b8);
}

/* 过渡动画 */
.hover-card-fade-enter-active,
.hover-card-fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

.hover-card-fade-enter-from,
.hover-card-fade-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
</style>
