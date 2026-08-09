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
      // 桌面程序启动期间调试端口可能暂时不可用，继续等待。
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
        throw new Error('等待评论信息页面超时');
      };

      const originalHash = location.hash || '#/';
      let replyDetailProbe = null;
      let replyDetailProbeError = '';
      try {
        replyDetailProbe = await window.__TAURI_INTERNALS__.invoke('get_reply_detail', { replyId: '601858220' });
      } catch (error) {
        replyDetailProbeError = String(error);
      }
      location.hash = '#/feed/73077541';
      await waitFor(() => document.querySelector('.feed-comment-section'));
      await waitFor(() => !document.querySelector('.comment-loading'));
      const timeButton = await waitFor(() => document.querySelector('.comment-time-button'));
      const relativeTime = timeButton.textContent?.trim() || '';
      timeButton.click();
      await waitFor(() => /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(timeButton.textContent?.trim() || ''));
      const absoluteTime = timeButton.textContent?.trim() || '';
      timeButton.click();
      await waitFor(() => (timeButton.textContent?.trim() || '') === relativeTime);
      await waitFor(() => document.querySelector('.comment-device'), 10000).catch(() => null);

      const appInfo = document.querySelector('.app-info');
      const appInfoBackground = appInfo ? getComputedStyle(appInfo).backgroundColor : '';
      const result = {
        commentCount: document.querySelectorAll('.feed-comment-section .comment-time-button').length,
        relativeTime,
        absoluteTime,
        timeRestored: (timeButton.textContent?.trim() || '') === relativeTime,
        deviceBadgeCount: document.querySelectorAll('.comment-device').length,
        verifyBadgeCount: document.querySelectorAll('.verify-tag').length,
        commentImageGridCount: document.querySelectorAll('.comment-image-grid').length,
        appInfoBackground,
        replyDetailDevice: replyDetailProbe?.data?.deviceTitle || '',
        replyDetailProbeError,
      };
      location.hash = originalHash;
      return result;
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  if (evaluation.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || 'CDP 页面验证失败');
  }

  const result = evaluation.result?.value;
  if (!result
    || result.commentCount <= 0
    || !result.relativeTime
    || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result.absoluteTime)
    || !result.timeRestored
    || !result.replyDetailDevice
    || result.replyDetailProbeError
    || result.appInfoBackground !== 'rgb(255, 255, 255)') {
    throw new Error(`评论信息页面验证失败：${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  cdp.close();
}
