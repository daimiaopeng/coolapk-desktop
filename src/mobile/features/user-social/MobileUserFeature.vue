<template>
  <section
    class="mobile-user-feature"
    :class="{ 'mobile-user-feature--static': !scroll }"
    :data-mobile-state="featureState"
    data-mobile-feature="user"
    :aria-busy="loading"
    aria-label="用户资料"
  >
    <header
      v-if="showBack || title || $slots.toolbar || $slots['toolbar-actions']"
      class="mobile-user-feature__toolbar"
      data-mobile-surface="toolbar"
    >
      <button
        v-if="showBack"
        type="button"
        class="mobile-user-feature__back"
        :aria-label="backLabel"
        @click="handleBack"
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span v-if="backLabel">{{ backLabel }}</span>
      </button>

      <slot name="toolbar" :title="title" :back="handleBack">
        <h1 v-if="title">{{ title }}</h1>
      </slot>

      <div v-if="$slots['toolbar-actions']" class="mobile-user-feature__toolbar-actions">
        <slot name="toolbar-actions" />
      </div>
    </header>

    <div class="mobile-user-feature__scroll" :class="{ 'mobile-user-feature__scroll--static': !scroll }">
      <section
        v-if="profile || $slots.profile || $slots.actions || $slots.relations || loading"
        class="mobile-user-feature__profile-surface"
        data-mobile-surface="profile"
      >
        <slot name="profile" :profile="profile" :loading="loading" :state="featureState">
          <template v-if="profile">
            <div v-if="profile.cover" class="mobile-user-feature__cover" aria-hidden="true">
              <img :src="profile.cover" alt="" referrerpolicy="no-referrer" />
              <span class="mobile-user-feature__cover-shade"></span>
            </div>

            <div class="mobile-user-feature__profile-body">
              <div class="mobile-user-feature__identity">
                <div class="mobile-user-feature__avatar" aria-hidden="true">
                  <img
                    v-if="profile.avatar || profile.userAvatar"
                    :src="profile.avatar || profile.userAvatar"
                    :alt="profile.avatarAlt || profileName(profile)"
                    referrerpolicy="no-referrer"
                  />
                  <span v-else>{{ profileInitial(profile) }}</span>
                </div>

                <div class="mobile-user-feature__identity-copy">
                  <div class="mobile-user-feature__name-row">
                    <h1>{{ profileName(profile) }}</h1>
                    <span v-if="profile.level !== undefined && profile.level !== ''" class="mobile-user-feature__level">
                      Lv.{{ profile.level }}
                    </span>
                    <span v-if="profile.verifiedLabel" class="mobile-user-feature__verified">
                      <i class="fas fa-check-circle" aria-hidden="true"></i>
                      {{ profile.verifiedLabel }}
                    </span>
                  </div>
                  <p class="mobile-user-feature__bio">
                    {{ profile.bio || '这个人很懒，还没有签名' }}
                  </p>
                </div>
              </div>

              <div v-if="profile.stats?.length" class="mobile-user-feature__stats" aria-label="用户数据">
                <span v-for="stat in profile.stats" :key="stat.key || stat.label" class="mobile-user-feature__stat">
                  <strong>{{ stat.value }}</strong>
                  <small>{{ stat.label }}</small>
                </span>
              </div>
            </div>
          </template>

          <div v-else-if="loading" class="mobile-user-feature__profile-skeleton" aria-hidden="true">
            <span class="mobile-user-feature__skeleton-avatar"></span>
            <span class="mobile-user-feature__skeleton-copy"></span>
          </div>

          <div v-else class="mobile-user-feature__guest-profile">
            <div class="mobile-user-feature__avatar" aria-hidden="true">
              <span>酷</span>
            </div>
            <div>
              <strong>酷友</strong>
              <p>登录后查看完整个人资料</p>
            </div>
          </div>
        </slot>

        <div v-if="$slots.actions" class="mobile-user-feature__actions" data-mobile-surface="profile-actions">
          <slot name="actions" :profile="profile" :loading="loading" />
        </div>

        <div v-if="$slots.relations" class="mobile-user-feature__relations" data-mobile-surface="relations-actions">
          <slot name="relations" :profile="profile" :loading="loading" />
        </div>
      </section>

      <nav
        v-if="tabs?.length || $slots.tabs"
        class="mobile-user-feature__tabs"
        data-mobile-surface="tabs"
        aria-label="用户内容分类"
      >
        <slot name="tabs" :tabs="tabs" :active-tab="activeTab" :select-tab="selectTab">
          <button
            v-for="(tab, index) in tabs"
            :key="tab.key"
            type="button"
            class="mobile-user-feature__tab"
            :class="{ 'is-active': isTabActive(tab.key, index) }"
            :aria-selected="isTabActive(tab.key, index)"
            role="tab"
            @click="selectTab(tab.key)"
          >
            <span>{{ tab.label }}</span>
            <small v-if="tab.count !== undefined">{{ tab.count }}</small>
          </button>
        </slot>
      </nav>

      <main class="mobile-user-feature__route-surface" data-route-surface data-feature-content>
        <div v-if="loading" class="mobile-user-feature__state" role="status" aria-live="polite">
          <slot name="loading">
            <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
            <span>正在加载用户资料…</span>
          </slot>
        </div>

        <div v-else-if="error" class="mobile-user-feature__state mobile-user-feature__state--error" role="alert">
          <slot name="error">
            <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
            <strong>{{ errorText }}</strong>
            <button type="button" class="mobile-user-feature__retry" @click="handleRetry">重试</button>
          </slot>
        </div>

        <div v-else-if="empty" class="mobile-user-feature__state">
          <slot name="empty">
            <i class="far fa-user" aria-hidden="true"></i>
            <span>{{ emptyText }}</span>
          </slot>
        </div>

        <div v-else class="mobile-user-feature__content">
          <slot :profile="profile" :state="featureState" />
        </div>
      </main>

      <footer v-if="$slots.footer" class="mobile-user-feature__footer" data-mobile-surface="footer">
        <slot name="footer" :profile="profile" />
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MobileUserProfile } from './types';

interface MobileUserTab {
  key: string;
  label: string;
  count?: string | number;
}

defineOptions({ name: 'MobileUserFeature' });

const props = withDefaults(
  defineProps<{
    /** Optional data for the adapter-owned default profile header. */
    profile?: MobileUserProfile;
    title?: string;
    showBack?: boolean;
    backLabel?: string;
    loading?: boolean;
    error?: boolean;
    errorText?: string;
    empty?: boolean;
    emptyText?: string;
    scroll?: boolean;
    tabs?: readonly MobileUserTab[];
    activeTab?: string;
  }>(),
  {
    profile: undefined,
    title: '',
    showBack: false,
    backLabel: '返回',
    loading: false,
    error: false,
    errorText: '加载失败，请稍后重试',
    empty: false,
    emptyText: '暂无用户内容',
    scroll: true,
    tabs: undefined,
    activeTab: '',
  },
);

const emit = defineEmits<{
  back: [];
  retry: [];
  'tab-change': [key: string];
}>();

const featureState = computed(() => {
  if (props.loading) return 'loading';
  if (props.error) return 'error';
  if (props.empty) return 'empty';
  return 'ready';
});

function profileName(profile?: MobileUserProfile): string {
  return profile?.name || profile?.username || '酷友';
}

function profileInitial(profile?: MobileUserProfile): string {
  return profileName(profile).trim().slice(0, 1).toUpperCase();
}

function handleBack() {
  emit('back');
}

function handleRetry() {
  emit('retry');
}

function isTabActive(key: string, index: number): boolean {
  return props.activeTab ? props.activeTab === key : index === 0;
}

function selectTab(key: string) {
  emit('tab-change', key);
}
</script>

<style scoped>
:host {
  --mobile-user-green: #0f9d58;
  --mobile-user-green-soft: #e5f7ee;
  --mobile-user-bg: #f2f2f6;
  --mobile-user-text: #202124;
  --mobile-user-muted: #85878d;
  --mobile-user-divider: #e5e5e8;
}

.mobile-user-feature {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--mobile-user-bg);
  color: var(--mobile-user-text);
}

.mobile-user-feature__toolbar {
  display: flex;
  flex: 0 0 56px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: max(0px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) 0
    max(12px, env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--mobile-user-divider);
  background: #fff;
}

.mobile-user-feature__toolbar > :nth-child(2) {
  flex: 1 1 auto;
  min-width: 0;
}

.mobile-user-feature__toolbar h1 {
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-user-feature__back,
.mobile-user-feature__toolbar-actions :deep(button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 40px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: var(--mobile-user-text);
  font: inherit;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-user-feature__back {
  flex: 0 0 auto;
  gap: 6px;
  padding: 0 4px;
  font-size: 14px;
}

.mobile-user-feature__back i {
  font-size: 18px;
}

.mobile-user-feature__toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.mobile-user-feature__scroll {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.mobile-user-feature__scroll--static {
  overflow: hidden;
}

.mobile-user-feature__profile-surface {
  overflow: hidden;
  background: #fff;
  border-bottom: 1px solid var(--mobile-user-divider);
}

.mobile-user-feature__cover {
  position: relative;
  height: clamp(96px, 26vw, 168px);
  overflow: hidden;
  background: #e8edf0;
}

.mobile-user-feature__cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-user-feature__cover-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(32, 33, 36, 0.02), rgba(32, 33, 36, 0.34));
  pointer-events: none;
}

.mobile-user-feature__profile-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px max(16px, env(safe-area-inset-left, 0px)) 16px
    max(16px, env(safe-area-inset-right, 0px));
}

.mobile-user-feature__identity,
.mobile-user-feature__guest-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.mobile-user-feature__avatar {
  display: grid;
  flex: 0 0 68px;
  place-items: center;
  width: 68px;
  height: 68px;
  overflow: hidden;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--mobile-user-green-soft);
  color: var(--mobile-user-green);
  font-size: 25px;
  font-weight: 700;
  box-shadow: 0 2px 12px rgba(32, 33, 36, 0.12);
}

.mobile-user-feature__avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-user-feature__identity-copy,
.mobile-user-feature__guest-profile > div:last-child {
  min-width: 0;
}

.mobile-user-feature__name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.mobile-user-feature__name-row h1 {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-user-feature__level,
.mobile-user-feature__verified {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 20px;
  white-space: nowrap;
}

.mobile-user-feature__level {
  background: #f1f2f3;
  color: var(--mobile-user-muted);
}

.mobile-user-feature__verified {
  max-width: 100%;
  overflow: hidden;
  background: var(--mobile-user-green-soft);
  color: var(--mobile-user-green);
  text-overflow: ellipsis;
}

.mobile-user-feature__bio {
  margin: 5px 0 0;
  overflow: hidden;
  color: var(--mobile-user-muted);
  font-size: 13px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-user-feature__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
  gap: 4px;
  padding-top: 2px;
}

.mobile-user-feature__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  padding: 4px;
}

.mobile-user-feature__stat strong {
  font-size: 16px;
  line-height: 1.2;
}

.mobile-user-feature__stat small {
  overflow: hidden;
  color: var(--mobile-user-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-user-feature__guest-profile {
  padding: 20px max(16px, env(safe-area-inset-left, 0px));
}

.mobile-user-feature__guest-profile strong {
  font-size: 18px;
}

.mobile-user-feature__guest-profile p {
  margin: 4px 0 0;
  color: var(--mobile-user-muted);
  font-size: 13px;
}

.mobile-user-feature__actions,
.mobile-user-feature__relations {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 max(16px, env(safe-area-inset-left, 0px)) 14px
    max(16px, env(safe-area-inset-right, 0px));
}

.mobile-user-feature__relations {
  padding-top: 2px;
  border-top: 1px solid var(--mobile-user-divider);
}

.mobile-user-feature__actions :deep(button),
.mobile-user-feature__relations :deep(button),
.mobile-user-feature__content :deep(button),
.mobile-user-feature__content :deep(a) {
  min-height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-user-feature__tabs {
  display: flex;
  min-width: 0;
  overflow-x: auto;
  padding: 0 max(12px, env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--mobile-user-divider);
  background: #fff;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-user-feature__tabs::-webkit-scrollbar {
  display: none;
}

.mobile-user-feature__tab {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 72px;
  min-height: 48px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--mobile-user-muted);
  font: inherit;
  font-size: 14px;
  touch-action: manipulation;
}

.mobile-user-feature__tab::after {
  position: absolute;
  right: 18px;
  bottom: 0;
  left: 18px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: transparent;
  content: '';
}

.mobile-user-feature__tab.is-active {
  color: var(--mobile-user-green);
  font-weight: 700;
}

.mobile-user-feature__tab.is-active::after {
  background: var(--mobile-user-green);
}

.mobile-user-feature__tab small {
  color: currentColor;
  font-size: 11px;
}

.mobile-user-feature__route-surface {
  min-width: 0;
  min-height: 160px;
  padding: 12px max(12px, env(safe-area-inset-left, 0px)) calc(28px + env(safe-area-inset-bottom, 0px))
    max(12px, env(safe-area-inset-right, 0px));
}

.mobile-user-feature__content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.mobile-user-feature__state {
  display: grid;
  place-items: center;
  gap: 9px;
  min-height: 180px;
  padding: 28px 18px;
  color: var(--mobile-user-muted);
  font-size: 14px;
  text-align: center;
}

.mobile-user-feature__state > i {
  color: var(--mobile-user-green);
  font-size: 24px;
}

.mobile-user-feature__state--error > i {
  color: #e3483b;
}

.mobile-user-feature__state strong {
  color: var(--mobile-user-text);
  font-size: 14px;
  font-weight: 500;
}

.mobile-user-feature__retry {
  min-width: 84px;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--mobile-user-green);
  border-radius: 999px;
  background: #fff;
  color: var(--mobile-user-green);
  font: inherit;
  touch-action: manipulation;
}

.mobile-user-feature__footer {
  flex: 0 0 auto;
  padding: 10px max(12px, env(safe-area-inset-left, 0px)) max(10px, env(safe-area-inset-bottom, 0px))
    max(12px, env(safe-area-inset-right, 0px));
  border-top: 1px solid var(--mobile-user-divider);
  background: #fff;
}

.mobile-user-feature__profile-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
}

.mobile-user-feature__skeleton-avatar,
.mobile-user-feature__skeleton-copy {
  display: block;
  border-radius: 12px;
  background: linear-gradient(90deg, #edf0f1 20%, #f8f9f9 45%, #edf0f1 70%);
  background-size: 240% 100%;
  animation: mobile-user-skeleton 1.25s ease-in-out infinite;
}

.mobile-user-feature__skeleton-avatar {
  width: 68px;
  height: 68px;
  border-radius: 50%;
}

.mobile-user-feature__skeleton-copy {
  width: min(58%, 230px);
  height: 42px;
}

@keyframes mobile-user-skeleton {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@media (min-width: 720px) {
  .mobile-user-feature__scroll > * {
    width: min(100%, 720px);
    margin-inline: auto;
  }
}
</style>
