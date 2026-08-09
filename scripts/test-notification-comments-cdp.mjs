const cdpPort = Number(process.env.CDP_PORT || 9226);

function delay(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

async function findPageTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      const targets = await response.json();
      const page = targets.find(target => target.type === 'page'
        && (target.url.startsWith('http://127.0.0.1:17520/')
          || target.url.startsWith('http://tauri.localhost/')));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // 程序重启期间调试端口可能暂时不可用，继续等待。
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

  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('CDP WebSocket 连接失败')), { once: true });
    }),
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
      const waitFor = async (predicate, timeout = 30000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeout) {
          const value = predicate();
          if (value) return value;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('等待评论页面状态超时');
      };

      const originalHash = location.hash || '#/';
      const originalHistoryState = history.state;
      const originalFeedLinks = [...document.querySelectorAll('a[href*="/feed/"]')]
        .slice(0, 10)
        .map(link => ({ href: link.getAttribute('href'), text: link.textContent?.trim().slice(0, 80) }));
      const candidateTail = String(originalHistoryState?.forward || '').split('/feed/')[1] || '';
      const candidateFeedId = candidateTail.split('?')[0].split('/')[0] || '72018814';
      let candidateDetail = null;
      let candidateReplies = null;
      let candidateHotReplies = null;
      let candidateDetailError = '';
      let candidateReplyError = '';
      try {
        candidateDetail = candidateFeedId
          ? await window.__TAURI_INTERNALS__.invoke('get_feed_detail', { feedId: candidateFeedId })
          : null;
      } catch (error) {
        candidateDetailError = String(error);
      }
      try {
        candidateReplies = candidateFeedId
          ? await window.__TAURI_INTERNALS__.invoke('get_feed_replies', { feedId: candidateFeedId, page: 1 })
          : null;
      } catch (error) {
        candidateReplyError = String(error);
      }
      try {
        candidateHotReplies = candidateFeedId
          ? await window.__TAURI_INTERNALS__.invoke('get_hot_replies', { feedId: candidateFeedId, page: 1 })
          : null;
      } catch {
        candidateHotReplies = null;
      }
      location.hash = '#/settings';
      await waitFor(() => !document.querySelector('.feed-comment-section'));
      location.hash = '#/feed/73077541';
      await waitFor(() => document.querySelector('.feed-comment-section'));
      await waitFor(() => !document.querySelector('.comment-loading'));
      await waitFor(() => document.querySelector('.comment-title'));
      await waitFor(() => document.querySelectorAll('.comment-sort-button').length === 3);
      const rows = document.querySelectorAll('.comment-row');
      const commentTimeLabels = [...document.querySelectorAll(
        '.comment-row > .comment-main > .comment-meta > .comment-time',
      )].map(element => element.textContent?.trim() || '');
      const commentTimeSamples = [...document.querySelectorAll(
        '.comment-row > .comment-main > .comment-meta > .comment-time',
      )].slice(0, 2).map(element => element.outerHTML.slice(0, 300));
      const buttons = [...document.querySelectorAll('.comment-sort-button')];
      const labels = buttons.map(button => button.textContent?.trim());
      const defaultSortLabel = buttons.find(button => button.classList.contains('is-active'))?.textContent?.trim();
      const titleRect = document.querySelector('.comment-title').getBoundingClientRect();
      const sortRect = document.querySelector('.comment-sort').getBoundingClientRect();
      const sortBesideTitle = sortRect.left >= titleRect.right && sortRect.left - titleRect.right <= 24;
      for (const button of buttons) {
        button.click();
        await new Promise(resolve => setTimeout(resolve, 50));
        if (!button.classList.contains('is-active')) throw new Error('评论排序切换失败');
      }

      const notificationStartedAt = performance.now();
      await window.__TAURI_INTERNALS__.invoke('send_desktop_notification', {
        title: '酷安通知测试',
        body: '通知顶部应显示酷安',
      });
      const notificationDurationMs = Math.round(performance.now() - notificationStartedAt);

      location.hash = originalHash;

      return {
        topLevelCommentCount: rows.length,
        commentTimeLabels: commentTimeLabels.slice(0, 10),
        commentTimeSamples,
        commentsWithoutTime: commentTimeLabels.filter(label => !label || label === '回复').length,
        originalHash,
        originalHistoryState,
        originalFeedLinks,
        candidateFeedId,
        candidateReplynum: candidateDetail?.data?.replynum ?? null,
        candidateReplyCount: Array.isArray(candidateReplies?.data) ? candidateReplies.data.length : null,
        candidateReplySummary: Array.isArray(candidateReplies?.data)
          ? candidateReplies.data.map(item => ({
              id: String(item?.id ?? ''),
              rid: String(item?.rid ?? ''),
              rrid: String(item?.rrid ?? ''),
              replyRowsCount: Number(item?.replyRowsCount ?? 0),
            }))
          : [],
        candidateHotReplyCount: Array.isArray(candidateHotReplies?.data) ? candidateHotReplies.data.length : null,
        candidateDetailError,
        candidateReplyError,
        sortLabels: labels,
        defaultSortLabel,
        allSortButtonsWork: buttons.length === 3,
        sortBesideTitle,
        nativeNotificationSent: true,
        notificationDurationMs,
        taskbarNumberRenderingCoveredByUnitTest: true,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || 'CDP 页面验证失败');
  }
  const result = evaluation.result?.value;
  if (!result || result.topLevelCommentCount <= 1
    || result.commentTimeLabels.length === 0
    || result.commentsWithoutTime > 0
    || result.candidateReplyCount <= 0
    || result.candidateReplyCount <= result.candidateHotReplyCount
    || result.candidateReplyError
    || JSON.stringify(result.sortLabels) !== JSON.stringify(['最新的', '最早的', '点赞最多的'])
    || result.defaultSortLabel !== '最早的'
    || !result.sortBesideTitle
    || result.notificationDurationMs < 2800
    || result.notificationDurationMs > 4500) {
    throw new Error(`普通评论数量异常：${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  cdp.close();
}
