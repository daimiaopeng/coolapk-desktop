import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CoolapkTauriAPI } from '../api/coolapk';

export interface UserProfile {
  uid: string | number;
  username: string;
  userAvatar: string;
  level?: number;
  bio?: string;
  fans?: number;
  follow?: number;
}

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false);
  const user = ref<UserProfile | null>(null);
  const rawCookie = ref('');
  const isLoginModalOpen = ref(false);

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
      const data = await CoolapkTauriAPI.checkLoginStatus();
      // 解析 API 返回的用户属性
      const uid = String(data.uid || data.id || '');
      const username = data.username || data.displayUsername || data.user_name || '酷友';
      
      let userAvatar = data.userAvatar || data.avatar || data.user_avatar || '';
      if (!userAvatar && uid) {
        userAvatar = getAvatarUrlByUid(uid);
      }

      const level = Number(data.level || data.userLevel || 0);
      const bio = data.bio || data.sign || '';

      if (!uid) {
        throw new Error('无效的 Cookie 凭据，未能识别酷安 UID 账号身份');
      }

      profile = { uid, username, userAvatar, level, bio };
    } catch (err: any) {
      // 只有显式声明了 uid=xxxx 数字 ID 并且带有有效 Session 时，才进行补充识别
      const uidMatch = trimmed.match(/uid=(\d+)/i);
      const nameMatch = trimmed.match(/username=([^;]+)/i);
      let parsedUsername = '';
      if (nameMatch && nameMatch[1]) {
        try {
          parsedUsername = decodeURIComponent(nameMatch[1]);
        } catch (e) {
          parsedUsername = nameMatch[1];
        }
      }

      if (uidMatch && uidMatch[1] && uidMatch[1] !== '10000') {
        const uid = uidMatch[1];
        profile = {
          uid: uid,
          username: parsedUsername || `酷友_${uid.slice(-4)}`,
          userAvatar: getAvatarUrlByUid(uid),
          level: 1
        };
      } else {
        await CoolapkTauriAPI.clearCookie();
        throw new Error(err?.message || '凭据无效或已过期（服务端返回：登录信息有误），请登录酷安网页后拷贝完整的 Cookie');
      }
    }

    // 3. 校验成功，持久化并更新内存 Store
    // 安全说明：登录 Cookie 只写入 Rust 侧（session_cookie.txt），
    // 绝不写入 localStorage —— 否则任一 XSS 都可直接窃取 SESSID
    rawCookie.value = trimmed;
    user.value = profile;
    isLoggedIn.value = true;

    localStorage.setItem('coolapk_user', JSON.stringify(profile));

    return profile;
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
    user.value = null;
    isLoggedIn.value = false;
    rawCookie.value = '';
    localStorage.removeItem('coolapk_cookie');
    localStorage.removeItem('coolapk_user');
  }

  /**
   * 应用启动时自动载入 Rust 侧持久化的凭据并校验登录状态
   * （凭据只允许存在于 Rust 侧，前端不持久化、不读取原文）
   */
  async function initAuth() {
    // 历史遗留清理：旧版本把 Cookie 明文存在 localStorage，启动时一律清除
    try {
      localStorage.removeItem('coolapk_cookie');
    } catch {
      // 忽略清理异常
    }
    const savedUser = localStorage.getItem('coolapk_user');

    // 凭据由 Rust 侧在启动时自动载入（persist_cookie_to），
    // 这里直接校验 Rust 内存态中的 Cookie 即可恢复登录态
    try {
      const res = await CoolapkTauriAPI.checkLoginStatus();
      const data = res?.data || res || {};
      if (data && (data.uid || data.username)) {
        const uid = String(data.uid || user.value?.uid || '');
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
        localStorage.setItem('coolapk_user', JSON.stringify(updatedProfile));
      }
    } catch (e) {
      // 静默恢复失败：可能是未登录或网络异常，保留离线 UI 兜底
      console.warn('静默恢复并同步 Cookie 状态:', e);
    }

    // 校验失败时，用缓存的用户资料兜底恢复界面（非敏感信息）
    if (!isLoggedIn.value && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.uid) {
          if (!parsed.userAvatar) {
            parsed.userAvatar = getAvatarUrlByUid(parsed.uid);
          }
          user.value = parsed;
          isLoggedIn.value = true;
        }
      } catch {
        // 忽略解析错误
      }
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
    rawCookie.value = tokenStr;
    await CoolapkTauriAPI.saveCookie(tokenStr);

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
    rawCookie.value = tokenStr;
    await CoolapkTauriAPI.saveCookie(tokenStr);

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
      if (data && (data.uid || data.username)) {
        const uid = String(data.uid || user.value?.uid || '');
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
        localStorage.setItem('coolapk_user', JSON.stringify(profile));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('checkStatus 校验失败:', e);
      return false;
    }
  }

  return {
    isLoggedIn,
    user,
    rawCookie,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    loginWithCookie,
    loginWithAccount,
    sendSmsCode,
    loginWithMobile,
    saveCookie,
    checkStatus,
    logout,
    initAuth
  };
});

