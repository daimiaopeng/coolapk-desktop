const cdpPort = Number(process.env.CDP_PORT || 9222);
const pageUrl = process.env.CDP_PAGE_URL || 'http://127.0.0.1:17520/';

function delay(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

async function findPageTarget() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
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
  await cdp.send('Page.enable');

  const evaluation = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const waitFor = async (predicate, timeout = 30000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeout) {
          const value = predicate();
          if (value) return value;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('等待页面状态超时');
      };

      await waitFor(() => document.readyState === 'complete' && document.querySelector('.top-bar'))
        .catch(() => {
          throw new Error('页面初始化失败：readyState=' + document.readyState
            + '，body=' + (document.body?.innerHTML || '').slice(0, 500));
        });
      const apiModule = await import('/src/api/coolapk.ts');
      const contentModule = await import('/src/utils/feedContent.ts');
      const rankTypes = ['week', 'month', 'favorite', 'index', 'picture'];
      const rankCounts = {};

      // 先直接验证五类榜单均能返回真实列表数据。
      for (const rankType of rankTypes) {
        const response = await apiModule.CoolapkTauriAPI.getRankFeeds(rankType, 1);
        const list = Array.isArray(response?.data) ? response.data : [];
        if (list.length === 0) throw new Error(rankType + ' 榜单没有返回数据');
        rankCounts[rankType] = list.length;
      }

      location.hash = '#/';
      const hotTab = await waitFor(() => [...document.querySelectorAll('.tab-item')]
        .find(item => item.textContent?.trim() === '热榜'));
      hotTab.click();
      await waitFor(() => document.querySelector('.hot-header-section'));
      const originalHash = location.hash;

      // 榜单按钮只能切换当前列表，不能再跳转到搜索页。
      const rankButtons = [...document.querySelectorAll('.rank-action-item')];
      if (rankButtons.length !== 5) throw new Error('热榜按钮数量不是 5 个');
      for (const button of rankButtons) {
        button.click();
        await waitFor(() => button.classList.contains('active'));
        if (location.hash !== originalHash || location.hash.includes('/search')) {
          throw new Error('榜单按钮错误跳转到：' + location.hash);
        }
      }

      const recommendedUsersRemoved = !document.body.textContent?.includes('推荐酷友')
        && !document.querySelector('[class*="recommended-user"]');

      // 验证评论中的用户链接与评论正文使用同一文字颜色。
      const commentProbe = document.createElement('div');
      commentProbe.className = 'comment-text';
      commentProbe.style.position = 'fixed';
      commentProbe.style.left = '-9999px';
      commentProbe.innerHTML = '<a class="coolapk-user-link" href="/u/测试用户">@测试用户</a>';
      document.body.appendChild(commentProbe);
      const mention = commentProbe.querySelector('a');
      const mentionUsesTextColor = getComputedStyle(mention).color === getComputedStyle(commentProbe).color;
      commentProbe.remove();

      // 从真实信息流中寻找截断动态，验证详情方法返回完整正文且不再带“查看更多”。
      let truncatedFeed = null;
      const loaders = [
        page => apiModule.CoolapkTauriAPI.getIndexV8Feeds(page),
        page => apiModule.CoolapkTauriAPI.getRankFeeds('week', page),
        page => apiModule.CoolapkTauriAPI.getDigestFeeds(page),
      ];
      for (const loader of loaders) {
        for (let page = 1; page <= 5 && !truncatedFeed; page += 1) {
          const response = await loader(page);
          truncatedFeed = (Array.isArray(response?.data) ? response.data : [])
            .find(item => item?.id && contentModule.hasFeedMoreSuffix(item.message || '')) || null;
        }
        if (truncatedFeed) break;
      }
      if (!truncatedFeed) throw new Error('真实信息流中未找到可验证的截断动态');

      const detailResponse = await apiModule.CoolapkTauriAPI.getFeedDetail(String(truncatedFeed.id));
      const fullMessage = contentModule.getFeedDetailMessage(detailResponse?.data);
      const originalMessage = contentModule.stripFeedMoreSuffix(truncatedFeed.message || '');
      const fullTextLoaded = Boolean(fullMessage)
        && !contentModule.hasFeedMoreSuffix(fullMessage)
        && fullMessage.length >= originalMessage.length;

      return {
        rankCounts,
        rankButtonsStayOnPage: location.hash === originalHash,
        recommendedUsersRemoved,
        mentionUsesTextColor,
        fullTextLoaded,
        fullTextFeedId: String(truncatedFeed.id),
        originalLength: originalMessage.length,
        fullLength: fullMessage.length,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text);
  }

  const result = evaluation.result.value;
  if (!result.rankButtonsStayOnPage
    || !result.recommendedUsersRemoved
    || !result.mentionUsesTextColor
    || !result.fullTextLoaded) {
    throw new Error(`首页回归验证结果不符合预期：${JSON.stringify(result)}`);
  }

  process.stdout.write(`CDP 首页回归验证通过：${JSON.stringify(result)}\n`);
} finally {
  cdp.close();
}
