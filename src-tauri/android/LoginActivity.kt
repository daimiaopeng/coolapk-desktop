package com.coolapk.desktop

import android.webkit.CookieManager

/** 官方授权页使用独立 Activity，验证完成后可直接返回主界面。 */
class LoginActivity : TauriActivity() {
    // 从系统 CookieManager 读取 HttpOnly 会话，不依赖 Wry 生成的 RustWebView 方法。
    fun getCoolapkCookies(url: String): String = CookieManager.getInstance().getCookie(url).orEmpty()
}
