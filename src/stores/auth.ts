import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { clearResourceMemoryCache } from '../utils/resourceCache';

export interface UserProfile {
  uid: string | number;
  username: string;
  userAvatar: string;
  level?: number;
  bio?: string;
  fans?: number;
  follow?: number;
  likenum?: number;
  logintime?: string;
  gender?: string | number;
  astro?: string;
  ageTag?: string;
  exp?: number;
  maxExp?: number;
}

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false);
  const user = ref<UserProfile | null>(null);
  const rawCookie = ref('');
  const isLoginModalOpen = ref(false);
  const accounts = ref<any[]>([]);

  function clearFrontendAuthState() {
    clearResourceMemoryCache();
    user.value = null;
    isLoggedIn.value = false;
    rawCookie.value = '';
    localStorage.removeItem('coolapk_cookie');
    localStorage.removeItem('coolapk_user');
  }

  function getAvatarUrlByUid(uidStr: string): string {
    const s = String(uidStr).trim();
    if (!s || s === '10000') return '';
    const padded = s.padStart(9, '0');
    const p1 = padded.slice(0, 3);
    const p2 = padded.slice(3, 5);
    const p3 = padded.slice(5, 7);
    return `https://avatar.coolapk.com/data/${p1}/${p2}/${p3}/${s.slice(-2)}_avatar_middle.jpg`;
  }

  /**
   * 打开登录弹窗
   */
  function openLoginModal() {
    isLoginModalOpen.value = true;
  }

  /**
   * 关闭登录弹窗
   */
  function closeLoginModal() {
    isLoginModalOpen.value = false;
  }

  /**
   * 通过 Cookie 凭据提交登录并验证
   */
  async function loginWithCookie(cookieStr: string): Promise<UserProfile> {
    const trimmed = cookieStr.trim();
    if (!trimmed) {
      throw new Error('请输入有效的 Cookie 凭据字符串');
    }

    // 1. 保存 Cookie 到底层 Rust 网络引擎
    await CoolapkTauriAPI.saveCookie(trimmed);

    // 2. 发起 API 验证登录有效性并抓取个人资料
    let profile: UserProfile;
    try {
      const res = await CoolapkTauriAPI.checkLoginStatus();
      const data = res?.data || res || {};
      // 解析 API 返回的用户属性
      const uid = String(data.uid || data.id || '');
      const username = data.username || data.displayUsername || data.user_name || '酷友';
      
      let userAvatar = data.userAvatar || data.avatar || data.user_avatar || '';
      if (!userAvatar && uid) {
        userAvatar = getAvatarUrlByUid(uid);
      }

      const level = Number(data.level || data.userLevel || 0);
      const bio = data.bio || data.sign || '';
      const likenum = Number(data.be_like_num ?? data.feed_like_num ?? data.like_num ?? data.likenum ?? 0);
      const fans = Number(data.fans ?? data.fansNum ?? data.fans_num ?? 0);
      const follow = Number(data.follow ?? data.followNum ?? data.follow_num ?? 0);

      if (!uid || uid === '0' || uid === '10000') {
        throw new Error('无效的 Cookie 凭据，未能识别酷安 UID 账号身份');
      }

      profile = { uid, username, userAvatar, level, bio, likenum, fans, follow };
    } catch (err: any) {
      await CoolapkTauriAPI.clearCookie();
      throw new Error(err?.message || '凭据无效或已过期，请登录酷安网页后复制包含 SESSID 的完整 Cookie');
    }

    // 3. 校验成功，持久化并更新内存 Store
    // 安全说明：登录 Cookie 只写入 Rust 侧（accounts.json），
    // 绝不写入 localStorage —— 否则任一 XSS 都可直接窃取 SESSID
    rawCookie.value = '';
    user.value = profile;
    isLoggedIn.value = true;
    clearResourceMemoryCache();

    localStorage.setItem('coolapk_user', JSON.stringify(profile));

    // 保存到多账户库
    await saveProfileToAccounts(profile, trimmed);

    return profile;
  }

  /**
   * 登录成功后把账户（含 Cookie 凭据）保存到 Rust 侧多账户库
   */
  async function saveProfileToAccounts(profile: UserProfile, cookie: string) {
    try {
      await CoolapkTauriAPI.saveAccount(
        String(profile.uid),
        profile.username || '',
        profile.userAvatar || '',
        cookie
      );
      await loadAccounts();
    } catch (e) {
      console.warn('保存账户到多账户库失败:', e);
    }
  }

  /**
   * 退出登录
   */
  async function logout() {
    try {
      await CoolapkTauriAPI.clearCookie();
    } catch (e) {
      console.warn('清除底层 Cookie 失败:', e);
    }
    clearFrontendAuthState();
    await loadAccounts();
  }

  /**
   * 从本地账户库中删除指定账户。删除当前账户时同时退出登录。
   */
  async function removeAccount(uid: string) {
    const targetUid = String(uid);
    const removingCurrent = String(user.value?.uid || '') === targetUid;
    await CoolapkTauriAPI.removeAccount(targetUid);
    if (removingCurrent) {
      try {
        await CoolapkTauriAPI.clearCookie();
      } catch {
        // remove_account 已经尽力清理底层会话
      }
      clearFrontendAuthState();
    }
    await loadAccounts();
  }

  /**
   * 加载已保存的多账户列表
   */
  async function loadAccounts() {
    try {
      const res = await CoolapkTauriAPI.listAccounts();
      accounts.value = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    } catch (e) {
      console.warn('加载账户列表失败:', e);
      accounts.value = [];
    }
  }

  /**
   * 切换到已保存的账户
   */
  async function loginAs(uid: string): Promise<UserProfile> {
    const res = await CoolapkTauriAPI.loginAs(String(uid));
    const data = res?.data || {};
    if (!data.uid) {
      throw new Error('切换账户失败，凭据无效或已过期');
    }
    const profile: UserProfile = {
      uid: String(data.uid),
      username: data.username || `酷友_${String(data.uid).slice(-4)}`,
      userAvatar: data.userAvatar || getAvatarUrlByUid(String(data.uid)),
      level: 1
    };
    user.value = profile;
    isLoggedIn.value = true;
    clearResourceMemoryCache();
    localStorage.setItem('coolapk_user', JSON.stringify(profile));
    await loadAccounts();
    return profile;
  }

  /**
   * 应用启动时自动载入 Rust 侧持久化的凭据并校验登录状态
   * （凭据只允许存在于 Rust 侧，前端不持久化、不读取原文）
   */
  async function initAuth() {
    // 加载多账户列表
    await loadAccounts();
    // 历史遗留清理：旧版本把 Cookie 明文存在 localStorage，启动时一律清除
    try {
      localStorage.removeItem('coolapk_cookie');
    } catch {
      // 忽略清理异常
    }
    // 凭据由 Rust 侧在启动时自动载入（persist_cookie_to），
    // 这里直接校验 Rust 内存态中的 Cookie 即可恢复登录态
    try {
      const res = await CoolapkTauriAPI.checkLoginStatus();
      const data = res?.data || res || {};
      const resolvedUid = String(data?.uid || data?.id || '').trim();
      if (data && resolvedUid && resolvedUid !== '0' && resolvedUid !== '10000') {
        const uid = resolvedUid;
        let userAvatar = data.userAvatar || data.avatar || data.user_avatar || '';
        if (!userAvatar && uid) {
          userAvatar = getAvatarUrlByUid(uid);
        }
        const updatedProfile: UserProfile = {
          uid,
          username: data.username || user.value?.username || '酷友',
          userAvatar: userAvatar || user.value?.userAvatar || '',
          level: Number(data.level || user.value?.level || 1),
          bio: data.bio || data.sign || user.value?.bio || ''
        };
        user.value = updatedProfile;
        isLoggedIn.value = true;
        updateProfileStats(data);
        localStorage.setItem('coolapk_user', JSON.stringify(user.value));
      }
    } catch (e) {
      // 静默恢复失败：保持未登录，避免缓存资料伪装成有效会话
      console.warn('静默恢复并同步 Cookie 状态:', e);
    }

    if (!isLoggedIn.value) {
      clearFrontendAuthState();
    }
  }

  /**
   * 账号/手机号 + 密码登录
   */
  async function loginWithAccount(account: string, password: string): Promise<UserProfile> {
    const acc = account.trim();
    const pwd = password.trim();
    if (!acc || !pwd) {
      throw new Error('请输入正确的账号与密码');
    }

    const res = await CoolapkTauriAPI.loginByAccount(acc, pwd);
    const data = res?.data || res || {};

    const uid = data.uid || data.id || data.user?.uid || data.userInfo?.uid;
    const sessid = data.sessid || data.token || data.user?.token || data.userInfo?.token;

    if (!uid || !sessid) {
      throw new Error(data.message || data.error || '账号或密码不正确，请核对后重试');
    }

    const profile: UserProfile = {
      uid,
      username: data.username || data.displayUsername || data.user?.username || acc,
      userAvatar: data.userAvatar || data.avatar || data.user?.avatar || '',
      level: Number(data.level || data.userLevel || data.user?.level || 1),
      bio: data.bio || data.sign || data.user?.bio || ''
    };

    user.value = profile;
    isLoggedIn.value = true;
    localStorage.setItem('coolapk_user', JSON.stringify(profile));

    const tokenStr = `SESSID=${sessid}; uid=${uid}`;
    await CoolapkTauriAPI.saveCookie(tokenStr);
    await saveProfileToAccounts(profile, tokenStr);
    rawCookie.value = '';

    return profile;
  }

  /**
   * 发送手机短信验证码
   */
  async function sendSmsCode(mobile: string) {
    const phone = mobile.trim();
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      throw new Error('请输入正确的 11 位手机号码');
    }
    return await CoolapkTauriAPI.sendSmsVcode(phone);
  }

  /**
   * 手机号 + 短信验证码登录
   */
  async function loginWithMobile(mobile: string, vcode: string): Promise<UserProfile> {
    const phone = mobile.trim();
    const code = vcode.trim();
    if (!phone || !code) {
      throw new Error('请输入手机号码和验证码');
    }

    const res = await CoolapkTauriAPI.loginByMobile(phone, code);
    const data = res?.data || res || {};

    const uid = data.uid || data.id || data.user?.uid || data.userInfo?.uid;
    const sessid = data.sessid || data.token || data.user?.token || data.userInfo?.token;

    if (!uid || !sessid) {
      throw new Error(data.message || data.error || '手机验证码无效或已失效，请重新获取');
    }

    const profile: UserProfile = {
      uid,
      username: data.username || data.displayUsername || data.user?.username || `酷友_${phone.slice(-4)}`,
      userAvatar: data.userAvatar || data.avatar || data.user?.avatar || '',
      level: Number(data.level || data.userLevel || data.user?.level || 1),
      bio: data.bio || data.sign || data.user?.bio || ''
    };

    user.value = profile;
    isLoggedIn.value = true;
    localStorage.setItem('coolapk_user', JSON.stringify(profile));

    const tokenStr = `SESSID=${sessid}; uid=${uid}`;
    await CoolapkTauriAPI.saveCookie(tokenStr);
    await saveProfileToAccounts(profile, tokenStr);
    rawCookie.value = '';

    return profile;
  }

  /**
   * 保存并导入第三方 Cookie/SESSID 凭据
   */
  async function saveCookie(cookieStr: string): Promise<UserProfile> {
    return await loginWithCookie(cookieStr);
  }

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('校验请求超时')), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

  /**
   * 校验当前凭据是否仍有效，并同步刷新用户资料。
   * 凭据只存在于 Rust 侧（Webview 授权登录路径 save_cookie_securely 只写 Rust），
   * 这里直接让 Rust 带凭据校验，前端不读取 Cookie 原文。
   */
  async function checkStatus(): Promise<boolean> {
    try {
      let res: any;
      try {
        res = await withTimeout(CoolapkTauriAPI.checkLoginInfo(), 8000);
      } catch {
        res = null;
      }
      let data = res?.data || res || {};
      if (!data || (!data.uid && !data.username)) {
        const fallbackRes = await withTimeout(CoolapkTauriAPI.checkLoginStatus(), 10000);
        data = fallbackRes?.data || fallbackRes || {};
      }
      // 酷安未登录时也可能返回游客资料（uid=10000），不能把它当成已登录。
      const uid = String(data?.uid || data?.id || '').trim();
      if (data && uid && uid !== '0' && uid !== '10000') {
        let userAvatar = data.userAvatar || data.avatar || data.user_avatar || '';
        if (!userAvatar && uid) {
          userAvatar = getAvatarUrlByUid(uid);
        }
        const profile: UserProfile = {
          uid,
          username: data.username || user.value?.username || '酷友',
          userAvatar: userAvatar || user.value?.userAvatar || '',
          level: Number(data.level || user.value?.level || 1),
          bio: data.bio || data.sign || user.value?.bio || ''
        };
        user.value = profile;
        isLoggedIn.value = true;
        updateProfileStats(data);
        localStorage.setItem('coolapk_user', JSON.stringify(user.value));
        try {
          await CoolapkTauriAPI.persistCurrentAccount(
            uid,
            user.value?.username || '',
            user.value?.userAvatar || ''
          );
          await loadAccounts();
        } catch (e) {
          console.warn('持久化当前账户失败:', e);
        }
        return true;
      }
      clearFrontendAuthState();
      return false;
    } catch (e) {
      console.warn('checkStatus 校验失败:', e);
      clearFrontendAuthState();
      return false;
    }
  }

  function formatActiveTime(val: any): string {
    if (!val) return '';
    const s = String(val).trim();
    if (/^\d{9,11}$/.test(s)) {
      const time = Number(s);
      const now = Math.floor(Date.now() / 1000);
      const diff = now - time;
      if (diff < 60) return '刚刚活跃';
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前活跃`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前活跃`;
      if (diff < 2592000) return `${Math.floor(diff / 86400)}天前活跃`;
      return '';
    }
    if (s.includes('活跃') || s.includes('前') || s.includes('刚刚')) {
      return s;
    }
    return '';
  }

  /**
   * 更新及补充账户获赞、关注、粉丝及基本信息
   */
  function updateProfileStats(data: any) {
    if (!user.value || !data) return;
    const fans = Number(data.fans ?? data.fansNum ?? data.fans_num ?? user.value.fans ?? 0);
    const follow = Number(data.follow ?? data.followNum ?? data.follow_num ?? user.value.follow ?? 0);
    const likenum = Number(data.be_like_num ?? data.feed_like_num ?? data.feedLikeNum ?? data.like_num ?? data.likenum ?? data.user_like_num ?? user.value.likenum ?? 0);
    const rawTime = data.logintime_formatted || data.logintime || data.last_active_time || user.value.logintime || '';
    const logintime = formatActiveTime(rawTime);
    const astro = data.astro || data.constellation || user.value.astro || '';
    const ageTag = data.age_tag || data.ageTag || user.value.ageTag || '';
    const gender = data.gender ?? user.value.gender;
    const bio = data.bio || data.sign || user.value.bio || '';
    const level = Number(data.level || data.userLevel || user.value.level || 1);
    const exp = Number(data.experience || data.userExperience || data.exp || user.value.exp || 0);
    const maxExp = Number(data.nextLevelExperience || data.next_level_experience || data.nextExp || user.value.maxExp || (level * 100));

    user.value = {
      ...user.value,
      fans,
      follow,
      likenum,
      logintime,
      astro,
      ageTag,
      gender,
      bio,
      level,
      exp,
      maxExp
    };
    localStorage.setItem('coolapk_user', JSON.stringify(user.value));
  }

  return {
    isLoggedIn,
    user,
    rawCookie,
    isLoginModalOpen,
    accounts,
    openLoginModal,
    closeLoginModal,
    loginWithCookie,
    loginWithAccount,
    sendSmsCode,
    loginWithMobile,
    saveCookie,
    checkStatus,
    logout,
    initAuth,
    loadAccounts,
    loginAs,
    removeAccount,
    updateProfileStats
  };
});
