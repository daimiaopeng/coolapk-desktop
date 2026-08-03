<template>
  <div class="app-root" :style="{ zoom: systemZoomFactor }">
    <!-- 顶部 Sticky Header -->
    <header>
      <div class="nav-container">
        <div class="brand-section">
          <a class="brand-logo" @click="switchMainTab('indexV8')">
            <img class="brand-icon" src="./assets/coolapk-logo.png" alt="酷安 Logo">
            <span>酷安</span>
          </a>
        </div>

        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass search-icon"></i>
          <input v-model="searchQuery" type="text" class="search-input" placeholder="搜索动态、酷友、话题 (按回车)..." @keydown.enter="handleSearch">
        </div>

        <div class="nav-actions">
          <button class="btn-post" @click="publishModalVisible = true"><i class="fa-solid fa-plus"></i> 发布</button>
          <button class="btn-feature" @click="featureCenterVisible = true"><i class="fa-solid fa-grip"></i> 功能中心</button>
          <div class="rust-status-tag" title="Tauri 原生桌面客户端"><i class="fa-solid fa-display"></i> 桌面版</div>
          <img class="user-avatar" :src="avatarFallback" alt="未登录" @click="featureCenterVisible = true">
        </div>
      </div>
    </header>

    <!-- 三栏 Grid 容器 -->
    <div class="main-wrapper">

      <!-- 左侧菜单 -->
      <div class="left-sidebar">
        <div class="menu-card">
          <a class="menu-item" :class="{ active: currentTab === 'indexV8' }" @click="switchMainTab('indexV8')"><i class="fa-solid fa-house"></i> 首页推荐</a>
          <a class="menu-item" :class="{ active: currentTab === 'hotList' }" @click="switchMainTab('hotList')"><i class="fa-solid fa-fire"></i> 24H 热榜</a>
          <a class="menu-item" :class="{ active: currentTab === 'digestList' }" @click="switchMainTab('digestList')"><i class="fa-solid fa-star"></i> 精选热帖</a>
          <a class="menu-item" :class="{ active: currentTab === 'newestList' }" @click="switchMainTab('newestList')"><i class="fa-solid fa-clock"></i> 全站最新</a>
          <a class="menu-item" :class="{ active: currentTab === 'coolPicture' }" @click="switchMainTab('coolPicture')"><i class="fa-solid fa-image"></i> 酷图热榜</a>
          <a class="menu-item" :class="{ active: currentTab === 'digitalBoard' }" @click="switchMainTab('digitalBoard')"><i class="fa-solid fa-microchip"></i> 数码频道</a>
          <a class="menu-item" :class="{ active: currentTab === 'mobileBoard' }" @click="switchMainTab('mobileBoard')"><i class="fa-solid fa-mobile-screen"></i> 手机频道</a>
          <a class="menu-item" :class="{ active: currentTab === 'secondHand' }" @click="switchMainTab('secondHand')"><i class="fa-solid fa-bag-shopping"></i> 酷品二手</a>
          <a class="menu-item" @click="openNotifications"><i class="fa-regular fa-bell"></i> 通知与私信</a>
          <a class="menu-item" @click="featureCenterVisible = true"><i class="fa-solid fa-table-cells-large"></i> 全部功能</a>
          <a class="menu-item" @click="featureCenterVisible = true"><i class="fa-regular fa-user"></i> 我的主页</a>
        </div>

        <div class="footer-info">
          <span>Tauri 2 + Rust 原生驱动</span><br>
          <span>系统 DPI 缩放自适应</span>
        </div>
      </div>

      <!-- 中央 Feed 流 -->
      <div class="center-content">
        <!-- 频道标题 Header -->
        <div class="filter-tabs">
          <div class="channel-title">
            <i class="fa-solid fa-layer-group" style="color:var(--brand-green)"></i>
            <span>{{ getChannelName() }}</span>
          </div>
          <div class="right-tools">
            <template v-if="currentTab === 'search'">
              <span class="search-mode" :class="{ active: searchMode === 'all' }" @click="changeSearchMode('all')">综合</span>
              <span class="search-mode" :class="{ active: searchMode === 'feed' }" @click="changeSearchMode('feed')">动态</span>
            </template>
            <span class="refresh-btn" @click="fetchFeeds(false)"><i class="fa-solid fa-rotate"></i> 刷新</span>
          </div>
        </div>

        <div v-if="loading && feedList.length === 0" class="loading-state">
          <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
          <p style="margin-top:10px;">酷安手机端原生 API 请求中...</p>
        </div>

        <div v-else-if="currentTab === 'search' && searchMode === 'all'" class="search-groups">
          <section v-for="group in searchGroups" :key="group.title || group.entityType" v-show="group.entities?.length" class="search-group-card">
            <h3>{{ group.title || '搜索结果' }}</h3>
            <div class="search-entity-grid">
              <button v-for="entity in group.entities" :key="entity.id || entity.uid || entity.url || entity.title" type="button" class="search-entity" @click="handleSearchEntity(entity)">
                <img v-if="entity.pic || entity.userAvatar" :src="normalizeImg(entity.pic || entity.userAvatar, 'avatar')" @error="handleImageError($event, 'avatar')">
                <span><b>{{ entity.username || entity.title || entity.name || entity.packageName || '结果' }}</b><small>{{ entity.subTitle || entity.description || entity.entityType || '' }}</small></span>
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </section>
          <div v-if="!searchGroups.length" class="loading-state">没有找到综合结果，可切换“动态”搜索。</div>
        </div>

        <div v-else class="feed-stream">
          <div v-for="item in feedList" :key="item.id || item.title" class="feed-card">

            <div v-if="item.isTop || item.targetType" class="top-tag-row">
              <span v-if="item.isTop" class="badge-top"><i class="fa-solid fa-thumbtack"></i> 置顶</span>
              <span v-if="item.targetType" class="badge-target">{{ item.targetType }}</span>
            </div>

            <div class="feed-header">
              <div class="author-info" @click="openUserProfile(item.uid)">
                <img class="author-avatar" :src="normalizeImg(item.userAvatar, 'avatar')" referrerpolicy="no-referrer" @error="handleImageError($event, 'avatar')">
                <div class="author-meta">
                  <div class="author-name-row">
                    <span class="author-name">{{ item.username || '酷友' }}</span>
                    <span v-if="item.verifyTitle" class="badge-verify"><i class="fa-solid fa-circle-check"></i> {{ item.verifyTitle }}</span>
                    <span v-if="item.userLevel" class="level-badge">LV{{ item.userLevel }}</span>
                  </div>
                  <div class="post-sub-info">
                    <span v-if="item.deviceTitle" class="device-tag"><i class="fa-solid fa-mobile-screen-button"></i> 来自 {{ item.deviceTitle }}</span>
                    <span v-if="item.infoHtml" class="time-tag"><i class="fa-regular fa-clock"></i> {{ item.infoHtml }}</span>
                    <span v-if="item.hitnum && item.hitnum > 0" class="hit-tag"><i class="fa-regular fa-eye"></i> {{ formatHitNum(item.hitnum) }} 浏览</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="item.title" class="post-title">{{ item.title }}</div>
            <div :ref="el => setPostTextRef(el, item)" class="post-text" :class="{ expanded: item.isExpanded }" v-html="formatRichText(item.message || item.title || item.targetType || '分享动态')"></div>
            <div v-if="item.canExpand" class="read-more-tag" @click="item.isExpanded = !item.isExpanded">
              {{ item.isExpanded ? '收起 ▴' : '展开全文 ▾' }}
            </div>

            <!-- 九宫格图片列表 -->
            <div v-if="item.pics && item.pics.length > 0" class="image-grid" :class="getGridClass(item.pics.length)">
              <img v-for="(p, pIdx) in item.pics" :key="pIdx" class="grid-img" :src="normalizeImg(p, 'feed')" referrerpolicy="no-referrer" loading="lazy" @error="handleImageError($event, 'feed')" @click.stop="openLightbox(p)">
            </div>

            <!-- 卡片 Footer -->
            <div class="feed-footer">
              <div class="footer-action" :class="{ liked: item.isLiked }" @click="toggleLike(item)"><i class="fa-regular fa-thumbs-up"></i> <span>{{ item.likenum || 0 }}</span></div>
              <div class="footer-action" @click="toggleInlineComments(item)"><i class="fa-regular fa-comment"></i> <span>{{ item.replynum || 0 }}</span></div>
              <div class="footer-action" @click="showToast('已加入收藏')"><i class="fa-regular fa-bookmark"></i> <span>{{ item.favnum || '收藏' }}</span></div>
              <div class="footer-action" @click="showToast('已复制分享链接')"><i class="fa-solid fa-share"></i> <span>{{ item.sharenum || '分享' }}</span></div>
              <div class="footer-action" @click="openFeedDetail(item.id)"><i class="fa-regular fa-file-lines"></i> <span>详情</span></div>
            </div>

            <!-- 100% 酷安手机原生楼层评论区 -->
            <div v-if="item.showComments" class="wb-inline-comments">
              <div class="wb-input-box">
                <img class="wb-avatar-small" :src="avatarFallback" alt="未登录">
                <div class="wb-input-right">
                  <textarea v-model="item.replyInput" class="wb-textarea" placeholder="发表公开评论..."></textarea>
                  <div class="wb-input-toolbar">
                    <div class="wb-tool-icons">
                      <i class="fa-regular fa-face-smile" title="表情"></i>
                      <i class="fa-regular fa-image" title="图片"></i>
                    </div>
                    <button class="wb-btn-send" @click="sendComment(item)">发送评论</button>
                  </div>
                </div>
              </div>

              <!-- 手机原生楼层评论列表 -->
              <div class="wb-comment-list">
                <div class="wb-comment-sort">
                  <button type="button" :class="{ active: item.commentSort === 'hot' }" @click="changeCommentSort(item, 'hot')">按热度</button>
                  <button type="button" :class="{ active: item.commentSort === 'time' }" @click="changeCommentSort(item, 'time')">按时间</button>
                </div>
                <div v-if="item.commentsLoading" style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:12px 0;"><i class="fa-solid fa-spinner fa-spin"></i> 正在拉取酷安手机端原生评论...</div>
                <div v-else-if="item.commentsError" style="font-size:0.82rem; color:#d14343; text-align:center; padding:12px 0;">
                  {{ item.commentsError }}
                  <button type="button" class="act-btn" style="margin-left:8px; border:0; background:transparent; cursor:pointer;" @click.stop="loadInlineComments(item)">重试</button>
                </div>
                <div v-else-if="!item.comments || item.comments.length === 0" style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:12px 0;">暂无评论，来发表第一条讨论吧~</div>
                <template v-else>
                  <div v-for="c in sortedComments(item)" :key="c.id" class="wb-comment-item">
                    <img class="wb-comment-avatar" :src="normalizeImg(c.userAvatar, 'avatar')" referrerpolicy="no-referrer" @error="handleImageError($event, 'avatar')">
                    <div class="wb-comment-main">
                      <div class="wb-comment-text-row">
                        <span class="wb-comment-username">{{ c.username }}</span>
                        <span v-if="c.userLevel" class="wb-level-tag">LV{{ c.userLevel }}</span>
                        <span v-if="c.verifyTitle" class="wb-verify-tag">{{ c.verifyTitle }}</span>
                        <span class="wb-comment-content" v-html="'：' + formatRichText(c.message)"></span>
                      </div>
                      <img v-if="c.pic" class="wb-comment-picture" :src="normalizeImg(c.pic, 'feed')" referrerpolicy="no-referrer" @error="handleImageError($event, 'feed')" @click.stop="openLightbox(c.pic)">

                      <div class="wb-comment-meta">
                        <span class="meta-time">{{ c.infoHtml }}{{ c.deviceTitle ? ` · 来自 ${c.deviceTitle}` : '' }}</span>
                        <div class="wb-comment-actions">
                          <span class="act-btn" title="分享" @click="showToast('已复制评论链接')"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>
                          <span class="act-btn" title="回复" @click="showToast('回复 @' + c.username)"><i class="fa-regular fa-comment-dots"></i></span>
                          <span class="act-btn" title="点赞" @click="showToast('赞同成功')"><i class="fa-regular fa-thumbs-up"></i><b v-if="c.likenum"> {{ c.likenum }}</b></span>
                        </div>
                      </div>

                      <div v-if="c.replies && c.replies.length" class="wb-thread-replies">
                        <div v-for="reply in c.replies" :key="reply.id" class="wb-thread-reply">
                          <div class="wb-thread-text">
                            <span class="wb-comment-username">{{ reply.username }}</span>
                            <span v-if="reply.userLevel" class="wb-level-tag">LV{{ reply.userLevel }}</span>
                            <template v-if="reply.rusername">
                              <span class="wb-reply-word"> 回复 </span><span class="wb-at-name">@{{ reply.rusername }}</span>
                            </template>
                            <span v-html="'：' + formatRichText(reply.message)"></span>
                          </div>
                          <img v-if="reply.pic" class="wb-comment-picture small" :src="normalizeImg(reply.pic, 'feed')" referrerpolicy="no-referrer" @error="handleImageError($event, 'feed')" @click.stop="openLightbox(reply.pic)">
                          <div class="wb-thread-meta">
                            <span>{{ reply.infoHtml }}{{ reply.deviceTitle ? ` · 来自 ${reply.deviceTitle}` : '' }}</span>
                            <span class="act-btn" @click="showToast('回复 @' + reply.username)"><i class="fa-regular fa-comment-dots"></i></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-if="item.commentsLoadedCount" class="wb-comment-total">已加载全部 {{ item.commentsLoadedCount }} 条评论</div>
                </template>
              </div>
            </div>

          </div>
        </div>

        <button class="btn-loadmore" @click="loadMoreFeeds"><i v-if="loadingMore" class="fa-solid fa-circle-notch fa-spin"></i> {{ loadingMore ? '加载中...' : '加载下一页' }}</button>
      </div>

      <!-- 右侧边栏 -->
      <div class="right-sidebar">
        <div class="widget-box">
          <div class="widget-header">
            <span>24 小时热门榜</span>
            <i class="fa-solid fa-fire" style="color:#ff5722"></i>
          </div>
          <div class="rank-list">
            <div v-for="(r, rIdx) in sidebarHotList" :key="rIdx" class="rank-item" @click="executeSearch(r.title || r.message)">
              <span class="rank-num" :class="{ top3: rIdx < 3 }">{{ rIdx + 1 }}</span>
              <span class="rank-title">{{ r.title || r.message }}</span>
            </div>
          </div>
        </div>

        <div class="widget-box">
          <div class="widget-header">热门话题</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            <a class="feed-tab" style="border:1px solid var(--border-color)" @click="executeSearch('Android 16')"># Android 16</a>
            <a class="feed-tab" style="border:1px solid var(--border-color)" @click="executeSearch('小米15Ultra')"># 小米15Ultra</a>
            <a class="feed-tab" style="border:1px solid var(--border-color)" @click="executeSearch('桌面改造')"># 桌面改造</a>
          </div>
        </div>
      </div>

    </div>

    <!-- 动态发布 Modal -->
    <div v-if="publishModalVisible" class="modal-backdrop" @click="publishModalVisible = false">
      <div class="modal-box" style="max-width:480px;" @click.stop>
        <div class="modal-header">
          <span>发布新动态</span>
          <i class="fa-solid fa-xmark" style="cursor:pointer" @click="publishModalVisible = false"></i>
        </div>
        <div class="modal-body">
          <textarea v-model="publishText" style="width:100%; height:120px; border:1px solid var(--border-color); border-radius:8px; padding:10px; font-size:0.88rem; outline:none; resize:none;" placeholder="分享你的想法..."></textarea>
        </div>
        <div class="modal-footer" style="padding:10px 18px; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end;">
          <button class="btn-post" @click="submitPublish">提交发布</button>
        </div>
      </div>
    </div>

    <!-- 酷友空间 Modal -->
    <div v-if="userProfileVisible" class="modal-backdrop" @click="userProfileVisible = false">
      <div class="modal-box" style="max-width:420px;" @click.stop>
        <div class="modal-header">
          <span>酷友空间</span>
          <i class="fa-solid fa-xmark" style="cursor:pointer" @click="userProfileVisible = false"></i>
        </div>
        <div class="modal-body" style="text-align:center; padding:20px;">
          <img :src="normalizeImg(userProfileData.userAvatar, 'avatar')" style="width:64px; height:64px; border-radius:50%; margin-bottom:8px;" referrerpolicy="no-referrer" @error="handleImageError($event, 'avatar')">
          <h3 style="font-size:1.05rem;">{{ userProfileData.username || '酷友' }}</h3>
          <p style="color:var(--text-sub); font-size:0.84rem; margin-top:4px;">{{ userProfileData.bio || '极客无所畏惧，代码改变世界' }}</p>
          <div style="display:flex; justify-content:space-around; margin-top:16px; border-top:1px solid var(--border-color); padding-top:12px; font-size:0.84rem;">
            <div><b>{{ userProfileData.feednum || 0 }}</b><br><span style="color:var(--text-muted)">动态</span></div>
            <div><b>{{ userProfileData.fannum || 0 }}</b><br><span style="color:var(--text-muted)">粉丝</span></div>
            <div><b>{{ userProfileData.likenum || 0 }}</b><br><span style="color:var(--text-muted)">获赞</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 动态详情 Modal -->
    <div v-if="feedDetailVisible" class="modal-backdrop" @click="feedDetailVisible = false">
      <div class="modal-box api-detail-modal" @click.stop>
        <div class="modal-header">
          <span>动态详情</span>
          <i class="fa-solid fa-xmark" style="cursor:pointer" @click="feedDetailVisible = false"></i>
        </div>
        <div v-if="feedDetailLoading" class="modal-body loading-state"><i class="fa-solid fa-spinner fa-spin"></i> 正在加载完整动态...</div>
        <div v-else class="modal-body feed-detail-body">
          <div class="feed-detail-author">
            <img :src="normalizeImg(feedDetailData.userAvatar, 'avatar')" @error="handleImageError($event, 'avatar')">
            <div><b>{{ feedDetailData.username || '酷友' }}</b><p>{{ feedDetailData.dateline_text || feedDetailData.infoHtml || '' }}</p></div>
          </div>
          <h3 v-if="feedDetailData.title">{{ feedDetailData.title }}</h3>
          <div class="feed-detail-message" v-html="formatRichText(feedDetailData.message || '')"></div>
          <div v-if="feedDetailData.picArr?.length" class="image-grid grid-3">
            <img v-for="pic in feedDetailData.picArr" :key="pic" class="grid-img" :src="normalizeImg(pic, 'feed')" @error="handleImageError($event, 'feed')" @click="openLightbox(pic)">
          </div>
          <div class="feed-detail-stats">赞 {{ feedDetailData.likenum || 0 }} · 评论 {{ feedDetailData.replynum || 0 }} · 浏览 {{ feedDetailData.hitnum || 0 }}</div>
        </div>
      </div>
    </div>

    <!-- 29 项 API 功能中心 -->
    <div v-if="featureCenterVisible" class="modal-backdrop" @click="featureCenterVisible = false">
      <div class="modal-box feature-center-modal" @click.stop>
        <div class="modal-header">
          <span>酷安完整功能中心</span>
          <i class="fa-solid fa-xmark" style="cursor:pointer" @click="featureCenterVisible = false"></i>
        </div>
        <div class="feature-center-body">
          <aside class="feature-tools">
            <section>
              <h4>登录会话</h4>
              <textarea v-model="cookieInput" placeholder="粘贴 uid、token、SESSID 等 Cookie；仅载入当前进程"></textarea>
              <button @click="saveLoginCookie">载入 Cookie</button>
            </section>
            <section>
              <h4>用户资料与社交</h4>
              <input v-model="featureUid" placeholder="用户 UID">
              <div class="feature-button-grid">
                <button @click="runFeatureAction('userSpace')">空间</button><button @click="runFeatureAction('userProfile')">资料</button>
                <button @click="runFeatureAction('userFeeds')">动态</button><button @click="runFeatureAction('follow')">关注</button>
                <button @click="runFeatureAction('unfollow')">取消关注</button>
              </div>
            </section>
            <section>
              <h4>话题与应用</h4>
              <input v-model="featureTopic" placeholder="话题名称，例如 酷安夜话">
              <div class="feature-button-grid"><button @click="runFeatureAction('topicDetail')">话题详情</button><button @click="runFeatureAction('topicFeeds')">话题动态</button></div>
              <input v-model="featurePackage" placeholder="应用包名，例如 com.coolapk.market">
              <button @click="runFeatureAction('appDetail')">应用详情</button>
            </section>
            <section>
              <h4>通知与私信</h4>
              <div class="feature-button-grid">
                <button @click="runFeatureAction('notificationCount')">未读数</button><button @click="runFeatureAction('atme')">@我的</button>
                <button @click="runFeatureAction('comments')">评论</button><button @click="runFeatureAction('likes')">点赞</button>
                <button @click="runFeatureAction('messages')">私信会话</button>
              </div>
              <input v-model="featureUkey" placeholder="会话 ukey">
              <button @click="runFeatureAction('chat')">聊天记录</button>
              <input v-model="featureMessageUid" placeholder="收信人 UID">
              <textarea v-model="featureMessageText" placeholder="私信内容"></textarea>
              <button @click="runFeatureAction('sendMessage')">发送私信</button>
            </section>
          </aside>
          <main class="feature-result">
            <div class="feature-result-header"><b>{{ featureResultTitle || '选择左侧功能' }}</b><i v-if="featureLoading" class="fa-solid fa-spinner fa-spin"></i></div>
            <pre>{{ featureResultText }}</pre>
          </main>
        </div>
      </div>
    </div>

    <!-- Lightbox 大图查看 Modal -->
    <div v-if="lightboxVisible" class="lightbox-modal" @click="lightboxVisible = false">
      <i class="fa-solid fa-xmark lightbox-close" @click="lightboxVisible = false"></i>
      <img class="lightbox-img" :src="normalizeImg(lightboxImg, 'feed')" referrerpolicy="no-referrer" @error="handleImageError($event, 'feed')" @click.stop>
    </div>

    <!-- Toast 提示 -->
    <div v-if="toastVisible" class="toast-msg">{{ toastText }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { CoolapkTauriAPI } from './api/coolapk';
import { renderCoolapkEmoji } from './utils/coolapkEmoji';

const currentTab = ref('indexV8');
const currentPage = ref(1);
const loading = ref(false);
const loadingMore = ref(false);
const feedList = ref<any[]>([]);
const sidebarHotList = ref<any[]>([]);
const detailPreloadTasks = new WeakMap<object, Promise<void>>();
const commentPreloadTasks = new WeakMap<object, Promise<void>>();

const searchQuery = ref('');
const searchMode = ref<'all' | 'feed'>('all');
const searchGroups = ref<any[]>([]);
const lightboxVisible = ref(false);
const lightboxImg = ref('');

const toastVisible = ref(false);
const toastText = ref('');

const publishModalVisible = ref(false);
const publishText = ref('');

const userProfileVisible = ref(false);
const userProfileData = ref<any>({});

const feedDetailVisible = ref(false);
const feedDetailLoading = ref(false);
const feedDetailData = ref<any>({});

const featureCenterVisible = ref(false);
const featureLoading = ref(false);
const featureResultTitle = ref('');
const featureResultText = ref('这里可以调用 README 中的全部用户、话题、应用、通知和私信接口。');
const cookieInput = ref('');
const featureUid = ref('');
const featureTopic = ref('酷安夜话');
const featurePackage = ref('com.coolapk.market');
const featureUkey = ref('');
const featureMessageUid = ref('');
const featureMessageText = ref('');

const systemZoomFactor = ref(1);

const updateSystemDpiZoom = () => {
  const ratio = window.devicePixelRatio || 1;
  if (ratio >= 2.0) {
    systemZoomFactor.value = 0.9;
  } else if (ratio >= 1.5) {
    systemZoomFactor.value = 0.95;
  } else if (ratio >= 1.25) {
    systemZoomFactor.value = 0.98;
  } else {
    systemZoomFactor.value = 1.0;
  }
};

onMounted(() => {
  updateSystemDpiZoom();
  window.addEventListener('resize', updateSystemDpiZoom);
  switchMainTab('indexV8');
  fetchSidebarHot();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateSystemDpiZoom);
});

const showToast = (text: string) => {
  toastText.value = text;
  toastVisible.value = true;
  setTimeout(() => { toastVisible.value = false; }, 2000);
};

const formatHitNum = (num: number) => {
  if (!num || num <= 0) return '';
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

const formatRichText = (text: string) => {
  if (!text) return '';
  const linkedText = text
    .replace(/<a[^>]*>\s*查看更多\s*<\/a>/gi, '')
    .replace(/<a[^>]*class="[^"]*feed-link-tag[^"]*"[^>]*>(.*?)<\/a>/gi, '<span class="cool-tag">$1</span>')
    .replace(/<a[^>]*class="[^"]*feed-link-uname[^"]*"[^>]*>(.*?)<\/a>/gi, '<span class="cool-uname">$1</span>')
    .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');
  return renderCoolapkEmoji(linkedText);
};

const setPostTextRef = (element: any, item: any) => {
  if (!element || item.isExpanded || item.canExpand) return;
  void nextTick(() => {
    requestAnimationFrame(() => {
      if (!item.isExpanded) {
        item.canExpand = element.scrollHeight > element.clientHeight + 1;
      }
    });
  });
};

const getChannelName = () => {
  if (currentTab.value === 'search') return `搜索 "${searchQuery.value}" 的结果`;
  const map: Record<string, string> = {
    indexV8: '首页推荐',
    hotList: '24H 热门榜',
    digestList: '精选热帖',
    newestList: '全站最新',
    coolPicture: '酷图热榜',
    digitalBoard: '数码频道',
    mobileBoard: '手机频道',
    secondHand: '酷品二手'
  };
  return map[currentTab.value] || '动态列表';
};

const avatarFallback = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#eef2f6"/><circle cx="40" cy="31" r="14" fill="#b7c2ce"/><path d="M16 72c3-17 13-25 24-25s21 8 24 25" fill="#b7c2ce"/></svg>')}`;
const imageFallback = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#f3f5f7"/><path d="M65 135l55-55 38 38 32-32 65 49" fill="none" stroke="#b7c2ce" stroke-width="8" stroke-linejoin="round"/><circle cx="225" cy="55" r="16" fill="#b7c2ce"/><text x="160" y="165" text-anchor="middle" font-size="14" fill="#8c98a5">图片加载失败</text></svg>')}`;
const avatarLoading = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#edf1f5"/><circle cx="40" cy="40" r="24" fill="#e2e7ec"/></svg>')}`;
const imageLoading = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#f2f4f7"/><stop offset="0.5" stop-color="#e7ebef"/><stop offset="1" stop-color="#f2f4f7"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/></svg>')}`;
const imageCache = ref<Record<string, string>>({});
const imageRequests = new Set<string>();
const failedImages = ref<Set<string>>(new Set());

const normalizeImg = (url: string, type: 'avatar' | 'feed' = 'avatar') => {
  if (!url) return type === 'avatar' ? avatarFallback : imageFallback;
  let normalized = url.trim();
  if (normalized.startsWith('//')) normalized = `https:${normalized}`;
  if (normalized.startsWith('http://') && /(?:image|avatar)\.coolapk\.com/i.test(normalized)) {
    normalized = normalized.replace(/^http:\/\//i, 'https://');
  }

  if (!/(?:image|avatar)\.coolapk\.com/i.test(normalized)) return normalized;
  if (imageCache.value[normalized]) return imageCache.value[normalized];
  if (failedImages.value.has(normalized)) return type === 'avatar' ? avatarFallback : imageFallback;
  if (!imageRequests.has(normalized)) {
    imageRequests.add(normalized);
    void CoolapkTauriAPI.getImageDataUrl(normalized)
      .then((dataUrl) => {
        imageCache.value = { ...imageCache.value, [normalized]: dataUrl };
      })
      .catch((error) => {
        const failures = new Set(failedImages.value);
        failures.add(normalized);
        failedImages.value = failures;
        console.error('Load native image error:', normalized, error);
      })
      .finally(() => imageRequests.delete(normalized));
  }
  return type === 'avatar' ? avatarLoading : imageLoading;
};

const handleImageError = (event: Event, type: 'avatar' | 'feed') => {
  const image = event.currentTarget as HTMLImageElement;
  if (image.dataset.fallbackApplied) return;
  image.dataset.fallbackApplied = 'true';
  image.src = type === 'avatar' ? avatarFallback : imageFallback;
};

const switchMainTab = async (tab: string) => {
  currentTab.value = tab;
  currentPage.value = 1;
  feedList.value = [];
  searchGroups.value = [];
  await fetchFeeds(false);
};

const loadMoreFeeds = async () => {
  currentPage.value++;
  await fetchFeeds(true);
};

const fetchFeeds = async (isAppend = false) => {
  if (isAppend) loadingMore.value = true;
  else loading.value = true;

  try {
    let json;
    if (currentTab.value === 'indexV8') json = await CoolapkTauriAPI.getIndexV8Feeds(currentPage.value);
    else if (currentTab.value === 'hotList') json = await CoolapkTauriAPI.getHotFeeds(currentPage.value);
    else if (currentTab.value === 'newestList') json = await CoolapkTauriAPI.getLatestFeeds(currentPage.value);
    else if (currentTab.value === 'digestList') json = await CoolapkTauriAPI.getDigestFeeds(currentPage.value);
    else if (currentTab.value === 'coolPicture') json = await CoolapkTauriAPI.getCoolPictureRank(currentPage.value);
    else if (currentTab.value === 'digitalBoard') json = await CoolapkTauriAPI.getBoardFeeds('V10_DIGITAL_HOME', currentPage.value);
    else if (currentTab.value === 'mobileBoard') json = await CoolapkTauriAPI.getBoardFeeds('V10_CHANNEL_SJB', currentPage.value);
    else if (currentTab.value === 'secondHand') json = await CoolapkTauriAPI.getSecondHandFeeds(currentPage.value);
    else if (currentTab.value === 'search') {
      json = searchMode.value === 'feed'
        ? await CoolapkTauriAPI.searchFeeds(searchQuery.value, currentPage.value)
        : await CoolapkTauriAPI.searchAll(searchQuery.value, currentPage.value);
    }

    let rawData: any[] = [];
    if (currentTab.value === 'search' && searchMode.value === 'all') {
      searchGroups.value = Array.isArray(json?.data) ? json.data : [];
    } else if (json && Array.isArray(json.data)) rawData = json.data;
    else if (Array.isArray(json)) rawData = json;

    let cleaned = rawData.map((item: any) => ({
      ...item,
      isExpanded: false,
      canExpand: false,
      showComments: false,
      commentsLoading: false,
      commentsError: '',
      commentsLoadedCount: 0,
      commentsPreloaded: Array.isArray(item.comments) && item.comments.length > 0,
      commentSort: 'time',
      replyInput: '',
      comments: item.comments || [],
      feedDetail: null,
      isLiked: false
    }));

    if (isAppend) feedList.value.push(...cleaned);
    else feedList.value = cleaned;
    void preloadFeedContent(cleaned);
  } catch (err) {
    console.error('Fetch feeds error:', err);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const fetchSidebarHot = async () => {
  try {
    const json = await CoolapkTauriAPI.getHotFeeds(1);
    if (json && json.data) sidebarHotList.value = json.data.slice(0, 6);
  } catch (err) {}
};

const handleSearch = () => {
  if (!searchQuery.value.trim()) return;
  executeSearch(searchQuery.value.trim());
};

const executeSearch = (q: string) => {
  searchQuery.value = q;
  switchMainTab('search');
};

const handleSearchEntity = (entity: any) => {
  if (entity.entityType === 'user') {
    const uid = String(entity.uid || entity.id || entity.url || '').match(/\d+/)?.[0] || '';
    if (uid) void openUserProfile(uid);
    return;
  }
  featureCenterVisible.value = true;
  featureResultTitle.value = entity.entityType === 'topic' ? '话题搜索结果' : '综合搜索结果';
  featureResultText.value = JSON.stringify(entity, null, 2);
  if (entity.entityType === 'topic') featureTopic.value = entity.title || '';
  if (entity.packageName) featurePackage.value = entity.packageName;
};

const changeSearchMode = async (mode: 'all' | 'feed') => {
  searchMode.value = mode;
  currentPage.value = 1;
  feedList.value = [];
  await fetchFeeds(false);
};

const openFeedDetail = async (feedId: string) => {
  feedDetailVisible.value = true;
  const cachedItem = feedList.value.find(item => String(item.id) === String(feedId));
  if (cachedItem?.feedDetail) {
    feedDetailData.value = cachedItem.feedDetail;
    feedDetailLoading.value = false;
    return;
  }

  feedDetailLoading.value = true;
  feedDetailData.value = {};
  try {
    const response = await CoolapkTauriAPI.getFeedDetail(String(feedId));
    feedDetailData.value = response.data || {};
    if (cachedItem) cachedItem.feedDetail = feedDetailData.value;
  } catch (error) {
    showToast(error instanceof Error ? error.message : '动态详情加载失败');
  } finally {
    feedDetailLoading.value = false;
  }
};

const saveLoginCookie = async () => {
  try {
    const message = await CoolapkTauriAPI.saveCookie(cookieInput.value);
    showToast(message);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Cookie 载入失败');
  }
};

const openNotifications = () => {
  featureCenterVisible.value = true;
  void runFeatureAction('notificationCount');
};

const runFeatureAction = async (action: string) => {
  featureLoading.value = true;
  const actions: Record<string, { title: string; run: () => Promise<any> }> = {
    userSpace: { title: '用户空间', run: () => CoolapkTauriAPI.getUserSpace(featureUid.value) },
    userProfile: { title: '用户资料', run: () => CoolapkTauriAPI.getUserProfile(featureUid.value) },
    userFeeds: { title: '用户动态', run: () => CoolapkTauriAPI.getUserFeeds(featureUid.value) },
    follow: { title: '关注用户', run: () => CoolapkTauriAPI.followUser(featureUid.value) },
    unfollow: { title: '取消关注', run: () => CoolapkTauriAPI.unfollowUser(featureUid.value) },
    topicDetail: { title: '话题详情', run: () => CoolapkTauriAPI.getTopicDetail(featureTopic.value) },
    topicFeeds: { title: '话题动态', run: () => CoolapkTauriAPI.getTopicFeeds(featureTopic.value) },
    appDetail: { title: '应用详情', run: () => CoolapkTauriAPI.getAppDetail(featurePackage.value) },
    notificationCount: { title: '未读通知计数', run: () => CoolapkTauriAPI.getNotificationCount() },
    atme: { title: '@ 我的通知', run: () => CoolapkTauriAPI.getNotifications('atme') },
    comments: { title: '评论通知', run: () => CoolapkTauriAPI.getNotifications('comment') },
    likes: { title: '点赞通知', run: () => CoolapkTauriAPI.getNotifications('like') },
    messages: { title: '私信会话', run: () => CoolapkTauriAPI.listMessages() },
    chat: { title: '聊天记录', run: () => CoolapkTauriAPI.listChatHistory(featureUkey.value) },
    sendMessage: { title: '发送私信', run: () => CoolapkTauriAPI.sendPrivateMessage(featureMessageUid.value, featureMessageText.value) },
  };
  const selected = actions[action];
  if (!selected) {
    featureLoading.value = false;
    return;
  }
  featureResultTitle.value = selected.title;
  try {
    const response = await selected.run();
    featureResultText.value = JSON.stringify(response.data ?? response, null, 2);
  } catch (error) {
    featureResultText.value = `请求失败：${error instanceof Error ? error.message : String(error)}\n\n需要登录的接口请先在左侧载入有效 Cookie。`;
  } finally {
    featureLoading.value = false;
  }
};

const submitPublish = async () => {
  if (!publishText.value.trim()) {
    showToast('请输入发布内容');
    return;
  }
  try {
    await CoolapkTauriAPI.createFeed(publishText.value.trim());
    showToast('动态发布成功！');
    publishText.value = '';
    publishModalVisible.value = false;
  } catch (error) {
    showToast(error instanceof Error ? error.message : '发布失败，请检查登录状态');
  }
};

const openUserProfile = async (uid: string) => {
  if (!uid) return;
  userProfileVisible.value = true;
  try {
    const [space, profile] = await Promise.all([
      CoolapkTauriAPI.getUserSpace(uid),
      CoolapkTauriAPI.getUserProfile(uid),
    ]);
    userProfileData.value = { ...(space.data || {}), ...(profile.data || {}), uid };
  } catch (error) {
    showToast(error instanceof Error ? error.message : '用户资料加载失败');
  }
};

const getGridClass = (len: number) => {
  if (len === 2) return 'grid-2';
  if (len >= 3) return 'grid-3';
  return 'grid-1';
};

const openLightbox = (url: string) => {
  lightboxImg.value = url;
  lightboxVisible.value = true;
};

const toggleLike = async (item: any) => {
  const nextLiked = !item.isLiked;
  try {
    if (nextLiked) await CoolapkTauriAPI.likeFeed(String(item.id));
    else await CoolapkTauriAPI.unlikeFeed(String(item.id));
    item.isLiked = nextLiked;
    item.likenum = nextLiked ? (item.likenum || 0) + 1 : Math.max(0, (item.likenum || 1) - 1);
    showToast(nextLiked ? '点赞成功 ❤️' : '已取消点赞');
  } catch (error) {
    showToast(error instanceof Error ? error.message : '操作失败，请先登录');
  }
};

const hasReplyParent = (value: unknown) => {
  const id = String(value ?? '').trim();
  return id !== '' && id !== '0';
};

const buildCommentThreads = (rows: any[]) => {
  const flattened = rows.flatMap((row: any) => [row, ...(Array.isArray(row.replyRows) ? row.replyRows : [])]);
  const comments = flattened.map((row: any) => ({
    ...row,
    userAvatar: row.userAvatar || row.userInfo?.userAvatar || '',
    userLevel: row.userLevel || row.userInfo?.level || '',
    verifyTitle: row.verifyTitle || row.userInfo?.verify_title || '',
    infoHtml: row.infoHtml || row.dateline_text || '',
    replies: [] as any[]
  }));
  const roots = comments.filter((comment: any) => !hasReplyParent(comment.rid) && !hasReplyParent(comment.rrid));
  const rootsById = new Map(roots.map((comment: any) => [String(comment.id), comment]));

  for (const comment of comments) {
    if (!hasReplyParent(comment.rid) && !hasReplyParent(comment.rrid)) continue;
    const rootId = hasReplyParent(comment.rrid) ? String(comment.rrid) : String(comment.rid);
    const root = rootsById.get(rootId);
    if (root) root.replies.push(comment);
    else roots.push(comment);
  }

  return roots;
};

const sortedComments = (item: any) => {
  const comments = [...(item.comments || [])];
  if (item.commentSort === 'hot') {
    comments.sort((left: any, right: any) =>
      ((right.likenum || 0) + (right.replies?.length || 0)) -
      ((left.likenum || 0) + (left.replies?.length || 0))
    );
  }
  return comments;
};

const loadInlineComments = async (item: any) => {
  item.commentsLoading = true;
  item.commentsError = '';

  try {
    const res = item.commentSort === 'hot'
      ? await CoolapkTauriAPI.getHotReplies(String(item.id), 1)
      : await CoolapkTauriAPI.getFeedReplies(String(item.id), 1);
    if (!res || !Array.isArray(res.data)) {
      throw new Error('评论接口返回格式不正确');
    }
    item.commentsLoadedCount = res.data.length;
    item.comments = buildCommentThreads(res.data);
    item.commentsPreloaded = true;
  } catch (err) {
    console.error('Fetch replies error:', err);
    item.commentsError = err instanceof Error ? err.message : '评论加载失败，请稍后重试';
  } finally {
    item.commentsLoading = false;
  }
};

const preloadFeedDetail = (item: any) => {
  const existing = detailPreloadTasks.get(item);
  if (existing) return existing;

  const task = (async () => {
    try {
      const response = await CoolapkTauriAPI.getFeedDetail(String(item.id));
      const detail = response?.data || null;
      if (!detail) return;
      item.feedDetail = detail;
      const fullMessage = detail.message;
      if (typeof fullMessage === 'string' && fullMessage.trim().length > String(item.message || '').trim().length) {
        item.message = fullMessage;
      }
    } catch (error) {
      console.debug('动态预加载失败，将在打开详情时重试:', error);
    }
  })();
  detailPreloadTasks.set(item, task);
  return task;
};

const preloadFeedComments = (item: any) => {
  const existing = commentPreloadTasks.get(item);
  if (existing) return existing;

  const task = (async () => {
    if (!item.id || Number(item.replynum || 0) <= 0 || item.commentsPreloaded) return;
    try {
      const response = await CoolapkTauriAPI.getFeedReplies(String(item.id), 1);
      if (!response || !Array.isArray(response.data)) return;
      item.commentsLoadedCount = response.data.length;
      item.comments = buildCommentThreads(response.data);
      item.commentsPreloaded = true;
    } catch (error) {
      console.debug('评论预加载失败，将在展开评论区时重试:', error);
    }
  })();
  commentPreloadTasks.set(item, task);
  return task;
};

// 列表先显示，再以有限并发预取首屏内容，避免影响主请求和触发接口风控。
const preloadFeedContent = async (items: any[]) => {
  const queue = items.filter(item => item?.id).slice(0, 6);
  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      await Promise.allSettled([preloadFeedDetail(item), preloadFeedComments(item)]);
    }
  };
  await Promise.all([worker(), worker()]);
};

const changeCommentSort = async (item: any, mode: 'hot' | 'time') => {
  if (item.commentSort === mode && item.comments?.length) return;
  item.commentSort = mode;
  item.comments = [];
  await loadInlineComments(item);
};

const toggleInlineComments = async (item: any) => {
  item.showComments = !item.showComments;

  if (item.showComments && !item.commentsPreloaded) {
    const pending = commentPreloadTasks.get(item);
    if (pending) await pending;
  }
  if (item.showComments && !item.commentsPreloaded) {
    await loadInlineComments(item);
  }
};

const sendComment = async (item: any) => {
  if (!item.replyInput || !item.replyInput.trim()) {
    showToast('请输入评论内容');
    return;
  }
  const message = item.replyInput.trim();
  try {
    await CoolapkTauriAPI.replyFeed(String(item.id), message);
    item.comments.unshift({
      id: Date.now().toString(),
      username: '我',
      userAvatar: '',
      message,
      infoHtml: '刚刚',
      deviceTitle: '桌面客户端',
      likenum: 0,
      replies: []
    });
    item.replyInput = '';
    item.replynum = (item.replynum || 0) + 1;
    item.commentsLoadedCount = (item.commentsLoadedCount || 0) + 1;
    showToast('评论发表成功！');
  } catch (error) {
    showToast(error instanceof Error ? error.message : '评论失败，请先登录');
  }
};
</script>

<style>
:root {
  --brand-green: #10B96A;
  --brand-green-dark: #079653;
  --brand-green-light: #EAF8F1;
  --bg-page: #F8FAFC;
  --bg-card: #FFFFFF;
  --text-main: #1E293B;
  --text-sub: #64748B;
  --text-muted: #94A3B8;
  --border-color: #E2E8F0;
  --radius-card: 12px;
  --radius-btn: 6px;
  --shadow-flat: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
  --shadow-hover: 0 4px 12px -2px rgba(15, 23, 42, 0.08);

  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif; }
html, body { height: 100vh; overflow: hidden; background-color: var(--bg-page); color: var(--text-main); }

.app-root { height: 100vh; display: flex; flex-direction: column; overflow: hidden; width: 100%; transition: zoom 0.2s ease; }

header { height: 56px; flex-shrink: 0; background: var(--bg-card); border-bottom: 1px solid var(--border-color); z-index: 100; width: 100%; }
.nav-container { max-width: 1240px; width: 100%; margin: 0 auto; height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; gap: 16px; box-sizing: border-box; }
.brand-section { display: flex; align-items: center; gap: 18px; flex-shrink: 0; }
.brand-logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1.12rem; color: var(--brand-green); cursor: pointer; }
.brand-icon { width: 32px; height: 32px; border-radius: 9px; display: block; object-fit: cover; }

.search-box { flex: 1; max-width: 380px; position: relative; min-width: 0; }
.search-input { width: 100%; height: 34px; background: var(--bg-page); border: 1px solid var(--border-color); border-radius: 17px; padding: 0 16px 0 36px; font-size: 0.86rem; outline: none; transition: border-color 0.2s; }
.search-input:focus { border-color: var(--brand-green); background: var(--bg-card); }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.82rem; }

.nav-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.btn-post { background: var(--brand-green); color: white; border: none; padding: 6px 15px; border-radius: 16px; font-weight: 600; font-size: 0.86rem; cursor: pointer; }
.rust-status-tag { background: var(--brand-green-light); color: var(--brand-green); font-size: 0.76rem; font-weight: 600; padding: 4px 10px; border-radius: 12px; }
.user-avatar { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border-color); object-fit: cover; cursor: pointer; }

.main-wrapper { max-width: 1240px; width: 100%; margin: 0 auto; padding: 14px 20px 0 20px; display: grid; grid-template-columns: 190px minmax(0, 1fr) 280px; gap: 16px; height: calc(100vh - 56px); overflow: hidden; box-sizing: border-box; }
.left-sidebar, .right-sidebar { height: 100%; min-width: 0; }

.menu-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-card); padding: 6px 4px; box-shadow: var(--shadow-flat); }
.menu-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-btn); color: var(--text-main); font-size: 0.88rem; font-weight: 500; cursor: pointer; margin-bottom: 2px; }
.menu-item.active { background: var(--brand-green-light); color: var(--brand-green); font-weight: 600; }
.footer-info { padding: 8px; font-size: 0.74rem; color: var(--text-muted); line-height: 1.5; }

.center-content { display: flex; flex-direction: column; gap: 12px; height: 100%; overflow-y: auto; padding-right: 4px; padding-bottom: 24px; min-width: 0; }
.center-content::-webkit-scrollbar { width: 5px; }
.center-content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

.filter-tabs { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-card); padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.channel-title { font-size: 0.94rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
.refresh-btn { font-size: 0.82rem; color: var(--text-sub); cursor: pointer; font-weight: 500; }
.refresh-btn:hover { color: var(--brand-green); }

.loading-state { text-align: center; padding: 40px; color: var(--text-sub); }

.feed-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-card); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow-flat); }
.top-tag-row { display: flex; gap: 6px; font-size: 0.74rem; font-weight: 600; }
.badge-top { background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 4px; }
.badge-target { background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; }

.feed-header { display: flex; align-items: center; justify-content: space-between; }
.author-info { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.author-avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
.author-name-row { display: flex; align-items: center; gap: 6px; }
.author-name { font-weight: 600; font-size: 0.9rem; color: var(--text-main); }
.badge-verify { font-size: 0.72rem; color: #0284c7; background: #e0f2fe; padding: 0 4px; border-radius: 3px; font-weight: 600; }
.level-badge { background: linear-gradient(135deg, #10B96A, #059669); color: white; font-size: 0.65rem; font-weight: 700; padding: 0 5px; border-radius: 3px; }
.post-sub-info { font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 10px; margin-top: 2px; }
.device-tag { color: var(--text-sub); font-weight: 500; }

.post-title { font-size: 0.98rem; font-weight: 700; }
.post-text { font-size: 0.9rem; line-height: 1.55; word-break: break-word; white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 12; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; max-height: 17rem; color: #334155; }
.post-text.expanded { max-height: none; -webkit-line-clamp: unset; }

.cool-tag { color: var(--brand-green); font-weight: 600; margin-right: 4px; cursor: pointer; }
.cool-uname { color: #0284c7; font-weight: 600; cursor: pointer; }
.coolapk-emoji { display: inline-block; width: 1.35em; height: 1.35em; object-fit: contain; vertical-align: -0.28em; margin: 0 1px; }

.read-more-tag { font-size: 0.82rem; color: var(--brand-green); font-weight: 600; cursor: pointer; }

.image-grid { display: grid; gap: 6px; margin-top: 4px; width: 100%; }
.image-grid.grid-1 { grid-template-columns: 1fr; max-width: 320px; }
.image-grid.grid-2 { grid-template-columns: repeat(2, 1fr); max-width: 440px; }
.image-grid.grid-3 { grid-template-columns: repeat(3, 1fr); max-width: 540px; }
.grid-img { width: 100%; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color); cursor: zoom-in; transition: transform 0.15s ease; }
.grid-img:hover { transform: scale(1.02); }
.grid-1 .grid-img { height: auto; max-height: 280px; }

.feed-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border-color); color: var(--text-sub); font-size: 0.82rem; }
.footer-action { display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 3px 8px; border-radius: 4px; }
.footer-action:hover, .footer-action.liked { color: var(--brand-green); background: var(--brand-green-light); }

.wb-inline-comments { margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 14px; background: #fafafa; margin-left: -16px; margin-right: -16px; margin-bottom: -14px; padding-left: 16px; padding-right: 16px; padding-bottom: 14px; border-bottom-left-radius: var(--radius-card); border-bottom-right-radius: var(--radius-card); }
.wb-input-box { display: flex; gap: 10px; }
.wb-avatar-small { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
.wb-input-right { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.wb-textarea { width: 100%; height: 34px; border: 1px solid var(--border-color); border-radius: 6px; padding: 6px 10px; font-size: 0.84rem; outline: none; background: var(--bg-card); resize: none; transition: height 0.2s, border-color 0.2s; }
.wb-textarea:focus { border-color: var(--brand-green); height: 54px; }
.wb-input-toolbar { display: flex; justify-content: space-between; align-items: center; }
.wb-tool-icons { display: flex; gap: 12px; color: var(--text-muted); cursor: pointer; font-size: 0.9rem; }
.wb-btn-send { background: var(--brand-green); color: white; border: none; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }

.wb-comment-list { display: flex; flex-direction: column; }
.wb-comment-sort { display: flex; gap: 24px; padding: 2px 2px 12px 52px; border-bottom: 1px solid #eef1f4; }
.wb-comment-sort button { padding: 0; border: 0; background: transparent; color: #475569; font-size: 0.83rem; cursor: pointer; }
.wb-comment-sort button.active { color: #ff8200; font-weight: 700; }
.wb-comment-item { display: flex; gap: 12px; font-size: 0.86rem; padding: 16px 2px; border-bottom: 1px solid #eef1f4; }
.wb-comment-avatar { width: 42px; height: 42px; flex: 0 0 42px; border-radius: 50%; object-fit: cover; background: #eef2f6; }
.wb-comment-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 7px; }
.wb-comment-text-row, .wb-thread-text { line-height: 1.65; color: #30343b; word-break: break-word; }
.wb-comment-username { font-weight: 600; color: #334155; cursor: pointer; }
.wb-comment-username:hover { color: var(--brand-green); }
.wb-at-name { color: #52657a; font-weight: 500; }
.wb-comment-content { color: #30343b; }
.wb-level-tag, .wb-verify-tag { display: inline-flex; align-items: center; margin-left: 5px; padding: 0 4px; border: 1px solid #e2e8f0; border-radius: 3px; font-size: 0.62rem; line-height: 1.05rem; vertical-align: 1px; font-weight: 500; }
.wb-level-tag { color: #64748b; background: #f8fafc; }
.wb-verify-tag { color: #64748b; background: #f1f5f9; }
.wb-comment-meta { min-height: 22px; display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #939aa4; }
.wb-comment-actions { display: flex; align-items: center; gap: 22px; padding-right: 4px; font-size: 0.88rem; }
.wb-comment-actions b { font-weight: 400; font-size: 0.72rem; }
.wb-thread-replies { margin-top: 2px; padding-left: 12px; border-left: 2px solid #edf0f3; display: flex; flex-direction: column; gap: 10px; }
.wb-thread-reply { display: flex; flex-direction: column; gap: 2px; }
.wb-thread-meta { display: flex; justify-content: space-between; align-items: center; color: #939aa4; font-size: 0.74rem; }
.wb-reply-word { color: #94a3b8; }
.wb-comment-picture { display: block; width: auto; max-width: 220px; max-height: 180px; border-radius: 6px; object-fit: cover; cursor: zoom-in; }
.wb-comment-picture.small { max-width: 160px; max-height: 130px; }
.wb-comment-total { padding: 14px 0 2px; text-align: center; color: #4b5563; font-size: 0.82rem; }
.act-btn { cursor: pointer; color: #7f8791; }
.act-btn:hover { color: #ff8200; }

.btn-feature { border: 1px solid #d9e2ea; background: #fff; color: #475569; padding: 7px 12px; border-radius: 18px; font-size: 0.8rem; cursor: pointer; }
.btn-feature:hover { color: var(--brand-green); border-color: var(--brand-green); }
.search-mode { cursor: pointer; padding: 3px 7px; border-radius: 5px; color: var(--text-muted); font-size: 0.78rem; }
.search-mode.active { color: var(--brand-green); background: var(--brand-green-light); font-weight: 700; }
.search-groups { display: flex; flex-direction: column; gap: 12px; }
.search-group-card { padding: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-card); background: #fff; }
.search-group-card h3 { margin: 0 0 10px; font-size: 0.92rem; }
.search-entity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.search-entity { min-width: 0; display: flex; align-items: center; gap: 9px; padding: 8px; border: 1px solid #edf0f3; border-radius: 8px; background: #fff; text-align: left; cursor: pointer; }
.search-entity:hover { border-color: var(--brand-green); background: #f8fffb; }
.search-entity img { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; }
.search-entity span { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.search-entity b, .search-entity small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.search-entity b { font-size: 0.8rem; color: #334155; }
.search-entity small { margin-top: 2px; font-size: 0.7rem; color: var(--text-muted); }
.search-entity i { color: #b1bbc6; font-size: 0.7rem; }
.api-detail-modal { width: min(760px, 90vw); max-width: 760px; max-height: 82vh; overflow: auto; }
.feed-detail-body { display: flex; flex-direction: column; gap: 12px; }
.feed-detail-author { display: flex; align-items: center; gap: 10px; }
.feed-detail-author img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.feed-detail-author p { margin: 3px 0 0; color: var(--text-muted); font-size: 0.76rem; }
.feed-detail-message { line-height: 1.7; white-space: pre-wrap; color: #334155; }
.feed-detail-stats { padding-top: 10px; border-top: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.78rem; }
.feature-center-modal { width: min(1040px, 94vw); max-width: 1040px; height: min(760px, 88vh); max-height: 88vh; }
.feature-center-body { height: calc(100% - 48px); display: grid; grid-template-columns: 330px 1fr; overflow: hidden; }
.feature-tools { overflow-y: auto; padding: 14px; border-right: 1px solid var(--border-color); background: #f8fafc; }
.feature-tools section { margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e6ebf0; display: flex; flex-direction: column; gap: 7px; }
.feature-tools h4 { margin: 0 0 3px; font-size: 0.84rem; color: #334155; }
.feature-tools input, .feature-tools textarea { width: 100%; border: 1px solid #d9e2ea; border-radius: 6px; padding: 7px 8px; background: #fff; font-size: 0.76rem; resize: vertical; }
.feature-tools textarea { min-height: 54px; }
.feature-tools button { border: 1px solid #cfd9e3; border-radius: 5px; padding: 6px 8px; background: #fff; color: #475569; font-size: 0.75rem; cursor: pointer; }
.feature-tools button:hover { color: var(--brand-green); border-color: var(--brand-green); }
.feature-button-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.feature-result { min-width: 0; display: flex; flex-direction: column; background: #fff; }
.feature-result-header { display: flex; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid var(--border-color); font-size: 0.86rem; }
.feature-result pre { flex: 1; margin: 0; padding: 16px; overflow: auto; white-space: pre-wrap; word-break: break-word; color: #334155; background: #fbfcfd; font: 0.75rem/1.6 Consolas, monospace; }

.right-sidebar { display: flex; flex-direction: column; gap: 12px; }
.widget-box { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-card); padding: 12px; box-shadow: var(--shadow-flat); }
.widget-header { font-size: 0.9rem; font-weight: 700; margin-bottom: 8px; display: flex; justify-content: space-between; }
.rank-list { display: flex; flex-direction: column; gap: 6px; }
.rank-item { display: flex; align-items: center; gap: 8px; font-size: 0.84rem; cursor: pointer; }
.rank-num { width: 17px; height: 17px; background: var(--bg-page); color: var(--text-sub); font-size: 0.7rem; font-weight: 700; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
.rank-num.top3 { background: var(--brand-green-light); color: var(--brand-green); }
.rank-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.btn-loadmore { background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-sub); width: 100%; padding: 10px; border-radius: var(--radius-card); font-weight: 600; cursor: pointer; text-align: center; }

/* Modals */
.modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; }
.modal-box { background: var(--bg-card); border-radius: var(--radius-card); border: 1px solid var(--border-color); width: 100%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-hover); }
.modal-header { padding: 14px 18px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 1rem; }
.modal-body { padding: 16px 18px; overflow-y: auto; flex: 1; }

.lightbox-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.92); z-index: 300; display: flex; align-items: center; justify-content: center; }
.lightbox-img { max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: 6px; }
.lightbox-close { position: absolute; top: 20px; right: 24px; color: white; font-size: 2rem; cursor: pointer; }

.toast-msg { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1e293b; color: white; padding: 8px 18px; border-radius: 18px; font-size: 0.86rem; z-index: 400; }

@media (max-width: 1024px) {
  .main-wrapper { grid-template-columns: 190px minmax(0, 1fr); }
  .right-sidebar { display: none; }
}

@media (max-width: 768px) {
  .main-wrapper { grid-template-columns: minmax(0, 1fr); padding: 10px; }
  .left-sidebar { display: none; }
}
</style>
