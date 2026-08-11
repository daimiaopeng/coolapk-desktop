import { invoke } from '@tauri-apps/api/core';
import { router } from '../router';
import { getFeedDetailMessage, hasFeedMoreSuffix, parseWebFeedDetail } from '../utils/feedContent';
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

  // 1.1 首页 Tab 配置（关注/热榜/快讯/话题频道 + 热门搜索）
  static async getTabConfig() {
    return await invokeNative('get_tab_config');
  }

  // 1.2 搜索候选词（输入联想）
  static async getSearchSuggestions(query: string) {
    return await invokeNative('get_search_suggestions', { query });
  }

  // 1.3 话题详情（旧版 tagDetail，字段与新版互补）
  static async getTopicDetailV7(tag: string) {
    return await invokeNative('get_topic_detail_v7', { tag });
  }

  // 1.4 产品（数码）详情与所属动态
  static async getProductDetail(productId: string) {
    return await invokeNative('get_product_detail', { productId });
  }

  static async getProductFeeds(productId: string, feedType: string = 'feed', page: number = 1) {
    return await invokeNative('get_product_feeds', { productId, feedType, page });
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

  static async searchFeeds(query: string, page: number = 1, sortType: string = 'default') {
    return await invokeNative('search_feeds', { query, page, sortType });
  }

  // 8. 手机楼层评论 (Rust 原生原生打通)
  static async getFeedReplies(feedId: string, page: number = 1) {
    return await safeFetch(`/feed/replies?id=${feedId}&page=${page}`, 'get_feed_replies', { feedId, page });
  }

  // 评论列表不包含完整设备信息，详情接口用于后台补齐评论元数据。
  static async getReplyDetail(replyId: string) {
    return await invokeNative('get_reply_detail', { replyId }, { retry: true, kind: 'comment' });
  }

  static async getSubReplies(feedId: string, replyId: string, page: number = 1) {
    return await safeFetch(`/feed/replies?id=${feedId}&rid=${replyId}&page=${page}`, 'get_sub_replies', { feedId, replyId, page });
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

  static async getHotReplies(feedId: string, page: number = 1) {
    return await invokeNative('get_hot_replies', { feedId, page }, { retry: true, kind: 'comment' });
  }

  // 9. 酷友空间
  static async getUserSpace(uid: string) {
    return await invokeNative('get_user_space', { uid });
  }

  static async getUserProfile(uid: string) {
    return await invokeNative('get_user_profile', { uid });
  }

  static async getUserFeeds(uid: string, page: number = 1, feedType: string = 'feed') {
    return await invokeNative('get_user_feeds', { uid, page, feedType });
  }

  static async getTopicDetail(tag: string) {
    return await invokeNative('get_topic_detail', { tag });
  }

  static async getTopicFeeds(tag: string, page: number = 1) {
    return await invokeNative('get_topic_feeds', { tag, page });
  }

  static async getTopicHubData(subUrl: string = '', page: number = 1) {
    return await safeFetch(`/page/dataList?url=${encodeURIComponent(subUrl || '/main/tagList')}&page=${page}`, 'get_topic_hub_data', { subUrl, page });
  }

  static async getAppDetail(packageName: string) {
    return await invokeNative('get_app_detail', { packageName });
  }

  static async getNotificationCount() {
    return await invokeNative('get_notification_count', {}, { retry: true });
  }

  static async getNotifications(notificationType: string = 'atme', page: number = 1) {
    return await invokeNative('get_notifications', { notificationType, page }, { retry: true });
  }

  static async listMessages(page: number = 1) {
    return await invokeNative('list_messages', { page });
  }

  static async listChatHistory(ukey: string, page: number = 1) {
    return await invokeNative('list_chat_history', { ukey, page });
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

  static async replyFeed(feedId: string, message: string, rid?: string) {
    const args: any = { feedId, message };
    if (rid) args.rid = rid;
    return await invokeNative('reply_feed', args);
  }

  static async followUser(uid: string) {
    return await invokeNative('follow_user', { uid });
  }

  static async unfollowUser(uid: string) {
    return await invokeNative('unfollow_user', { uid });
  }

  // 右侧栏：热门话题
  static async getHotTopics() {
    return await invokeNative('get_hot_topics');
  }

  static async getFavoriteList(favType: string = 'feed', page: number = 1) {
    return await invokeNative('get_favorite_list', { favType, page });
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

  static async getDeviceFeedList(tag: string, page: number = 1) {
    return await invokeNative('get_device_feed_list', { tag, page });
  }

  static async getQuestionAnswers(feedId: string, sort: string = 'hot', page: number = 1) {
    return await invokeNative('get_question_answers', { feedId, sort, page });
  }

  static async getVoteComments(feedId: string, page: number = 1) {
    return await invokeNative('get_vote_comments', { feedId, page });
  }

  static async getHitHistory(page: number = 1) {
    return await invokeNative('get_hit_history', { page });
  }

  static async getRecentHistory(page: number = 1) {
    return await invokeNative('get_recent_history', { page });
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

  static async sendPrivateImage(uid: string, messagePic: string) {
    return await invokeNative('send_private_image', { uid, messagePic });
  }

  static async readMessage(ukey: string) {
    return await invokeNative('read_message', { ukey });
  }

  static async favoriteFeed(feedId: string) {
    return await invokeNative('favorite_feed', { feedId });
  }

  static async unfavoriteFeed(feedId: string) {
    return await invokeNative('unfavorite_feed', { feedId });
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
  static async createFeed(message: string, pic?: string) {
    const args: any = { message };
    if (pic) args.pic = pic;
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

  static async openUrl(url: string, mode: 'internal' | 'system' = 'internal') {
    // 内置模式：不再新建窗口，直接跳转应用内"外部链接"页（由 Rust 抓取 + 安全渲染）
    if (mode === 'internal' && (url.startsWith('http://') || url.startsWith('https://'))) {
      router.push({ path: '/external', query: { url } });
      return;
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

  static async quitApp() {
    await invoke('quit_app');
  }

  static async openLoginWebview() {
    try {
      await invoke('open_login_webview');
    } catch {
      window.open('https://account.coolapk.com/auth/loginByCoolapk', '_blank', 'noopener,noreferrer');
    }
  }

  static async closeLoginWebview() {
    try {
      await invoke('close_login_window');
    } catch {}
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
}
