import { invoke } from '@tauri-apps/api/core';
import { router } from '../router';
import { getFeedDetailMessage, hasFeedMoreSuffix, parseWebFeedDetail } from '../utils/feedContent';
import { normalizeCoolapkRoute } from '../utils/coolapkRoute';
import { requestWithPolicy, type RequestKind } from '../utils/requestCenter';

async function safeFetchOnce(pythonEndpoint: string, tauriCmd: string, tauriArgs: any = {}) {
  let rustError: unknown;

  // 1. 优先使用 Tauri 2 原生 Rust Core (`client.rs`) 发起零延迟 API 请求
  try {
    const rustRes = await invoke(tauriCmd, tauriArgs);
    if (rustRes && (rustRes as any).code === 200) {
      return rustRes;
    }
    throw new Error(`Rust API returned an invalid response for ${tauriCmd}`);
  } catch (err) {
    rustError = err;
    console.warn(`[Tauri Invoke fallback to Python] cmd: ${tauriCmd}`, err);
  }

  // 2. 如果无 Tauri 环境，连通 Python 后端
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    
    const resp = await fetch(`http://127.0.0.1:8080/api${pythonEndpoint}`, {
      signal: controller.signal
    });
    clearTimeout(timer);

    const body = await resp.text();
    if (!resp.ok) {
      throw new Error(`Python API returned HTTP ${resp.status}: ${body.slice(0, 200)}`);
    }

    const json = JSON.parse(body);
    if (json && json.code === 200) {
      return json;
    }
    throw new Error(json?.message || 'Python API returned an invalid response');
  } catch (pythonError) {
    const rustMessage = rustError instanceof Error ? rustError.message : String(rustError);
    const pythonMessage = pythonError instanceof Error ? pythonError.message : String(pythonError);
    throw new Error(`接口请求失败。Rust: ${rustMessage}; Python: ${pythonMessage}`);
  }
}

async function safeFetch(pythonEndpoint: string, tauriCmd: string, tauriArgs: any = {}) {
  return requestWithPolicy(tauriCmd, () => safeFetchOnce(pythonEndpoint, tauriCmd, tauriArgs), { retry: true, kind: 'feed' });
}

type NativeRequestOptions = { retry?: boolean; maxAttempts?: number; timeoutMs?: number; kind?: RequestKind };

async function invokeNative(tauriCmd: string, tauriArgs: any = {}, options: NativeRequestOptions = {}) {
  return requestWithPolicy(tauriCmd, async () => {
    const response = await invoke(tauriCmd, tauriArgs);
    if (response && (response as any).code === 200) return response as any;
    throw new Error((response as any)?.message || `${tauriCmd} 返回格式不正确`);
  }, options);
}

export class CoolapkTauriAPI {
  // 1. 首页推荐
  static async getIndexV8Feeds(page: number = 1) {
    return await safeFetch(`/feeds/index_v8?page=${page}`, 'get_index_v8_feeds', { page });
  }

  static async getIndexV8FeedsPaged(options: {
    page: number;
    firstItem?: string;
    lastItem?: string;
  }) {
    return await invokeNative('get_index_v8_feeds_paged', {
      page: options.page,
      firstItem: options.firstItem || '',
      lastItem: options.lastItem || '',
    }, { retry: true, kind: 'feed' });
  }

  static async getIndexV8EntitiesPaged(options: {
    page: number;
    firstItem?: string;
    lastItem?: string;
  }) {
    return await invokeNative('get_index_v8_entities_paged', {
      page: options.page,
      firstItem: options.firstItem || '',
      lastItem: options.lastItem || '',
    }, { retry: true, kind: 'feed' });
  }

  // 1.1 首页 Tab 配置（关注/热榜/快讯/话题频道 + 热门搜索）
  static async getTabConfig() {
    return await invokeNative('get_tab_config');
  }

  // 1.1.2 云端同步首页 Tab 配置（POST /v6/account/updateConfig）
  static async updateHomeTabConfig(configJson: string) {
    return await invokeNative('update_home_tab_config', { configJson });
  }

  static async getDiscoveryConfig() {
    return await invokeNative('get_discovery_config', {}, { retry: true, kind: 'feed' });
  }

  static async getDiscoveryPageData(options: {
    url: string;
    title?: string;
    subTitle?: string;
    page?: number;
    firstItem?: string;
    lastItem?: string;
    pageContext?: string;
    requestArgs?: Record<string, unknown>;
  }) {
    const args: Record<string, unknown> = {
      url: options.url,
      title: options.title || '',
      subTitle: options.subTitle || '',
      page: options.page || 1,
      firstItem: options.firstItem || '',
      lastItem: options.lastItem || '',
      pageContext: options.pageContext || '',
    };
    if (options.requestArgs && Object.keys(options.requestArgs).length > 0) args.requestArgsJson = JSON.stringify(options.requestArgs);
    return await invokeNative('get_discovery_page_data', args, { retry: true, kind: 'feed' });
  }

  static async getLiveDetail(liveId: string) {
    return await invokeNative('get_live_detail', { liveId }, { retry: true, kind: 'feed' });
  }

  // 1.2 搜索候选词（输入联想）
  static async getSearchSuggestions(query: string) {
    return await invokeNative('get_search_suggestions', { query });
  }

  // 搜索页热门词（与 APK 的 type=hotSearch 接口一致）
  static async getHotSearches(refresh: boolean = true) {
    return await invokeNative('get_hot_searches', { refresh }, { retry: true, kind: 'feed' });
  }

  // 1.3 话题详情（旧版 tagDetail，字段与新版互补）
  static async getTopicDetailV7(tag: string) {
    return await invokeNative('get_topic_detail_v7', { tag });
  }

  // 1.4 产品（数码）详情与所属动态
  static async getProductDetail(productId: string) {
    return await invokeNative('get_product_detail', { productId });
  }

  static async getProductFeeds(productId: string, feedType: string = 'feed', page: number = 1, listType: string = '') {
    return await invokeNative('get_product_feeds', { productId, feedType, listType, page });
  }

  // 1.4.1 产品配置与对比
  static async getProductConfig(configId: string) {
    return await invokeNative('get_product_config', { configId });
  }

  static async addConfigCompare(configId: string) {
    return await invokeNative('add_config_compare', { configId });
  }

  static async removeConfigCompare(configId: string) {
    return await invokeNative('remove_config_compare', { configId });
  }

  // 1.4.2 数码品牌/分类/系列浏览
  static async getProductBrandList() {
    return await invokeNative('get_product_brand_list');
  }

  static async getProductCategoryList() {
    return await invokeNative('get_product_category_list');
  }

  static async getProductList(url: string, title: string = '', subTitle: string = '', page: number = 1, options: { firstItem?: string; lastItem?: string } = {}) {
    const args: Record<string, unknown> = { url, title, subTitle, page };
    if (options.firstItem) args.firstItem = options.firstItem;
    if (options.lastItem) args.lastItem = options.lastItem;
    return await invokeNative('get_product_list', args);
  }

  static async getProductBrandProducts(brandId: string, brandType: string = 'recommend', page: number = 1, options: { firstItem?: string; lastItem?: string } = {}) {
    const args: Record<string, unknown> = { brandId, brandType, page };
    if (options.firstItem) args.firstItem = options.firstItem;
    if (options.lastItem) args.lastItem = options.lastItem;
    return await invokeNative('get_product_brand_products', args);
  }

  // 1.4.3 产品媒体库
  static async getProductMediaList(productId: string, mediaType: string = 'image', isRecommend: number = 0, page: number = 1) {
    return await invokeNative('get_product_media_list', { productId, mediaType, isRecommend, page });
  }

  // 1.4.4 产品心愿单/已购
  static async changeProductWishStatus(productId: string, status: number) {
    return await invokeNative('change_product_wish_status', { productId, status });
  }

  static async getProductWishList(productId: string, page: number = 1) {
    return await invokeNative('get_product_wish_list', { productId, page });
  }

  static async getProductBuyList(productId: string, page: number = 1) {
    return await invokeNative('get_product_buy_list', { productId, page });
  }

  static async getMyProductList(uid: string, productType: string = 'wish', page: number = 1) {
    return await invokeNative('get_my_product_list', { uid, productType, page });
  }

  // 1.4.5 产品评分趋势与评分列表
  static async getProductRatingChart(productId: string) {
    return await invokeNative('get_product_rating_chart', { productId });
  }

  static async getProductRatingList(productId: string, star: number = 0, isOwner: number = 0, page: number = 1) {
    return await invokeNative('get_product_rating_list', { productId, star, isOwner, page });
  }

  static async getApkRatingUserList(apkId: string, page: number = 1) {
    return await invokeNative('get_apk_rating_user_list', { apkId, page });
  }

  // 产品评分使用 APK 的 /v6/apk/rating 接口；保留旧参数以兼容页面调用。
  static async changeRatingStatus(productId: string, value: number, uid: string, buyStatus?: number, isOwner?: number) {
    const args: any = { productId, value, uid };
    if (buyStatus !== undefined) args.buyStatus = buyStatus;
    if (isOwner !== undefined) args.isOwner = isOwner;
    return await invokeNative('change_rating_status', args);
  }

  // 1.5 看看号（官方号）详情与动态
  static async getDyhDetail(dyhId: string) {
    return await invokeNative('get_dyh_detail', { dyhId });
  }

  static async getDyhList(page: number = 1) {
    return await invokeNative('get_dyh_list', { page });
  }

  static async getDyhFeeds(dyhId: string, feedType: string = 'all', page: number = 1) {
    return await invokeNative('get_dyh_feeds', { dyhId, feedType, page });
  }

  // === 动态号管理 ===
  static async getMyDyhFollowList(page: number = 1) {
    return await invokeNative('get_dyh_follow_list', { page });
  }

  static async getMyDyhSubscribeList(page: number = 1) {
    return await invokeNative('get_dyh_subscribe_list', { page });
  }

  static async getMyDyhEditorList(page: number = 1) {
    return await invokeNative('get_dyh_editor_list', { page });
  }

  // === 酷友圈活动 ===
  static async getEventList(page: number = 1) {
    return await invokeNative('get_event_list', { page }, { retry: true, kind: 'feed' });
  }

  static async getEventDetail(eventId: string) {
    return await invokeNative('get_event_detail', { eventId });
  }

  // === 万物清单（productAlbum）===
  static async getUserProductAlbums(uid: string, page: number = 1) {
    return await invokeNative('get_user_product_albums', { uid, page });
  }

  static async getGoodsListItems(uid: string, goodsId: string, page: number = 1) {
    return await invokeNative('get_goods_list_items', { uid, goodsId, page });
  }

  static async createProductAlbum(options: {
    title: string;
    description?: string;
    albumType?: number;
    targetType?: string;
    targetId?: string;
    productItems?: any[];
  }) {
    return await invokeNative('create_product_album', {
      title: options.title,
      description: options.description || '',
      albumType: options.albumType ?? 0,
      targetType: options.targetType || '',
      targetId: options.targetId || '',
      productItems: JSON.stringify(options.productItems || []),
    }, { retry: false, kind: 'feed' });
  }

  // === 节点（版块）===
  static async getNodeFeeds(nodeType: string, nodeId: string, page: number = 1) {
    return await invokeNative('get_node_feeds', { nodeType, nodeId, page }, { retry: true, kind: 'feed' });
  }

  // 1.6 应用所属动态（点评/讨论）
  static async getApkFeeds(packageName: string, sortType: string = 'lastupdate_desc', page: number = 1) {
    return await invokeNative('get_apk_feeds', { packageName, sortType, page });
  }

  // 1.7 轻量登录态检查
  static async checkLoginInfo() {
    return await invokeNative('check_login_info');
  }

  // 2. 24H 热榜
  static async getHotFeeds(page: number = 1) {
    return await safeFetch(`/feeds/hot?page=${page}`, 'get_hot_feeds', { page });
  }

  static async getRankFeeds(rankType: string, page: number = 1) {
    return await invokeNative('get_rank_feeds', { rankType, page });
  }

  // 3. 全站最新
  static async getLatestFeeds(page: number = 1) {
    return await safeFetch(`/feeds/latest?page=${page}`, 'get_latest_feeds', { page });
  }

  // 4. 精选热帖
  static async getDigestFeeds(page: number = 1) {
    return await safeFetch(`/feeds/digest?page=${page}`, 'get_digest_feeds', { page });
  }

  // 5. 酷图热榜
  static async getCoolPictureRank(page: number = 1) {
    return await safeFetch(`/feeds/cool_picture?page=${page}`, 'get_cool_picture_rank', { page });
  }

  // 6. 酷品二手
  static async getSecondHandFeeds(page: number = 1) {
    return await safeFetch(`/feeds/secondhand?page=${page}`, 'get_secondhand_feeds', { page });
  }

  static async getBoardFeeds(boardTag: string, page: number = 1) {
    return await invokeNative('get_board_feeds', { boardTag, page });
  }

  // 游戏中心榜单与列表
  static async getGameList(gameType: string = 'hot', page: number = 1) {
    return await safeFetch(`/game/list?type=${gameType}&page=${page}`, 'get_game_list', { gameType, page });
  }

  // 应用中心榜单与分类列表
  static async getAppList(cat: string = 'recommend', page: number = 1) {
    return await safeFetch(`/apk/list?cat=${cat}&page=${page}`, 'get_app_list', { cat, page });
  }

  // 专项 APK / 软件 / 游戏搜索
  static async searchApks(query: string, page: number = 1) {
    return await safeFetch(`/search/apks?q=${encodeURIComponent(query)}&page=${page}`, 'search_apks', { query, page });
  }

  // 游戏专项搜索（type=game，仅返回游戏实体）
  static async searchGames(query: string, page: number = 1) {
    return await safeFetch(`/search/games?q=${encodeURIComponent(query)}&page=${page}`, 'search_games', { query, page });
  }




  // 7. 全站搜索
  static async searchAll(query: string, page: number = 1) {
    return await safeFetch(`/search?q=${encodeURIComponent(query)}&page=${page}`, 'search_all', { query, page });
  }

  // 按 APK 的动态 searchType 搜索，返回原始 Entity/Card 字段；sponsor 实体已在 Rust 端过滤。
  static async searchByType(options: {
    searchType: string;
    query: string;
    page?: number;
    firstItem?: string;
    lastItem?: string;
    pageType?: string;
    pageParam?: string;
    feedType?: string;
    sort?: string;
    isStrict?: number;
    category?: string;
    pageContext?: string;
  }) {
    return await invokeNative('search_by_type', {
      searchType: options.searchType,
      query: options.query,
      page: options.page || 1,
      firstItem: options.firstItem || '',
      lastItem: options.lastItem || '',
      pageType: options.pageType || '',
      pageParam: options.pageParam || '',
      feedType: options.feedType || '',
      sort: options.sort || '',
      isStrict: options.isStrict ?? 0,
      category: options.category || '',
      pageContext: options.pageContext || '',
    }, { retry: true, kind: 'feed' });
  }

  static async searchFeeds(query: string, page: number = 1, sortType: string = 'default') {
    return await invokeNative('search_feeds', { query, page, sortType });
  }

  // 8. 手机楼层评论：对应 APK 的 GET /v6/feed/replyList。
  // listType / fromFeedAuthor 由 APK 的 ReplyListV13 筛选项决定；登录时主请求会附带
  // Cookie，未登录时使用游客设备身份；分页失败交给评论区显示重试。
  static async getFeedReplies(
    feedId: string,
    page: number = 1,
    options: {
      firstItem?: string;
      lastItem?: string;
      listType?: string;
      fromFeedAuthor?: number;
    } = {},
  ) {
    return await invokeNative('get_feed_replies', {
      feedId,
      page,
      firstItem: options.firstItem || '',
      lastItem: options.lastItem || '',
      listType: options.listType ?? 'lastupdate_desc',
      fromFeedAuthor: options.fromFeedAuthor ?? 0,
    }, { retry: false, kind: 'comment' });
  }

  // 评论列表不包含完整设备信息，详情接口用于后台补齐评论元数据。
  static async getReplyDetail(replyId: string) {
    return await invokeNative('get_reply_detail', { replyId }, { retry: true, kind: 'comment' });
  }

  static async getSubReplies(
    feedId: string,
    replyId: string,
    page: number = 1,
    options: {
      lastItem?: string;
    } = {},
  ) {
    // APK 的楼中楼详情使用同一个 feed/replyList；父评论 ID 作为 id，
    // 原生命令固定使用 feedType=feed_reply，并按 lastItem 游标翻页。
    // 不走旧的 Python /feed/replies 路径，也不在失败时切换其他接口。
    return await invokeNative('get_sub_replies', {
      feedId,
      replyId,
      page,
      lastItem: options.lastItem || '',
    }, { retry: false, kind: 'comment' });
  }

  static async getFeedDetail(feedId: string) {
    let primaryResponse: any = null;
    let primaryError: unknown;

    try {
      primaryResponse = await invokeNative('get_feed_detail', { feedId }, { retry: true, kind: 'feed' });
      const primaryMessage = getFeedDetailMessage(primaryResponse?.data);
      if (primaryMessage && !hasFeedMoreSuffix(primaryMessage)) return primaryResponse;
    } catch (error) {
      primaryError = error;
    }

    // 动态详情接口偶尔会被验证码拦截，改用网页版 XHR 返回的完整 JSON 兜底。
    try {
      const webResponse: any = await invokeNative('fetch_external_page', {
        url: `https://www.coolapk.com/feed/${encodeURIComponent(feedId)}`,
      }, { retry: true, kind: 'feed' });
      const detail = parseWebFeedDetail(webResponse?.data?.html);
      if (detail && getFeedDetailMessage(detail)) {
        return { code: 200, data: detail };
      }
    } catch (fallbackError) {
      console.warn('网页版动态详情兜底失败：', fallbackError);
    }

    if (primaryResponse) return primaryResponse;
    throw primaryError instanceof Error ? primaryError : new Error(String(primaryError || '动态详情加载失败'));
  }

  // APK fallback: POST /v6/player/getUrl with form field params=<provider payload>.
  static async resolveVideoUrl(requestParams: string) {
    return await invokeNative('resolve_video_url', { requestParams }, { retry: true, kind: 'feed' });
  }

  // APK Live Photo path: GET /v6/livePhoto/showVideo and read the final video redirect.
  static async resolveLivePhotoVideo(
    imageUrl: string,
    contentId: string | number,
    contentType: 'feed' | 'reply' | 'article' = 'feed',
  ) {
    return await invokeNative('resolve_live_photo_video', {
      imageUrl,
      contentId: String(contentId),
      contentType,
    }, { retry: true, kind: 'feed' });
  }

  static async getLivePhotoVideoHeader(videoUrl: string) {
    return await invoke<string>('get_live_photo_video_header', { videoUrl });
  }

  static async getHotReplies(feedId: string, page: number = 1) {
    return await invokeNative('get_hot_replies', { feedId, page }, { retry: false, kind: 'comment' });
  }

  // 9. 酷友空间
  static async getUserSpace(uid: string) {
    // 用户页首屏不能沿用普通列表的 3 次重试策略，否则 space/profile
    // 失败时会连续等待很久，用户看不到页面级重试状态。
    return await invokeNative('get_user_space', { uid });
  }

  static async getUserProfile(uid: string) {
    return await invokeNative('get_user_profile', { uid });
  }

  static async updateUserProfile(key: string, value: string) {
    return await invokeNative('update_user_profile', { key, value });
  }

  static async updateUserCover(url: string) {
    return await invokeNative('update_user_cover', { url });
  }

  static async getUserQrImage(uid: string) {
    return await invokeNative('get_user_qr_image', { uid }, { retry: true, kind: 'default' });
  }

  static async getUserFeeds(uid: string, page: number = 1, feedType: string = 'feed') {
    return await invokeNative('get_user_feeds', { uid, page, feedType });
  }

  static async getUserTabData(
    uid: string,
    tab: string,
    page: number = 1,
    firstItem: string = '',
    lastItem: string = '',
    ratingTarget: string = 'all'
  ) {
    return await invokeNative('get_user_tab_data', {
      uid,
      tab,
      page,
      firstItem,
      lastItem,
      ratingTarget,
    });
  }

  static async getTopicDetail(tag: string) {
    return await invokeNative('get_topic_detail', { tag });
  }

  static async getTopicFeeds(
    tag: string,
    page: number = 1,
    options: { listType?: string; firstItem?: string; lastItem?: string; blockStatus?: number } = {},
  ) {
    return await invokeNative('get_topic_feeds', {
      tag,
      page,
      listType: options.listType || '',
      firstItem: options.firstItem || '',
      lastItem: options.lastItem || '',
      blockStatus: options.blockStatus ?? 1,
    });
  }

  static async getTopicTabData(options: {
    url: string;
    title?: string;
    subTitle?: string;
    page?: number;
    firstItem?: string;
    lastItem?: string;
    pageContext?: string;
  }) {
    return await invokeNative('get_topic_tab_data', {
      url: options.url,
      title: options.title || '',
      subTitle: options.subTitle || '',
      page: options.page || 1,
      firstItem: options.firstItem || '',
      lastItem: options.lastItem || '',
      pageContext: options.pageContext || '',
    }, { retry: true, kind: 'feed' });
  }

  static async getTopicHubData(subUrl: string = '', page: number = 1, firstItem: string = '', lastItem: string = '') {
    return await invokeNative('get_topic_hub_data', { subUrl, page, firstItem, lastItem }, { retry: true, kind: 'feed' });
  }

  static async getAppDetail(packageName: string) {
    return await invokeNative('get_app_detail', { packageName });
  }

  static async getNotificationCount() {
    return await invokeNative('get_notification_count', {}, { retry: true });
  }

  static async clearNotificationCount(notificationType: string = 'all') {
    return await invokeNative('clear_notification_count', { notificationType });
  }

  static async getNotifications(notificationType: string = 'atme', page: number = 1) {
    return await invokeNative('get_notifications', { notificationType, page }, { retry: true });
  }

  static async listMessages(page: number = 1) {
    return await invokeNative('list_messages', { page });
  }

  static async getRecentChatUsers(page: number = 1) {
    return await invokeNative('get_recent_chat_users', { page });
  }

  static async listChatHistory(ukey: string, page: number = 1) {
    return await invokeNative('list_chat_history', { ukey, page });
  }

  static async deleteMessageChat(ukey: string) {
    return await invokeNative('delete_message_chat', { ukey });
  }

  static async sendPrivateMessage(uid: string, message: string) {
    return await invokeNative('send_private_message', { uid, message });
  }

  static async likeFeed(feedId: string) {
    return await invokeNative('like_feed', { feedId });
  }

  static async unlikeFeed(feedId: string) {
    return await invokeNative('unlike_feed', { feedId });
  }

  static async likeReply(replyId: string) {
    return await invokeNative('like_reply', { replyId });
  }

  static async unlikeReply(replyId: string) {
    return await invokeNative('unlike_reply', { replyId });
  }

  static async replyFeed(feedId: string, message: string, rid?: string, pic?: string, postToken?: string) {
    const args: any = { feedId, message };
    if (rid) args.rid = rid;
    if (pic) args.pic = pic;
    if (postToken) args.postToken = postToken;
    return await invokeNative('reply_feed', args);
  }

  // 应用评价区评论；不要与动态评论 replyFeed 混用。
  static async getApkComments(appId: string, listType: string = 'dateline_desc', page: number = 1) {
    return await invokeNative('get_apk_comments', { appId, listType, page }, { retry: true, kind: 'comment' });
  }

  static async commentApk(appId: string, message: string) {
    return await invokeNative('comment_apk', { appId, message });
  }

  static async followUser(uid: string) {
    return await invokeNative('follow_user', { uid });
  }

  static async unfollowUser(uid: string) {
    return await invokeNative('unfollow_user', { uid });
  }

  static async specialFollowUser(uid: string, special: boolean) {
    return await invokeNative('special_follow_user', { uid, special });
  }

  static async cancelFollower(uid: string) {
    return await invokeNative('cancel_follower', { uid });
  }

  static async updateUserRemark(uid: string, name: string) {
    return await invokeNative('update_user_remark', { uid, name });
  }

  // 右侧栏：热门话题
  static async getHotTopics() {
    return await invokeNative('get_hot_topics');
  }

  static async getFavoriteList(
    favType: string = 'feed',
    page: number = 1,
    firstItem: string = '',
    lastItem: string = '',
  ) {
    return await invokeNative('get_favorite_list', { favType, page, firstItem, lastItem });
  }

  static async getFeedCollectionStatus(feedId: string) {
    return await invokeNative('get_feed_collection_status', { feedId });
  }

  static async getFeedCollectionOptions(feedId: string) {
    const status = await this.getFeedCollectionStatus(feedId);
    const collectionData = status?.data;
    return Array.isArray(collectionData)
      ? collectionData
      : [collectionData?.entities, collectionData?.list, collectionData?.rows, collectionData?.data]
        .find(Array.isArray) || [];
  }

  static async updateCollectionItem(
    targetId: string,
    collectionIds: string,
    cancelIds: string,
    feedType: string = 'feed',
    trace: string = '',
  ) {
    return await invokeNative('update_collection_item', {
      targetId,
      collectionIds,
      cancelIds,
      feedType,
      trace,
    });
  }

  static async updateFeedCloudCollections(
    feedId: string,
    collectionIds: string,
    cancelIds: string,
    feedType: string = 'feed',
    trace: string = '',
  ) {
    return await this.updateCollectionItem(feedId, collectionIds, cancelIds, feedType, trace);
  }

  /**
   * 使用酷安官方收藏单接口切换动态收藏状态。
   * 不落本地；只有 addItem 明确返回成功后，调用方才应更新界面状态。
   */
  static async setFeedCloudFavorite(
    feedId: string,
    favorited: boolean,
    feedType: string = 'feed',
    trace: string = '',
  ) {
    const collections = await this.getFeedCollectionOptions(feedId);
    const asId = (item: any) => item?.id ?? item?.collectionId ?? item?.entityId;
    const isOne = (value: any) => value === true || value === 1 || value === '1' || value === 'true';
    const hasId = (item: any) => {
      const id = asId(item);
      return id !== undefined && id !== null && String(id).length > 0;
    };
    const defaultCollection = collections.find((item: any) =>
      isOne(
        item?.defaultCollected ??
        item?.default_collected ??
        item?.isDefault ??
        item?.is_default ??
        item?.isDefaultCollection
      )
    ) || collections.find((item: any) => {
      const title = String(item?.title ?? item?.name ?? '');
      return hasId(item) && (title.includes('默认') || title.toLowerCase().includes('default'));
    }) || collections.find(hasId);
    const collectedIds = collections
      .filter((item: any) => isOne(item?.isBeCollected ?? item?.is_be_collected))
      .map(asId)
      .filter((id: any): id is string | number => id !== undefined && id !== null && String(id).length > 0)
      .map((id: string | number) => String(id));

    if (favorited) {
      const collectionId = asId(defaultCollection);
      if (collectionId === undefined || collectionId === null || String(collectionId).length === 0) {
        throw new Error('未找到酷安默认收藏单，收藏失败');
      }
      return await this.updateFeedCloudCollections(
        feedId,
        String(collectionId),
        '',
        feedType || 'feed',
        trace,
      );
    }

    const cancelIds = collectedIds.length > 0
      ? collectedIds.join(',')
      : (() => {
          const collectionId = asId(defaultCollection);
          return collectionId === undefined || collectionId === null ? '' : String(collectionId);
        })();
    if (!cancelIds) {
      throw new Error('未找到动态所在的收藏单，取消收藏失败');
    }
    return await this.updateFeedCloudCollections(feedId, '', cancelIds, feedType || 'feed', trace);
  }

  static async getCollectionList(uid: string, page: number = 1) {
    return await invokeNative('get_collection_list', { uid, page });
  }

  static async getCollectionItemList(collectionId: string, page: number = 1) {
    return await invokeNative('get_collection_item_list', { collectionId, page });
  }

  static async getCollectionDetail(collectionId: string) {
    return await invokeNative('get_collection_detail', { collectionId });
  }

  static async followCollection(collectionId: string) {
    return await invokeNative('follow_collection', { collectionId });
  }

  static async unfollowCollection(collectionId: string) {
    return await invokeNative('unfollow_collection', { collectionId });
  }

  static async likeCollection(collectionId: string) {
    return await invokeNative('like_collection', { collectionId });
  }

  static async unlikeCollection(collectionId: string) {
    return await invokeNative('unlike_collection', { collectionId });
  }

  static async followDyh(dyhId: string) {
    return await invokeNative('follow_dyh', { dyhId });
  }

  static async unfollowDyh(dyhId: string) {
    return await invokeNative('unfollow_dyh', { dyhId });
  }

  static async followLive(liveId: string) {
    return await invokeNative('follow_live', { liveId }, { retry: false, kind: 'feed' });
  }

  static async unfollowLive(liveId: string) {
    return await invokeNative('unfollow_live', { liveId }, { retry: false, kind: 'feed' });
  }

  static async getFeedForwardList(feedId: string, feedType: string = 'feed', page: number = 1) {
    return await invokeNative('get_feed_forward_list', { feedId, feedType, page });
  }

  static async getFeedLikeList(feedId: string, page: number = 1) {
    return await invokeNative('get_feed_like_list', { feedId, page });
  }

  static async getFeedChangeHistory(feedId: string) {
    return await invokeNative('get_feed_change_history', { feedId });
  }

  static async searchTags(query: string, page: number = 1) {
    return await invokeNative('search_tags', { query, page });
  }

  static async followTag(tag: string) {
    return await invokeNative('follow_tag', { tag });
  }

  static async unfollowTag(tag: string) {
    return await invokeNative('unfollow_tag', { tag });
  }

  static async getDeviceFeedList(tag: string, page: number = 1, options: { firstItem?: string; lastItem?: string } = {}) {
    return await invokeNative('get_device_feed_list', {
      tag,
      page,
      firstItem: options.firstItem || '',
      lastItem: options.lastItem || '',
    });
  }

  static async getQuestionAnswers(feedId: string, sort: string = 'hot', page: number = 1) {
    return await invokeNative('get_question_answers', { feedId, sort, page });
  }

  static async getVoteComments(feedId: string, page: number = 1) {
    return await invokeNative('get_vote_comments', { feedId, page });
  }

  static async createUserVote(
    feedId: string,
    optionIds: string[],
    anonymousStatus: boolean = false,
  ) {
    return await invokeNative(
      'create_user_vote',
      { feedId, optionIds, anonymousStatus },
      { kind: 'feed', retry: false },
    );
  }

  static async getHitHistory(page: number = 1, type: string = '', firstItem?: string, lastItem?: string) {
    const args: Record<string, unknown> = { page, historyType: type };
    if (firstItem) args.firstItem = firstItem;
    if (lastItem) args.lastItem = lastItem;
    return await invokeNative('get_hit_history', args);
  }

  static async getRecentHistory(page: number = 1, firstItem?: string, lastItem?: string) {
    const args: Record<string, unknown> = { page };
    if (firstItem) args.firstItem = firstItem;
    if (lastItem) args.lastItem = lastItem;
    return await invokeNative('get_recent_history', args);
  }

  static async getSpamFeedList(page: number = 1) {
    return await invokeNative('get_spam_feed_list', { page });
  }

  static async getHiddenReplies(feedId: string, page: number = 1) {
    return await invokeNative('get_hidden_replies', { feedId, page });
  }

  static async getFollowedTopics(page: number = 1) {
    return await invokeNative('get_followed_topics', { page });
  }

  static async searchUsers(query: string, page: number = 1) {
    return await invokeNative('search_users', { query, page });
  }

  static async getSearchSuggestionsApp(query: string) {
    return await invokeNative('get_search_suggestions_app', { query });
  }

  static async searchFeedTopics(query: string, page: number = 1) {
    return await invokeNative('search_feed_topics', { query, page });
  }

  static async getProductDetailByName(name: string) {
    return await invokeNative('get_product_detail_by_name', { name });
  }

  static async getLoadConfig() {
    return await invokeNative('get_load_config');
  }

  static async getHomeTabConfig(reset = false) {
    return await invokeNative('get_home_tab_config', { reset });
  }

  static async sendPrivateImage(uid: string, messagePic: string) {
    return await invokeNative('send_private_image', { uid, messagePic });
  }

  static async readMessage(ukey: string) {
    return await invokeNative('read_message', { ukey });
  }

  static async favoriteFeed(feedId: string) {
    return await this.setFeedCloudFavorite(feedId, true);
  }

  static async unfavoriteFeed(feedId: string) {
    return await this.setFeedCloudFavorite(feedId, false);
  }

  static async favoriteApk(packageName: string) {
    return await invokeNative('favorite_apk', { packageName });
  }

  static async unfavoriteApk(packageName: string) {
    return await invokeNative('unfavorite_apk', { packageName });
  }

  static async deleteFeed(feedId: string) {
    return await invokeNative('delete_feed', { feedId });
  }

  static async deleteReply(replyId: string) {
    return await invokeNative('delete_reply', { replyId });
  }

  static async createForward(feedId: string, message: string, pic?: string) {
    const args: any = { feedId, message };
    if (pic) args.pic = pic;
    return await invokeNative('create_forward', args);
  }

  static async uploadImage(imageBytes: Uint8Array, fileName: string, contentType: string, dir: string = 'feed', toUid?: string) {
    return await invokeNative('upload_image', { imageBytes, fileName, contentType, dir, toUid });
  }

  static async changeAvatar(imageBytes: Uint8Array, fileName: string, contentType: string) {
    return await invokeNative('change_avatar', { imageBytes, fileName, contentType });
  }

  static async getBlackList(page: number = 1) {
    return await invokeNative('get_black_list', { page });
  }

  static async getIgnoreList(page: number = 1) {
    return await invokeNative('get_ignore_list', { page });
  }

  static async getLimitList(page: number = 1) {
    return await invokeNative('get_limit_list', { page });
  }

  static async addToBlackList(uid: string) {
    return await invokeNative('add_to_black_list', { uid });
  }

  static async removeFromBlackList(uid: string) {
    return await invokeNative('remove_from_black_list', { uid });
  }

  static async addToIgnoreList(uid: string) {
    return await invokeNative('add_to_ignore_list', { uid });
  }

  static async removeFromIgnoreList(uid: string) {
    return await invokeNative('remove_from_ignore_list', { uid });
  }

  static async getApkUrl(packageName: string) {
    return await invokeNative('get_apk_url', { packageName });
  }

  static async getApkQr(packageName: string) {
    return await invokeNative('get_apk_qr', { packageName });
  }

  static async checkUpdate(pkgs: string) {
    return await invokeNative('check_update', { pkgs });
  }

  // 10. 离线/在线发布动态
  static async createFeed(message: string, pic?: string, postToken?: string) {
    const args: any = { message };
    if (pic) args.pic = pic;
    if (postToken) args.postToken = postToken;
    return await invokeNative('create_feed', args);
  }

  static async saveCookie(cookieStr: string) {
    return await invoke<string>('save_cookie_securely', { cookieStr });
  }

  static async checkLoginStatus() {
    return await invokeNative('check_login_status');
  }

  static async getDeviceInfo() {
    return await invokeNative('get_device_info');
  }

  static async listAccounts() {
    return await invokeNative('list_accounts');
  }

  static async loginAs(uid: string) {
    return await invokeNative('login_as', { uid });
  }

  static async saveAccount(uid: string, username: string, userAvatar: string, cookie: string) {
    return await invokeNative('save_account', { uid, username, userAvatar, cookie });
  }

  static async persistCurrentAccount(uid: string, username: string, userAvatar: string) {
    return await invokeNative('persist_current_account', { uid, username, userAvatar });
  }

  static async removeAccount(uid: string) {
    return await invokeNative('remove_account', { uid });
  }

  static async loginByAccount(account: string, password: string) {
    return await invokeNative('login_by_account', { account, password });
  }

  static async sendSmsVcode(mobile: string) {
    return await invokeNative('send_sms_vcode', { mobile });
  }

  static async loginByMobile(mobile: string, vcode: string) {
    return await invokeNative('login_by_mobile', { mobile, vcode });
  }

  static async clearCookie() {
    return await invoke<string>('clear_user_cookie');
  }

  static async getUserCookie() {
    return await invoke<string | null>('get_user_cookie');
  }

  static async getImageDataUrl(
    url: string,
    options?: { cacheDir?: string; cacheTtlDays?: number }
  ) {
    return await invoke<string>('get_image_data_url', {
      url,
      cacheDir: options?.cacheDir || '',
      cacheTtlDays: options?.cacheTtlDays ?? 7,
    });
  }

  static async saveImage(url: string, dir?: string) {
    return await invoke<string>('save_image', { url, dir: dir || '' });
  }

  static async openImageInSystemViewer(url: string, cacheDir?: string) {
    return await invoke<string>('open_image_in_system_viewer', { url, cacheDir: cacheDir || '' });
  }

  static async openUrl(url: string, mode: 'internal' | 'system' = 'internal') {
    if (mode === 'internal') {
      // 酷安站内深链优先交给桌面原生页面处理，避免把 feed、话题、用户、应用、产品
      // 等酷安内容降级成抓取后的纯文本网页。
      const nativeRoute = normalizeCoolapkRoute(url);
      if (nativeRoute && router.resolve(nativeRoute).matched.length > 0) {
        await router.push(nativeRoute);
        return;
      }

      // 无对应原生页面的 HTTPS 链接再进入安全渲染的外部页面。
      if (url.startsWith('http://') || url.startsWith('https://')) {
        await router.push({ path: '/external', query: { url } });
        return;
      }
    }
    // 非 http(s)（如 mailto:）与 system 模式交给系统默认程序
    try {
      await invoke('open_url', { url, mode: 'system' });
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  static async fetchExternalPage(url: string) {
    return await invokeNative('fetch_external_page', { url });
  }

  static async downloadUpdate(
    url: string,
    options?: { speedLimitKbps?: number; proxyUrl?: string }
  ) {
    return await invoke<string>('download_update', {
      url,
      speedLimitKbps: options?.speedLimitKbps ?? 0,
      proxyUrl: options?.proxyUrl ?? '',
    });
  }

  static async exportJsonFile(fileName: string, content: string, dir?: string) {
    return await invoke<string>('export_json_file', { fileName, content, dir: dir || '' });
  }

  static async getCacheInfo(cacheDir: string = '') {
    return await invoke<{
      bytes: number;
      imageBytes: number;
      webviewBytes: number;
      updateBytes: number;
      path: string;
    }>('get_cache_info', { cacheDir });
  }

  static async clearAppCache(cacheDir: string = '') {
    return await invoke<{ bytes: number }>('clear_app_cache', { cacheDir });
  }

  static async cleanExpiredCache(cacheDir: string = '', cacheTtlDays: number = 7) {
    return await invoke<{ bytes: number }>('clean_expired_cache', { cacheDir, cacheTtlDays });
  }

  static async openCacheDirectory(cacheDir: string = '') {
    return await invoke<string>('open_cache_directory', { cacheDir });
  }

  static async installUpdate(installerPath: string) {
    await invoke('install_update', { installerPath });
  }

  static async isUpdatePackageAvailable(installerPath: string) {
    return await invoke<boolean>('is_update_package_available', { installerPath });
  }

  static async cleanupUpdatePackages(keepPath?: string) {
    await invoke('cleanup_update_packages', { keepPath: keepPath || null });
  }

  static async quitApp() {
    await invoke('quit_app');
  }

  static async openLoginWebview() {
    try {
      return await invoke('open_login_webview');
    } catch (error) {
      console.error('[login-debug] open_login_webview failed', error);
      throw error;
    }
  }

  static async closeLoginWebview() {
    try {
      await invoke('close_login_window');
      return true;
    } catch (error) {
      console.warn('[login-debug] close_login_window failed', error);
      return false;
    }
  }

  static async saveCookieSecurely(cookieStr: string) {
    await invoke('save_cookie_securely', { cookieStr });
  }

  static async getFollowingFeeds(page: number = 1) {
    return await invokeNative('get_following_feeds', { page });
  }

  static async getFollowUserList(uid: string, page: number = 1) {
    return await invokeNative('get_follow_user_list', { uid, page });
  }

  static async getFansList(uid: string, page: number = 1) {
    return await invokeNative('get_fans_user_list', { uid, page });
  }

  static async getUserFollowNodes(uid: string) {
    return await invokeNative('get_user_follow_nodes', { uid });
  }

  static async getUserForumFollowList(uid: string, page: number = 1) {
    return await invokeNative('get_user_forum_follow_list', { uid, page });
  }

  static async getUserLikeList(uid: string, page: number = 1) {
    return await invokeNative('get_user_like_list', { uid, page });
  }

  static async getMyComments(uid: string, page: number = 1) {
    return await this.getUserFeeds(uid, page, 'reply');
  }

  // === 专辑/应用集 ===
  static async getAlbumList(listType: string = 'hot', page: number = 1) {
    return await invokeNative('get_album_list', { listType, page })
  }

  static async searchAlbums(query: string, page: number = 1) {
    return await invokeNative('search_albums', { query, page })
  }

  static async getAlbumDetail(albumId: string) {
    return await invokeNative('get_album_detail', { albumId })
  }

  static async getUserAlbumList(uid: string, page: number = 1) {
    return await invokeNative('get_user_album_list', { uid, page });
  }

  static async createAlbum(title: string, intro: string, cover: string = '') {
    return await invokeNative('create_album', { title, intro, cover });
  }

  static async editAlbum(albumId: string, title: string, intro: string, cover: string = '') {
    return await invokeNative('edit_album', { albumId, title, intro, cover });
  }

  static async addAlbumApk(
    albumId: string,
    packageName: string,
    title: string,
    url: string = '',
    note: string = '',
    displayOrder: number = 0,
    logo: string = '',
  ) {
    return await invokeNative('add_album_apk', {
      albumId,
      packageName,
      title,
      url,
      note,
      displayOrder,
      logo,
    });
  }

  static async deleteAlbumApk(albumId: string, packageName: string) {
    return await invokeNative('delete_album_apk', { albumId, packageName });
  }

  static async getAlbumReplies(albumId: string, page: number = 1) {
    return await invokeNative('get_album_replies', { albumId, page })
  }

  // === 头条/编辑精选 ===
  static async getHeadlineFeeds(page: number = 1) {
    return await invokeNative('get_headline_feeds', { page })
  }

  static async getUpdateList(page: number = 1) {
    return await invokeNative('get_update_list', { page })
  }

  static async getEditorChoiceFeeds(page: number = 1) {
    return await invokeNative('get_editor_choice_feeds', { page })
  }

  // === 应用补充 ===
  static async getApkDiscoverers(packageName: string, page: number = 1) {
    return await invokeNative('get_apk_discoverers', { packageName, page })
  }

  static async getApkRecommendList(apkType: string = '1', title: string = '推荐', page: number = 1) {
    return await invokeNative('get_apk_recommend_list', { apkType, title, page })
  }

  static async getApkGiftList(apkId: string | null = null, page: number = 1) {
    return await invokeNative('get_apk_gift_list', { apkId, page })
  }

  static async getApkRelatedApps(packageName: string, page: number = 1) {
    return await invokeNative('get_apk_related_apps', { packageName, page })
  }

  static async getDownloadVersionList(packageName: string) {
    return await invokeNative('get_download_version_list', { packageName })
  }

  // === 图片 ===
  static async getPictureList(tag: string, page: number = 1) {
    return await invokeNative('get_picture_list', { tag, page })
  }

  // === 搜索补充 ===
  static async searchApksByDeveloper(developer: string, page: number = 1) {
    return await invokeNative('search_apks_by_developer', { developer, page })
  }

  static async searchApksByTag(tag: string, apkType: string = '1', page: number = 1) {
    return await invokeNative('search_apks_by_tag', { tag, apkType, page })
  }

  static async getUserRatingList(uid: string, page: number = 1) {
    return await invokeNative('get_user_rating_list', { uid, page })
  }

  // === 好物 / 购物生态 ===
  static async getGoodsSearchHotWords() {
    return await invokeNative('get_goods_search_hot_words', {}, { retry: true, kind: 'feed' });
  }

  static async searchGoods(options: {
    keyword: string;
    sortName?: string;
    sort?: string;
    isCoupon?: boolean;
    page?: number;
  }) {
    return await invokeNative('search_goods', {
      keyword: options.keyword,
      sortName: options.sortName || 'default',
      sort: options.sort || 'default',
      isCoupon: options.isCoupon ? 1 : 0,
      page: options.page || 1,
    }, { retry: true, kind: 'feed' });
  }

  static async getGoodsDetail(goodsId: string) {
    return await invokeNative('get_goods_detail', { goodsId });
  }

  static async getGoodsListTypes() {
    return await invokeNative('get_goods_list_types', {}, { retry: true, kind: 'feed' });
  }

  static async getGoodsList(options: { uid?: string; goodsId?: string; page?: number }) {
    return await invokeNative('get_goods_list', {
      uid: options.uid || '',
      goodsId: options.goodsId || '',
      page: options.page || 1,
    }, { retry: true, kind: 'feed' });
  }

  static async getGoodsStoreItems(uid: string, page: number = 1) {
    return await invokeNative('get_goods_store_items', { uid, page }, { retry: true, kind: 'feed' });
  }

  static async getProductAlbums(uid: string, page: number = 1) {
    return await invokeNative('get_product_albums', { uid, page }, { retry: true, kind: 'feed' });
  }

  static async getMyGoodsFeeds(uid: string, goodsType: string = 'all', page: number = 1) {
    return await invokeNative('get_my_goods_feeds', { uid, goodsType, page }, { retry: true, kind: 'feed' });
  }

  static async createGoodsList(options: {
    title: string;
    message?: string;
    cover?: string;
    topLimit?: number;
    isOpenVote?: boolean;
    listType?: string;
    targetId?: string;
    targetType?: string;
  }) {
    return await invokeNative('create_goods_list', {
      title: options.title,
      message: options.message || '',
      cover: options.cover || '',
      topLimit: options.topLimit || 0,
      isOpenVote: options.isOpenVote ? 1 : 0,
      listType: options.listType || 'feed',
      targetId: options.targetId || '',
      targetType: options.targetType || '',
    }, { retry: false });
  }

  static async editGoodsList(options: {
    id: string;
    title: string;
    message?: string;
    cover?: string;
    topLimit?: number;
    isOpenVote?: boolean;
    listType?: string;
  }) {
    return await invokeNative('edit_goods_list', {
      id: options.id,
      title: options.title,
      message: options.message || '',
      cover: options.cover || '',
      topLimit: options.topLimit || 0,
      isOpenVote: options.isOpenVote ? 1 : 0,
      listType: options.listType || 'feed',
    }, { retry: false });
  }

  static async addGoodsToGoodsList(options: {
    feedId: string;
    goodsId: string;
    note?: string;
    pic?: string;
  }) {
    return await invokeNative('add_goods_to_goods_list', {
      feedId: options.feedId,
      goodsId: options.goodsId,
      note: options.note || '',
      pic: options.pic || '',
    }, { retry: false });
  }

  static async deleteGoodsListItems(cancelFeedId: string, goodsId: string) {
    return await invokeNative('delete_goods_list_items', { cancelFeedId, goodsId }, { retry: false });
  }

  static async editGoodsListItem(options: {
    feedId: string;
    goodsId: string;
    note?: string;
    pic?: string;
  }) {
    return await invokeNative('edit_goods_list_item', {
      feedId: options.feedId,
      goodsId: options.goodsId,
      note: options.note || '',
      pic: options.pic || '',
    }, { retry: false });
  }

  static async voteGoodsListItem(id: string, itemId: string, value: number) {
    return await invokeNative('vote_goods_list_item', { id, itemId, value }, { retry: false });
  }

  static async bindFeedToGoodsList(feedId: string, goodsListId: string) {
    return await invokeNative('bind_feed_to_goods_list', { feedId, goodsListId }, { retry: false });
  }
}
