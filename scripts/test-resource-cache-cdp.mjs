const cdpPort = Number(process.env.CDP_PORT || 9222);
const pageUrl = process.env.CDP_PAGE_URL || 'http://127.0.0.1:17520/';
const forceReload = process.env.CDP_FORCE_RELOAD === '1';

function delay(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

async function findPageTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      const targets = await response.json();
      const page = targets.find(target => target.type === 'page' && target.url.startsWith(pageUrl));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Tauri 启动期间调试端口暂不可用，继续等待。
    }
    await delay(500);
  }
  throw new Error(`未找到 Tauri CDP 页面，请使用 --remote-debugging-port=${cdpPort} 启动应用`);
}

function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 1;

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP WebSocket 连接失败')), { once: true });
  });

  return {
    ready,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

const target = await findPageTarget();
const cdp = connectCdp(target.webSocketDebuggerUrl);

try {
  await cdp.ready;
  await cdp.send('Runtime.enable');
  if (forceReload) {
    await cdp.send('Page.enable');
    await cdp.send('Page.reload', { ignoreCache: false });
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await delay(100);
      const state = await cdp.send('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      });
      if (state.result?.value === 'complete') break;
    }
  }

  const evaluation = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const waitFor = async (predicate, timeout = 25000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeout) {
          const value = predicate();
          if (value) return value;
          await new Promise(resolve => setTimeout(resolve, 80));
        }
        throw new Error('等待页面状态超时');
      };

      const originalHash = location.hash || '#/';
      const originalTimeOrigin = performance.timeOrigin;
      location.hash = '#/messages';
      await waitFor(() => document.querySelector('.messages-sidebar'));
      const sidebar = document.querySelector('.messages-sidebar');
      const sessions = await waitFor(() => {
        const items = [...document.querySelectorAll('.session-item')];
        if (items.length) return items;
        if (document.querySelector('.error-state')) return [];
        return null;
      });

      let sessionSwitchKeepsPage = null;
      let userBackKeepsPage = null;
      let privateImageRendered = null;

      if (sessions.length) {
        sessions[0].click();
        await waitFor(() => document.querySelector('.messages-main .main-header'));
        if (sessions.length > 1) {
          sessions[1].click();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        sessionSwitchKeepsPage = document.querySelector('.messages-sidebar') === sidebar;

        const imageSession = [...document.querySelectorAll('.session-item')]
          .find(item => item.querySelector('.last-message')?.textContent?.includes('[图片]'));
        if (imageSession) {
          imageSession.click();
          const image = await waitFor(() => (
            document.querySelector('.msg-pic-only-card img, .msg-pic-container img')
            || (document.querySelector('.image-error') ? false : null)
          ));
          privateImageRendered = Boolean(image && image.getAttribute('src')?.startsWith('data:image/'));
        }

        const partnerLink = document.querySelector('.clickable-header');
        if (partnerLink) {
          partnerLink.click();
          await waitFor(() => location.hash.startsWith('#/user/'));
          history.back();
          await waitFor(() => location.hash.startsWith('#/messages'));
          userBackKeepsPage = document.querySelector('.messages-sidebar') === sidebar;
        }
      }

      location.hash = '#/settings/downloads';
      const cacheLabel = await waitFor(() => [...document.querySelectorAll('.row-label')]
        .find(node => node.textContent?.trim() === '图片缓存目录'));
      const cacheRow = cacheLabel.closest('.setting-row');
      const cachePathVisible = Boolean(cacheRow?.querySelector('.cache-path')?.textContent?.trim());
      const cacheActions = [...(cacheRow?.querySelectorAll('button') || [])].map(button => button.textContent?.trim());

      const settingsModule = await import('/src/stores/settings.ts');
      const apiModule = await import('/src/api/coolapk.ts');
      const settings = settingsModule.useSettingsStore();
      const cacheInfo = await apiModule.CoolapkTauriAPI.getCacheInfo(settings.settings.cachePath);

      location.hash = originalHash;
      return {
        noDocumentReload: performance.timeOrigin === originalTimeOrigin,
        sessionCount: sessions.length,
        sessionSwitchKeepsPage,
        userBackKeepsPage,
        privateImageRendered,
        cachePathVisible,
        cacheButtonsPresent: cacheActions.includes('打开目录') && cacheActions.includes('更改目录'),
        cachePathReturned: Boolean(cacheInfo?.path),
        imageCacheBytes: Number(cacheInfo?.imageBytes) || 0,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text);
  }

  const result = evaluation.result.value;
  const required = result.noDocumentReload
    && result.cachePathVisible
    && result.cacheButtonsPresent
    && result.cachePathReturned;
  const authenticatedChecks = result.sessionCount === 0
    || (result.sessionSwitchKeepsPage && result.userBackKeepsPage && result.privateImageRendered);
  if (!required || !authenticatedChecks) {
    throw new Error(`CDP 验证结果不符合预期：${JSON.stringify(result)}`);
  }

  process.stdout.write(`CDP 真实客户端验证通过：${JSON.stringify(result)}\n`);
} finally {
  cdp.close();
}
