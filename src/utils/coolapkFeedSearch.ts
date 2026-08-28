export interface FeedSearchSortOption {
  key: string;
  label: string;
  searchSort: string;
  isStrict?: boolean;
}

export interface FeedTypeOption {
  key: string;
  label: string;
}

/** APK SuperSearchFragment 的动态搜索排序选项。 */
export const FEED_SEARCH_SORT_OPTIONS: FeedSearchSortOption[] = [
  { key: 'default', label: '综合', searchSort: 'none' },
  { key: 'latest', label: '实时', searchSort: 'dateline' },
  { key: 'hot', label: '热度', searchSort: 'hot' },
  { key: 'comment', label: '评论', searchSort: 'reply' },
  { key: 'accurate', label: '精确', searchSort: '', isStrict: true },
];

/** APK pageType=tag 使用的动态类型列表。 */
export const TOPIC_FEED_TYPE_OPTIONS: FeedTypeOption[] = [
  { key: 'all', label: '全部' },
  { key: 'feed', label: '动态' },
  { key: 'feedArticle', label: '图文' },
  { key: 'picture', label: '酷图' },
  { key: 'question', label: '提问' },
  { key: 'answer', label: '回答' },
  { key: 'comment', label: '评论' },
  { key: 'video', label: '视频' },
  { key: 'ershou', label: '二手' },
  { key: 'vote', label: '投票' },
];

/** APK pageType=product_phone 使用的动态类型列表。 */
export const PRODUCT_FEED_TYPE_OPTIONS: FeedTypeOption[] = [
  { key: 'all', label: '全部' },
  { key: 'feed', label: '动态' },
  { key: 'feedArticle', label: '图文' },
  { key: 'rating', label: '点评' },
  { key: 'goods', label: '好物推荐' },
  { key: 'picture', label: '酷图' },
  { key: 'question', label: '提问' },
  { key: 'answer', label: '回答' },
  { key: 'comment', label: '评论' },
  { key: 'video', label: '视频' },
  { key: 'ershou', label: '二手' },
  { key: 'vote', label: '投票' },
];

export function resolveFeedSearchSort(key: string) {
  const option = FEED_SEARCH_SORT_OPTIONS.find((item) => item.key === key)
    || FEED_SEARCH_SORT_OPTIONS[0];

  return {
    sort: option.searchSort,
    isStrict: option.isStrict ? 1 : 0,
  };
}
