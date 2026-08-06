<template>
  <div class="sidebar-card">
    <div class="card-header">
      <h3 class="card-title"><i class="fas fa-user-plus icon-user"></i> 推荐酷友</h3>
      <button class="refresh-btn" title="刷新推荐" @click="fetchUsers">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>
    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在获取推荐用户" />
    </div>
    <div v-else-if="users.length === 0" class="empty-wrapper">
      <EmptyState title="暂无推荐" />
    </div>
    <div v-else class="user-list">
      <div
        v-for="user in users"
        :key="user.uid"
        class="user-item"
        :title="user.username"
        @click="openUser(user)"
      >
        <AppAvatar :src="user.avatar" size="sm" :alt="user.username" />
        <div class="user-info">
          <span class="user-name">{{ user.username }}</span>
          <span class="user-desc">{{ user.verifyTitle || '酷安用户' }}</span>
        </div>
        <AppButton variant="soft" size="sm" @click.stop="toggleFollow(user)">{{ user.following ? '已关注' : '关注' }}</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppAvatar from '../common/AppAvatar.vue';
import AppButton from '../common/AppButton.vue';
import LoadingState from '../common/LoadingState.vue';
import EmptyState from '../common/EmptyState.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';

const router = useRouter();
const users = ref<any[]>([]);
const loading = ref(false);

async function fetchUsers() {
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getRecommendUsers();
    if (res && res.data && Array.isArray(res.data)) {
      users.value = res.data.slice(0, 5);
    }
  } catch (err) {
    console.error('Failed to fetch recommend users', err);
  } finally {
    loading.value = false;
  }
}

function openUser(user: any) {
  if (user.uid) {
    router.push(`/user/${user.uid}`);
  }
}

async function toggleFollow(user: any) {
  try {
    if (user.following) {
      await CoolapkTauriAPI.unfollowUser(String(user.uid));
    } else {
      await CoolapkTauriAPI.followUser(String(user.uid));
    }
    user.following = !user.following;
  } catch (err) {
    console.error('关注操作失败', err);
  }
}

onMounted(fetchUsers);
</script>

<style scoped>
.sidebar-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  overflow: hidden;
  min-width: 0;
}

.card-header {
  margin-bottom: var(--space-3);
}

.card-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-user {
  color: var(--info);
}

.refresh-btn {
  color: var(--text-tertiary);
  font-size: 12px;
  padding: 4px;
  border-radius: var(--radius-xs);
  transition: color var(--duration-fast) var(--ease-default);
}

.refresh-btn:hover {
  color: var(--brand-primary);
}

.loading-wrapper, .empty-wrapper {
  padding: 12px 0;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.user-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-desc {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
