const cdpPort = Number(process.env.CDP_PORT || 9222);
const pageUrl = process.env.CDP_PAGE_URL || 'http://127.0.0.1:17520/';

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
      // 桌面程序启动期间调试端口暂不可用，继续等待。
    }
    await delay(500);
  }
  throw new Error(`未找到桌面程序 CDP 页面，请使用 --remote-debugging-port=${cdpPort} 启动应用`);
}

function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const events = [];
  let nextId = 1;

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      events.push(message);
      return;
    }
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
    getEvents() {
      return events;
    },
  };
}

const target = await findPageTarget();
const cdp = connectCdp(target.webSocketDebuggerUrl);

try {
  await cdp.ready;
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.reload', { ignoreCache: false });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await delay(100);
    const state = await cdp.send('Runtime.evaluate', {
      expression: "document.readyState === 'complete' && Boolean(document.querySelector('.top-bar'))",
      returnByValue: true,
    });
    if (state.result?.value) break;
  }

  const evaluation = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const waitFor = async (predicate, timeout = 20000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeout) {
          const value = predicate();
          if (value) return value;
          await new Promise(resolve => setTimeout(resolve, 80));
        }
        throw new Error('等待页面状态超时');
      };

      const apiModule = await import('/src/api/coolapk.ts');
      const originalHash = location.hash || '#/';
      const originalTimeOrigin = performance.timeOrigin;

      location.hash = '#/history';
      const sourcePage = await waitFor(() => document.querySelector('.page-container'));
      const preserveToken = 'cdp-' + Date.now();
      sourcePage.dataset.cdpPreserve = preserveToken;

      const liveDetailResponse = await apiModule.CoolapkTauriAPI.getFeedDetail('73091937');
      const liveFeed = liveDetailResponse?.data;
      if (!liveFeed || Number(liveFeed.isModified ?? liveFeed.is_modified ?? 0) !== 1) {
        throw new Error('真实动态没有返回已编辑字段');
      }
      location.hash = '#/feed/73091937';

      await waitFor(() => location.hash === '#/feed/73091937');
      const detailCard = await waitFor(() => document.querySelector('.feed-detail-page .feed-card.is-detail-mode'))
        .catch(() => {
          throw new Error('详情页没有渲染动态卡片：' + document.querySelector('main')?.textContent?.slice(0, 300));
        });
      const detailBody = detailCard.querySelector('.feed-body');
      const noRightDrawer = !document.querySelector('.comment-drawer, .drawer-overlay, .drawer-panel');
      const fullTextInline = Boolean(detailBody?.textContent?.trim())
        && !detailBody.classList.contains('is-collapsed');

      const editedButton = await waitFor(() => detailCard.querySelector('.edited-badge'));
      const editedBadgeVisible = editedButton.textContent?.includes('已编辑');
      editedButton.click();
      const historyDialog = await waitFor(() => [...document.querySelectorAll('.dialog-container')]
        .find(dialog => dialog.textContent?.includes('编辑记录')));
      const historyDialogVisible = Boolean(await waitFor(() => historyDialog.querySelector('.history-item')));
      historyDialog.querySelector('.dialog-close')?.click();
      await waitFor(() => !document.body.contains(historyDialog));

      const refreshButtonPresent = Boolean(document.querySelector('[aria-label="刷新当前页面"]'));
      const backButton = document.querySelector('[aria-label="后退"]');
      backButton?.click();
      await waitFor(() => location.hash === '#/history');
      const restoredPage = document.querySelector('.page-container');
      const sourcePagePreserved = restoredPage === sourcePage
        && restoredPage?.dataset.cdpPreserve === preserveToken;

      const forwardButton = document.querySelector('[aria-label="前进"]');
      forwardButton?.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      if (location.hash !== '#/feed/73091937') history.forward();
      await waitFor(() => location.hash === '#/feed/73091937');
      const restoredDetailCard = await waitFor(() => document.querySelector('.feed-detail-page .feed-card'));
      const forwardBodyText = restoredDetailCard.querySelector('.feed-body')?.textContent?.trim() || '';
      const forwardErrorText = document.querySelector('.feed-detail-page .error-state')?.textContent?.trim() || '';
      const forwardRestoredDetail = Boolean(forwardBodyText) && !forwardErrorText;

      location.hash = originalHash;
      return {
        noDocumentReload: performance.timeOrigin === originalTimeOrigin,
        noRightDrawer,
        fullTextInline,
        editedBadgeVisible,
        historyDialogVisible,
        refreshButtonPresent,
        sourcePagePreserved,
        forwardRestoredDetail,
        forwardBodyLength: forwardBodyText.length,
        forwardErrorText,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  if (evaluation.exceptionDetails) {
    const runtimeErrors = cdp.getEvents()
      .filter(event => event.method === 'Runtime.exceptionThrown' || event.method === 'Log.entryAdded')
      .slice(-8);
    throw new Error(`${evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text}\n${JSON.stringify(runtimeErrors)}`);
  }

  const result = evaluation.result.value;
  const required = [
    result.noDocumentReload,
    result.noRightDrawer,
    result.fullTextInline,
    result.editedBadgeVisible,
    result.historyDialogVisible,
    result.refreshButtonPresent,
    result.sourcePagePreserved,
    result.forwardRestoredDetail,
  ];
  if (!required.every(Boolean)) {
    throw new Error(`CDP 动态导航验证结果不符合预期：${JSON.stringify(result)}`);
  }

  process.stdout.write(`CDP 动态导航验证通过：${JSON.stringify(result)}\n`);
} finally {
  cdp.close();
}
