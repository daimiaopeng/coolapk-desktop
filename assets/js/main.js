/**
 * Coolapk Desktop (酷安桌面版) 官网交互脚本
 * 包含：深浅主题、平台切换、图片画廊 Lightbox、FAQ 手风琴、返回顶部、GitHub API 动态数据绑定
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPlatformTabs();
  initGalleryFilter();
  initLightbox();
  initFaqAccordion();
  initBackToTop();
  initDynamicGitHubData();
});

/* ================= 1. 主题切换 (Dark / Light Mode) ================= */
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem('coolapk_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon(currentTheme);

  themeToggle.addEventListener('click', () => {
    const activeTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('coolapk_theme', newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (theme === 'dark') {
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    `;
  } else {
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
  }
}

/* ================= 2. 平台下载切换 Tab ================= */
function initPlatformTabs() {
  const tabBtns = document.querySelectorAll('.platform-tab-btn');
  const panes = document.querySelectorAll('.platform-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const platform = btn.getAttribute('data-platform');
      
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      panes.forEach(pane => {
        if (pane.id === `pane-${platform}`) {
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
    });
  });

  // 根据当前系统环境预选对应标签
  const userAgent = navigator.userAgent.toLowerCase();
  let defaultPlatform = 'windows';
  if (userAgent.includes('mac')) {
    defaultPlatform = 'macos';
  } else if (userAgent.includes('linux') && !userAgent.includes('android')) {
    defaultPlatform = 'linux';
  } else if (userAgent.includes('android') || userAgent.includes('iphone') || userAgent.includes('ipad')) {
    defaultPlatform = 'mobile';
  }

  const targetBtn = document.querySelector(`.platform-tab-btn[data-platform="${defaultPlatform}"]`);
  if (targetBtn) {
    targetBtn.click();
  }
}

/* ================= 3. 界面画廊分类过滤 ================= */
function initGalleryFilter() {
  const filterBtns = document.querySelectorAll('.gallery-btn');
  const items = document.querySelectorAll('.gallery-item');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      items.forEach(item => {
        const category = item.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });
}

/* ================= 4. 图片画廊 Lightbox 大图预览 ================= */
function initLightbox() {
  const modal = document.getElementById('lightbox-modal');
  const modalImg = document.getElementById('lightbox-img');
  const modalCaption = document.getElementById('lightbox-caption');
  const closeBtn = document.getElementById('lightbox-close');
  const galleryItems = document.querySelectorAll('.gallery-item');

  if (!modal || !modalImg) return;

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const title = item.querySelector('.gallery-info h4');
      if (img) {
        modalImg.src = img.src;
        modalCaption.textContent = title ? title.textContent : img.alt;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

/* ================= 5. FAQ 手风琴 ================= */
function initFaqAccordion() {
  const headers = document.querySelectorAll('.faq-header');

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const content = item.querySelector('.faq-content');
      const isOpen = item.classList.contains('open');

      document.querySelectorAll('.faq-item.open').forEach(openedItem => {
        if (openedItem !== item) {
          openedItem.classList.remove('open');
          openedItem.querySelector('.faq-content').style.maxHeight = null;
        }
      });

      if (isOpen) {
        item.classList.remove('open');
        content.style.maxHeight = null;
      } else {
        item.classList.add('open');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
}

/* ================= 6. 返回顶部 ================= */
function initBackToTop() {
  const backBtn = document.getElementById('back-to-top');
  if (!backBtn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      backBtn.classList.add('show');
    } else {
      backBtn.classList.remove('show');
    }
  });

  backBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/* ================= 7. 动态数据绑定 (GitHub API) ================= */
async function initDynamicGitHubData() {
  // 动态年份
  const copyrightYear = document.getElementById('copyright-year');
  if (copyrightYear) {
    copyrightYear.textContent = new Date().getFullYear();
  }

  const REPO = 'daimiaopeng/coolapk-desktop';

  // 1. 获取 Star 数量
  try {
    const repoData = await fetchGitHubWithCache(`https://api.github.com/repos/${REPO}`, 'repo_meta');
    if (repoData && repoData.stargazers_count !== undefined) {
      const starEl = document.getElementById('repo-stars');
      if (starEl) {
        const count = repoData.stargazers_count;
        const formatted = count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count;
        starEl.textContent = `★ Star ${formatted}`;
      }
    }
  } catch (err) {
    console.warn('获取 Star 计数失败，保留静态预设:', err);
  }

  // 2. 获取最新发布 Release 与下载直链
  try {
    const releaseData = await fetchGitHubWithCache(`https://api.github.com/repos/${REPO}/releases/latest`, 'latest_release');
    if (!releaseData || !releaseData.tag_name) return;

    const version = releaseData.tag_name; // 例如 "v1.27.4"
    const rawVersion = version.replace(/^v/, ''); // 例如 "1.27.4"
    const assets = releaseData.assets || [];

    // 更新顶栏 Badge
    const badge = document.getElementById('app-version-badge');
    if (badge) badge.textContent = version;

    // 计算相对时间（如 "3天前"）
    let dateStr = '';
    if (releaseData.published_at) {
      dateStr = formatRelativeTime(releaseData.published_at);
    }

    // 更新 Hero 胶囊提示
    const heroInfo = document.getElementById('hero-release-info');
    if (heroInfo) {
      heroInfo.textContent = dateStr 
        ? `最新版本 ${version} (${dateStr}发布) · 全平台跨端体验`
        : `最新版本 ${version} 已就绪 · 全平台跨端体验`;
    }

    // 更新底部 CTA 按钮文案
    const bottomCta = document.getElementById('bottom-cta-version');
    if (bottomCta) {
      bottomCta.textContent = `立即前往下载 (${version})`;
    }

    // Windows x64 安装版 (严格排除 arm64)
    bindAssetDownload({
      btnId: 'dl-win-setup',
      metaId: 'meta-win-setup',
      defaultText: '下载安装包 (x64 / 主流推荐)',
      matchFn: (name) => (name.includes('x64') || name.includes('x86_64')) && name.includes('setup.exe') && !name.includes('arm64'),
      assets
    });

    // Windows ARM64 安装版
    bindAssetDownload({
      btnId: 'dl-win-setup-arm64',
      metaId: null,
      defaultText: '下载安装包 (ARM64)',
      matchFn: (name) => (name.includes('arm64') || name.includes('aarch64')) && name.includes('setup.exe'),
      assets
    });

    // Windows x64 单文件版 (严格排除 arm64)
    bindAssetDownload({
      btnId: 'dl-win-portable',
      metaId: 'meta-win-portable',
      defaultText: '下载单文件版 (x64)',
      matchFn: (name) => (name.includes('x64') || name.includes('x86_64')) && name.includes('portable.exe') && !name.includes('arm64'),
      assets
    });

    // Windows ARM64 单文件版
    bindAssetDownload({
      btnId: 'dl-win-portable-arm64',
      metaId: null,
      defaultText: '下载单文件版 (ARM64)',
      matchFn: (name) => (name.includes('arm64') || name.includes('aarch64')) && name.includes('portable.exe'),
      assets
    });

    // 若在 Windows ARM64 设备访问，自动将 ARM64 设为主要推荐高亮
    if (typeof navigator !== 'undefined' && navigator.userAgent && /Windows.*(ARM64|aarch64)/i.test(navigator.userAgent)) {
      const winSetupX64 = document.getElementById('dl-win-setup');
      const winSetupArm64 = document.getElementById('dl-win-setup-arm64');
      if (winSetupX64 && winSetupArm64) {
        winSetupX64.classList.remove('btn-primary');
        winSetupX64.classList.add('btn-secondary');
        winSetupArm64.classList.remove('btn-secondary');
        winSetupArm64.classList.add('btn-primary');
      }
    }

    bindAssetDownload({
      btnId: 'dl-mac-arm64',
      metaId: 'meta-mac-arm64',
      defaultText: '下载 DMG (Apple 芯片)',
      matchFn: (name) => name.includes('aarch64.dmg'),
      assets
    });

    bindAssetDownload({
      btnId: 'dl-mac-intel',
      metaId: 'meta-mac-intel',
      defaultText: '下载 DMG (Intel)',
      matchFn: (name) => name.includes('x64.dmg'),
      assets
    });

    bindAssetDownload({
      btnId: 'dl-linux-appimage',
      metaId: 'meta-linux-appimage',
      defaultText: '下载 AppImage',
      matchFn: (name) => name.endsWith('.AppImage'),
      assets
    });

    bindAssetDownload({
      btnId: 'dl-linux-deb',
      metaId: 'meta-linux-deb',
      defaultText: '下载 DEB 安装包 (Ubuntu / Debian)',
      matchFn: (name) => name.endsWith('.deb'),
      assets
    });

    bindAssetDownload({
      btnId: 'dl-linux-rpm',
      metaId: null,
      defaultText: '下载 RPM 安装包 (Fedora / openSUSE)',
      matchFn: (name) => name.endsWith('.rpm'),
      assets
    });

    bindAssetDownload({
      btnId: 'dl-android-apk',
      metaId: 'meta-android-apk',
      defaultText: '下载 Android APK',
      matchFn: (name) => name.endsWith('.apk'),
      assets
    });

    bindAssetDownload({
      btnId: 'dl-ios-ipa',
      metaId: 'meta-ios-ipa',
      defaultText: '下载 iOS IPA',
      matchFn: (name) => name.endsWith('.ipa'),
      assets
    });

  } catch (err) {
    console.warn('获取最新 Release 信息失败，自动保留默认静态配置:', err);
  }
}

/**
 * 匹配 asset 并绑定 href、大小及文件名标注
 */
function bindAssetDownload({ btnId, metaId, defaultText, matchFn, assets }) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  const matched = assets.find(a => matchFn(a.name));
  if (matched) {
    btn.href = matched.browser_download_url;
    const sizeMb = (matched.size / (1024 * 1024)).toFixed(1);
    
    const textSpan = btn.querySelector('.btn-text');
    if (textSpan) {
      textSpan.textContent = `${defaultText} (${sizeMb} MB)`;
    }

    if (metaId) {
      const metaEl = document.getElementById(metaId);
      if (metaEl) {
        metaEl.textContent = `文件：${matched.name} (${sizeMb} MB)`;
      }
    }
  }
}

/**
 * 轻量带缓存的 Fetch（SessionStorage 缓存 10 分钟，避免 GitHub API Rate Limit）
 */
async function fetchGitHubWithCache(url, cacheKey) {
  const fullKey = `coolapk_gh_${cacheKey}`;
  const cached = sessionStorage.getItem(fullKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // 10 分钟有效期
      if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
        return parsed.data;
      }
    } catch (e) {
      sessionStorage.removeItem(fullKey);
    }
  }

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  sessionStorage.setItem(fullKey, JSON.stringify({
    timestamp: Date.now(),
    data
  }));

  return data;
}

/**
 * 友好的相对时间格式化
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} 天前`;
  
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
