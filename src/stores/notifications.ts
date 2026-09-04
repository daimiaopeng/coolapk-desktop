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
  const notificationStateVersion = ref(0);

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
    let remainingServerTotalDecrease = serverTotal.value === null
      ? 0
      : Math.max(0, serverTotal.value - snapshot.total);

    for (const category of CATEGORY_NAMES) {
      // checkCount 的部分版本只返回总数；缺少分类字段时保留已从通知列表恢复的数字。
      if (!snapshot.categoryPresence[category]) continue;
      const previousLocallyViewedCount = locallyViewed[category];
      const reconciled = reconcileViewedCount(
        serverCategoryCounts[category],
        snapshot.categories[category],
        locallyViewed[category],
        remainingServerTotalDecrease,
      );
      categoryCounts[category] = reconciled.count;
      locallyViewed[category] = reconciled.locallyViewedCount;
      serverCategoryCounts[category] = snapshot.categories[category];
      remainingServerTotalDecrease = Math.max(
        0,
        remainingServerTotalDecrease - (previousLocallyViewedCount - reconciled.locallyViewedCount),
      );
    }

    const acknowledgedUnknownCount = Math.min(
      locallyViewedWithoutCategory.value,
      remainingServerTotalDecrease,
    );
    locallyViewedWithoutCategory.value -= acknowledgedUnknownCount;
    remainingServerTotalDecrease -= acknowledgedUnknownCount;

    // 有些账号会先把分类字段清零、稍后才降低总 badge。总数最终下降时，
    // 再释放这类分类的本地抵消，避免下一条真实通知被旧状态压住。
    for (const category of CATEGORY_NAMES) {
      if (remainingServerTotalDecrease <= 0 || serverCategoryCounts[category] !== 0) continue;
      const acknowledgedCount = Math.min(locallyViewed[category], remainingServerTotalDecrease);
      locallyViewed[category] -= acknowledgedCount;
      remainingServerTotalDecrease -= acknowledgedCount;
    }

    const locallyViewedCategoryTotal = CATEGORY_NAMES.reduce(
      (total, category) => total + locallyViewed[category],
      0,
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

  /**
   * 通知列表项里的 notifyCount 是分类计数的另一条可靠来源。
   * 同步它时不改变 checkCount 的总数，只让分类角标和本地已读抵消保持一致。
   */
  function applyCategoryCount(category: NotificationCategory, currentServerCount: number): number {
    const count = Number(currentServerCount);
    if (!Number.isFinite(count)) return categoryCounts[category];
    const safeCount = Math.max(0, Math.floor(count));

    // 之前只有总 badge 时无法判断分类；分类一旦从列表中识别出来，优先把这部分
    // 本地抵消量归属到该分类，避免“点过后打开预览又重新出现”。
    const reattributedCount = Math.min(locallyViewedWithoutCategory.value, safeCount);
    if (reattributedCount > 0) {
      locallyViewedWithoutCategory.value -= reattributedCount;
      locallyViewed[category] += reattributedCount;
    }

    const reconciled = reconcileViewedCount(
      serverCategoryCounts[category],
      safeCount,
      locallyViewed[category],
    );
    categoryCounts[category] = reconciled.count;
    locallyViewed[category] = reconciled.locallyViewedCount;
    serverCategoryCounts[category] = safeCount;

    const locallyViewedTotal = CATEGORY_NAMES.reduce(
      (total, itemCategory) => total + locallyViewed[itemCategory],
      0,
    ) + locallyViewedWithoutCategory.value;
    const visibleCategoryTotal = CATEGORY_NAMES.reduce(
      (total, itemCategory) => total + categoryCounts[itemCategory],
      0,
    );
    if (serverTotal.value === null) {
      unreadCount.value = Math.max(unreadCount.value, visibleCategoryTotal);
    } else {
      unreadCount.value = Math.max(
        0,
        serverTotal.value - locallyViewedTotal,
        visibleCategoryTotal,
      );
    }
    return categoryCounts[category];
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

  /**
   * 启动后经列表标识核对确认的旧通知，可能尚未有可用的分类计数。
   * 先从总数抵消，后续拿到分类字段时 applyCategoryCount 会自动归属到对应分类。
   */
  function suppressNotificationCount(count: number): number {
    const requested = Number(count);
    if (!Number.isFinite(requested) || requested <= 0) return 0;

    const suppressed = Math.min(Math.floor(requested), notificationCount.value);
    if (suppressed <= 0) return 0;

    locallyViewedWithoutCategory.value += suppressed;
    unreadCount.value = Math.max(0, unreadCount.value - suppressed);
    return suppressed;
  }

  /**
   * 服务端偶尔会把自己发出的最后一条私信也计入 message 未读。
   * 仅扣除已由会话列表明确识别为“自己发送”的数量，并保留本地抵消量，
   * 避免下一次 checkCount 在服务端尚未修正前再次显示红点。
   */
  function suppressMessageCount(count: number): number {
    const requested = Number(count);
    if (!Number.isFinite(requested) || requested <= 0) return 0;

    const suppressed = Math.min(Math.floor(requested), categoryCounts.message);
    if (suppressed <= 0) return 0;

    categoryCounts.message -= suppressed;
    locallyViewed.message += suppressed;
    unreadCount.value = Math.max(0, unreadCount.value - suppressed);
    return suppressed;
  }

  /** 开始清除通知，阻止已经发出的旧 checkCount 响应覆盖当前状态。 */
  function beginNotificationClear(): void {
    notificationStateVersion.value += 1;
  }

  /** 服务端确认清除站内通知后丢弃旧的本地抵消，避免吞掉下一条新通知。 */
  function markNotificationsCleared(): void {
    notificationStateVersion.value += 1;
    const remainingMessageCount = categoryCounts.message;
    for (const category of CATEGORY_NAMES) {
      if (category === 'message') continue;
      categoryCounts[category] = 0;
      serverCategoryCounts[category] = 0;
      locallyViewed[category] = 0;
    }
    locallyViewedWithoutCategory.value = 0;
    unreadCount.value = remainingMessageCount;
    // feed 清除后，当前已知的服务端基线只剩私信，后续新通知从 0 正常计入。
    serverTotal.value = remainingMessageCount;
  }

  /** 显式执行全部已读时清除站内通知，私信未读保持不变。 */
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
    notificationStateVersion.value += 1;
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
    notificationStateVersion,
    applyServerResponse,
    applyCategoryCount,
    markViewed,
    markCategoryViewed,
    suppressNotificationCount,
    suppressMessageCount,
    beginNotificationClear,
    markNotificationsCleared,
    markAllNotificationsViewed,
    reset,
  };
});
