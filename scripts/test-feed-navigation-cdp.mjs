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

      const routerModule = await import('/src/router/index.ts');
      const navigationModule = await import('/src/utils/feedNavigation.ts');
      const router = routerModule.router;
      const originalRoute = router.currentRoute.value.fullPath;
      const originalTimeOrigin = performance.timeOrigin;

      await router.push('/history');
      const sourcePage = await waitFor(() => document.querySelector('.page-container'));
      const preserveToken = 'cdp-' + Date.now();
      sourcePage.dataset.cdpPreserve = preserveToken;

      const fullText = Array.from({ length: 18 }, (_, index) => 'CDP 正文第 ' + (index + 1) + ' 行').join('\\n');
      navigationModule.openFeedDetail(router, 'cdp-feed', {
        id: 'cdp-feed',
        uid: 'cdp-user',
        username: 'CDP 测试用户',
        message: fullText,
        dateline: Math.floor(Date.now() / 1000),
        pics: [],
        likenum: 0,
        replynum: 0,
        favnum: 0,
        sharenum: 0,
      });

      const detailCard = await waitFor(() => document.querySelector('.feed-detail-page .feed-card.is-detail-mode'));
      const detailBody = detailCard.querySelector('.feed-body');
      const noRightDrawer = !document.querySelector('.comment-drawer, .drawer-overlay, .drawer-panel');
      const fullTextInline = detailBody?.textContent?.includes('CDP 正文第 18 行')
        && !detailBody.classList.contains('is-collapsed');

      const moreButton = detailCard.querySelector('.action-more button');
      moreButton?.click();
      const historyButton = await waitFor(() => [...detailCard.querySelectorAll('.more-menu-item')]
        .find(button => button.textContent?.includes('修改历史')));
      historyButton.click();
      const historyPanelVisible = Boolean(await waitFor(() => detailCard.querySelector('.feed-history-panel')));

      const refreshButtonPresent = Boolean(document.querySelector('[aria-label="刷新当前页面"]'));
      const backButton = document.querySelector('[aria-label="后退"]');
      backButton?.click();
      await waitFor(() => router.currentRoute.value.fullPath === '/history');
      const restoredPage = document.querySelector('.page-container');
      const sourcePagePreserved = restoredPage === sourcePage
        && restoredPage?.dataset.cdpPreserve === preserveToken;

      const forwardButton = document.querySelector('[aria-label="前进"]');
      forwardButton?.click();
      await waitFor(() => router.currentRoute.value.fullPath === '/feed/cdp-feed');
      const forwardRestoredDetail = document.querySelector('.feed-detail-page .feed-card') === detailCard;

      await router.replace(originalRoute || '/');
      return {
        noDocumentReload: performance.timeOrigin === originalTimeOrigin,
        noRightDrawer,
        fullTextInline,
        historyPanelVisible,
        refreshButtonPresent,
        sourcePagePreserved,
        forwardRestoredDetail,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text);
  }

  const result = evaluation.result.value;
  if (!Object.values(result).every(Boolean)) {
    throw new Error(`CDP 动态导航验证结果不符合预期：${JSON.stringify(result)}`);
  }

  process.stdout.write(`CDP 动态导航验证通过：${JSON.stringify(result)}\n`);
} finally {
  cdp.close();
}
