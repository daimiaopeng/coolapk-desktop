import { invoke } from '@tauri-apps/api/core';

async function safeFetch(pythonEndpoint: string, tauriCmd: string, tauriArgs: any = {}) {
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
    throw new Error(`评论服务请求失败。Rust: ${rustMessage}; Python: ${pythonMessage}`);
  }
}

async function invokeNative(tauriCmd: string, tauriArgs: any = {}) {
  const response = await invoke(tauriCmd, tauriArgs);
  if (response && (response as any).code === 200) return response as any;
  throw new Error((response as any)?.message || `${tauriCmd} 返回格式不正确`);
}

export class CoolapkTauriAPI {
  // 1. 首页推荐
  static async getIndexV8Feeds(page: number = 1) {
    return await safeFetch(`/feeds/index_v8?page=${page}`, 'get_index_v8_feeds', { page });
  }

  // 2. 24H 热榜
  static async getHotFeeds(page: number = 1) {
    return await safeFetch(`/feeds/hot?page=${page}`, 'get_hot_feeds', { page });
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

  static async getSubReplies(feedId: string, replyId: string, page: number = 1) {
    return await safeFetch(`/feed/replies?id=${feedId}&rid=${replyId}&page=${page}`, 'get_sub_replies', { feedId, replyId, page });
  }

  static async getFeedDetail(feedId: string) {
    return await invokeNative('get_feed_detail', { feedId });
  }

  static async getHotReplies(feedId: string, page: number = 1) {
    return await invokeNative('get_hot_replies', { feedId, page });
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

  static async getAppDetail(packageName: string) {
    return await invokeNative('get_app_detail', { packageName });
  }

  static async getNotificationCount() {
    return await invokeNative('get_notification_count');
  }

  static async getNotifications(notificationType: string = 'atme', page: number = 1) {
    return await invokeNative('get_notifications', { notificationType, page });
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

  static async replyFeed(feedId: string, message: string) {
    return await invokeNative('reply_feed', { feedId, message });
  }

  static async followUser(uid: string) {
    return await invokeNative('follow_user', { uid });
  }

  static async unfollowUser(uid: string) {
    return await invokeNative('unfollow_user', { uid });
  }

  // 10. 离线/在线发布动态
  static async createFeed(message: string) {
    return await invokeNative('create_feed', { message });
  }

  static async saveCookie(cookieStr: string) {
    return await invoke<string>('save_cookie_securely', { cookieStr });
  }

  static async checkLoginStatus() {
    return await invokeNative('check_login_status');
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

  static async getImageDataUrl(url: string) {
    return await invoke<string>('get_image_data_url', { url });
  }

  static async openUrl(url: string) {
    try {
      await invoke('open_url', { url });
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
