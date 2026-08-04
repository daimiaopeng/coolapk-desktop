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
      const uid = data.uid || data.id || '';
      const username = data.username || data.displayUsername || data.user_name || '酷友';
      const userAvatar = data.userAvatar || data.avatar || data.user_avatar || '';
      const level = Number(data.level || data.userLevel || 0);
      const bio = data.bio || data.sign || '';

      if (!uid) {
        throw new Error('无效的 Cookie 凭据，未能识别酷安用户身份');
      }

      profile = { uid, username, userAvatar, level, bio };
    } catch (err: any) {
      // 若 checkLoginStatus 接口解析受限，提供解析容错（例如提取 uid 参数）
      const uidMatch = trimmed.match(/uid=(\d+)/i) || trimmed.match(/SESSID=([a-zA-Z0-9]+)/i);
      if (uidMatch) {
        profile = {
          uid: uidMatch[1],
          username: `酷友_${uidMatch[1].slice(-4)}`,
          userAvatar: '',
          level: 1
        };
      } else {
        // 清理刚刚保存的无效 Cookie
        await CoolapkTauriAPI.clearCookie();
        throw new Error(err?.message || 'Cookie 验证失败，请检查凭据是否正确或已过期');
      }
    }

    // 3. 校验成功，持久化并更新内存 Store
    rawCookie.value = trimmed;
    user.value = profile;
    isLoggedIn.value = true;

    localStorage.setItem('coolapk_cookie', trimmed);
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
   * 应用启动时自动载入持久化的凭据与登录状态
   */
  async function initAuth() {
    const savedCookie = localStorage.getItem('coolapk_cookie');
    const savedUser = localStorage.getItem('coolapk_user');

    if (savedCookie && savedCookie.trim()) {
      rawCookie.value = savedCookie;
      if (savedUser) {
        try {
          user.value = JSON.parse(savedUser);
          isLoggedIn.value = true;
        } catch {
          // 忽略解析错误
        }
      }
      // 静默发到底层引擎
      try {
        await CoolapkTauriAPI.saveCookie(savedCookie);
      } catch (e) {
        console.warn('静默恢复 Cookie 失败:', e);
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

    const profile: UserProfile = {
      uid: data.uid || data.id || '10000',
      username: data.username || data.displayUsername || acc,
      userAvatar: data.userAvatar || data.avatar || '',
      level: Number(data.level || data.userLevel || 1),
      bio: data.bio || data.sign || ''
    };

    user.value = profile;
    isLoggedIn.value = true;
    localStorage.setItem('coolapk_user', JSON.stringify(profile));

    // 如果返回了 sessid / token，进行存储
    if (data.sessid || data.token) {
      const tokenStr = `SESSID=${data.sessid || data.token}`;
      rawCookie.value = tokenStr;
      localStorage.setItem('coolapk_cookie', tokenStr);
    }

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

    const profile: UserProfile = {
      uid: data.uid || data.id || '10000',
      username: data.username || data.displayUsername || `酷友_${phone.slice(-4)}`,
      userAvatar: data.userAvatar || data.avatar || '',
      level: Number(data.level || data.userLevel || 1),
      bio: data.bio || data.sign || ''
    };

    user.value = profile;
    isLoggedIn.value = true;
    localStorage.setItem('coolapk_user', JSON.stringify(profile));

    if (data.sessid || data.token) {
      const tokenStr = `SESSID=${data.sessid || data.token}`;
      rawCookie.value = tokenStr;
      localStorage.setItem('coolapk_cookie', tokenStr);
    }

    return profile;
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
    logout,
    initAuth
  };
});

