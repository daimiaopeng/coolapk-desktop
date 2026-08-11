import { computed, reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  normalizeNotificationCounts,
  reconcileViewedCount,
  type NotificationCategory,
} from '../utils/notificationCount';

const CATEGORY_NAMES: NotificationCategory[] = [
  'comment',
  'atMe',
  'atComment',
  'like',
  'follow',
  'message',
];

function createCategoryCounts(): Record<NotificationCategory, number> {
  return {
    comment: 0,
    atMe: 0,
    atComment: 0,
    like: 0,
    follow: 0,
    message: 0,
  };
}

export const useNotificationStore = defineStore('notifications', () => {
  const unreadCount = ref(0);
  const categoryCounts = reactive(createCategoryCounts());
  const serverTotal = ref<number | null>(null);
  const serverCategoryCounts = reactive<Record<NotificationCategory, number | null>>({
    comment: null,
    atMe: null,
    atComment: null,
    like: null,
    follow: null,
    message: null,
  });
  const locallyViewed = reactive(createCategoryCounts());
  const locallyViewedWithoutCategory = ref(0);

  const notificationCount = computed(() => Math.max(0, unreadCount.value - categoryCounts.message));
  const messageCount = computed(() => categoryCounts.message);

  function applyServerResponse(response: unknown): {
    previous: number | null;
    count: number;
    increasedCategories: NotificationCategory[];
  } {
    const snapshot = normalizeNotificationCounts(response);
    const previous = serverTotal.value === null ? null : unreadCount.value;
    const previousCategoryCounts = { ...categoryCounts };
    const previousLocallyViewedTotal = CATEGORY_NAMES.reduce(
      (total, category) => total + locallyViewed[category],
      0
    );

    for (const category of CATEGORY_NAMES) {
      const reconciled = reconcileViewedCount(
        serverCategoryCounts[category],
        snapshot.categories[category],
        locallyViewed[category]
      );
      categoryCounts[category] = reconciled.count;
      locallyViewed[category] = reconciled.locallyViewedCount;
      serverCategoryCounts[category] = snapshot.categories[category];
    }

    const locallyViewedCategoryTotal = CATEGORY_NAMES.reduce(
      (total, category) => total + locallyViewed[category],
      0
    );
    const acknowledgedCategoryCount = Math.max(
      0,
      previousLocallyViewedTotal - locallyViewedCategoryTotal
    );
    const serverTotalDecrease = serverTotal.value === null
      ? 0
      : Math.max(0, serverTotal.value - snapshot.total);
    const acknowledgedUnknownCount = Math.max(
      0,
      serverTotalDecrease - acknowledgedCategoryCount
    );
    locallyViewedWithoutCategory.value = Math.max(
      0,
      locallyViewedWithoutCategory.value - acknowledgedUnknownCount
    );
    const locallyViewedTotal = locallyViewedCategoryTotal + locallyViewedWithoutCategory.value;
    unreadCount.value = Math.max(0, snapshot.total - locallyViewedTotal);
    const increasedCategories = serverTotal.value === null
      ? []
      : CATEGORY_NAMES.filter(
        (category) => categoryCounts[category] > previousCategoryCounts[category]
      );
    serverTotal.value = snapshot.total;
    return { previous, count: unreadCount.value, increasedCategories };
  }

  /** 用户打开一条通知时先在本地扣减，两个角标会立即同步。 */
  function markViewed(category: NotificationCategory): boolean {
    if (unreadCount.value <= 0) return false;
    if (categoryCounts[category] > 0) {
      categoryCounts[category] -= 1;
      locallyViewed[category] += 1;
    } else {
      // 部分账号只返回总数 badge，不返回分类数量，仍要保证点击后角标即时消失。
      locallyViewedWithoutCategory.value += 1;
    }
    unreadCount.value -= 1;
    return true;
  }

  function markCategoryViewed(category: NotificationCategory): number {
    const count = categoryCounts[category];
    if (count <= 0) return 0;
    categoryCounts[category] = 0;
    locallyViewed[category] += count;
    unreadCount.value = Math.max(0, unreadCount.value - count);
    return count;
  }

  /** 进入通知中心即视为已查看所有站内通知，私信未读保持不变。 */
  function markAllNotificationsViewed(): number {
    const count = notificationCount.value;
    if (count <= 0) return 0;

    let categorizedCount = 0;
    for (const category of CATEGORY_NAMES) {
      if (category === 'message') continue;
      const categoryCount = categoryCounts[category];
      if (categoryCount <= 0) continue;
      categorizedCount += categoryCount;
      locallyViewed[category] += categoryCount;
      categoryCounts[category] = 0;
    }
    locallyViewedWithoutCategory.value += Math.max(0, count - categorizedCount);
    unreadCount.value = Math.max(0, unreadCount.value - count);
    return count;
  }

  function reset() {
    unreadCount.value = 0;
    serverTotal.value = null;
    locallyViewedWithoutCategory.value = 0;
    for (const category of CATEGORY_NAMES) {
      categoryCounts[category] = 0;
      serverCategoryCounts[category] = null;
      locallyViewed[category] = 0;
    }
  }

  return {
    unreadCount,
    categoryCounts,
    notificationCount,
    messageCount,
    applyServerResponse,
    markViewed,
    markCategoryViewed,
    markAllNotificationsViewed,
    reset,
  };
});
