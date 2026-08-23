<template>
  <div class="page-container custom-scrollbar" @scroll="handlePageScroll">
    <!-- 当前应用标题 -->
    <div class="detail-nav-bar">
      <span v-if="appTitle" class="nav-app-name">{{ appTitle }}</span>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <LoadingState text="正在加载应用详情..." />
    </div>

    <div v-else-if="!appInfo" class="empty-wrapper">
      <EmptyState title="未找到该应用信息" description="该应用可能已被下架或包名不正确" />
    </div>

    <div v-else class="app-detail-content">
      <!-- 头部应用主信息卡片 (所有 Tab 共享) -->
      <div class="app-header-card">
        <div class="app-logo-wrapper">
          <AppImage :src="logoUrl" alt="App Logo" image-class="app-large-icon" />
        </div>

        <div class="app-main-meta">
          <!-- 标题与版本、包名行 -->
          <div class="title-row">
            <h1 class="app-title">{{ appTitle }}</h1>
            <span v-if="appVersion" class="version-tag">v{{ appVersion }}</span>
            <button
              v-if="packageName"
              class="package-tag-btn"
              :title="`点击复制包名: ${packageName}`"
              @click="copyPackageName"
            >
              <i :class="isCopied ? 'fas fa-check text-success' : 'far fa-copy'"></i>
              <span class="package-name-text">{{ packageName }}</span>
            </button>
          </div>

          <!-- 开发者、大小、更新时间行 -->
          <div class="sub-row">
            <span class="developer-text"><i class="far fa-building meta-icon"></i>{{ developerName }}</span>
            <span class="dot-divider">•</span>
            <span class="apk-size"><i class="fas fa-file-arrow-down meta-icon"></i>{{ apkSize }}</span>
            <span class="dot-divider">•</span>
            <span class="update-time"><i class="far fa-clock meta-icon"></i>{{ updateTime }}</span>
          </div>

          <!-- 核心指标卡片组（评分 + 5 颗星、下载量、分类） -->
          <div class="metrics-cards-row">
            <!-- 评分卡片（含 5 颗星 ⭐⭐⭐⭐⭐） -->
            <div class="metric-card rating-card">
              <div class="metric-card-top">
                <span class="rating-score-num">{{ ratingScore }}</span>
                <div class="stars-track" :title="`评分 ${ratingScore} 分（5星折算 ${starScore} 星）`">
                  <span
                    v-for="(star, index) in starList"
                    :key="index"
                    :class="['star-unit', `star-${star}`]"
                  >
                    <i v-if="star === 'full'" class="fas fa-star"></i>
                    <i v-else-if="star === 'half'" class="fas fa-star-half-stroke"></i>
                    <i v-else class="far fa-star"></i>
                  </span>
                </div>
              </div>
              <span class="metric-card-sub">{{ ratingCount }} 人评分</span>
            </div>

            <!-- 下载量卡片 -->
            <div class="metric-card download-card">
              <div class="metric-card-top">
                <span class="metric-big-num">{{ downloadCount }}</span>
              </div>
              <span class="metric-card-sub">累计下载量</span>
            </div>

            <!-- 分类与属性卡片 -->
            <div class="metric-card category-card">
              <div class="metric-card-top">
                <span class="metric-tag-text"><i class="fas fa-layer-group tag-icon"></i>{{ appCategory }}</span>
              </div>
              <span class="metric-card-sub">官方安全应用</span>
            </div>
          </div>
        </div>

        <!-- 右侧操作区：主次分明的分层网格 -->
        <div class="header-actions">
          <!-- 核心主下载按钮 -->
          <AppButton
            variant="primary"
            size="md"
            icon="fas fa-download"
            class="primary-download-btn"
            :loading="downloadLoading"
            @click="handleDownload"
          >
            立即下载
          </AppButton>

          <!-- 关注与收藏并排行 -->
          <div class="secondary-actions-row">
            <AppButton
              :variant="isFollowed ? 'secondary' : 'soft'"
              size="sm"
              :icon="isFollowed ? 'fas fa-check' : 'fas fa-plus'"
              class="action-half-btn"
              @click="toggleFollow"
            >
              {{ isFollowed ? '已关注' : '关注应用' }}
            </AppButton>
            <AppButton
              :variant="isFavorited ? 'secondary' : 'soft'"
              size="sm"
              :icon="isFavorited ? 'fas fa-star text-gold' : 'far fa-star'"
              class="action-half-btn"
              :loading="favoriteLoading"
              @click="toggleFavorite"
            >
              {{ isFavorited ? '已收藏' : '收藏应用' }}
            </AppButton>
          </div>

          <!-- 辅助工具并排小按钮（二维码、检查更新） -->
          <div class="utility-actions-row">
            <AppButton
              variant="secondary"
              size="sm"
              icon="fas fa-qrcode"
              class="action-half-btn"
              :loading="qrLoading"
              @click="handleShowQr"
            >
              二维码
            </AppButton>
            <AppButton
              variant="secondary"
              size="sm"
              icon="fas fa-sync-alt"
              class="action-half-btn"
              :loading="updateLoading"
              @click="handleCheckUpdate"
            >
              检查更新
            </AppButton>
          </div>
        </div>
      </div>

      <!-- 二维码弹层 -->
      <AppDialog :is-open="!!qrImageUrl" title="手机扫码下载" :width="360" @close="closeQrModal">
        <div class="qr-modal-body">
          <AppImage :src="qrImageUrl" alt="下载二维码" image-class="qr-image" />
          <p class="qr-hint">使用手机扫码即可下载安装该应用</p>
        </div>
      </AppDialog>

      <!-- Tab 导航 -->
      <div class="detail-tabs">
        <button
          v-for="tab in detailTabs"
          :key="tab.key"
          :class="['detail-tab-item', { 'is-active': activeDetailTab === tab.key }]"
          @click="selectDetailTab(tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span v-if="activeDetailTab === tab.key" class="tab-indicator"></span>
        </button>
      </div>

      <!-- Tab: 应用详情 -->
      <template v-if="activeDetailTab === 'detail'">
        <!-- 应用截图列表横滑区域 -->
        <div v-if="screenshots.length > 0" class="section-card">
          <h3 class="section-title"><i class="fas fa-images icon"></i> 应用截图</h3>
          <div class="screenshot-carousel custom-scrollbar">
            <div
              v-for="(img, idx) in screenshots"
              :key="idx"
              class="screenshot-item"
              @click="openViewer(idx)"
            >
              <AppImage :src="img" image-class="screenshot-img" />
            </div>
          </div>
        </div>

        <!-- 应用简介描述 -->
        <div class="section-card">
          <h3 class="section-title"><i class="fas fa-align-left icon"></i> 应用简介</h3>
          <div class="description-body" v-html="formattedDescription" @click="handleAnchorClick"></div>
        </div>

        <!-- 更新日志 -->
        <div v-if="formattedChangeLog" class="section-card">
          <h3 class="section-title"><i class="fas fa-clock-rotate-left icon"></i> 新版更新日志</h3>
          <div class="changelog-body" v-html="formattedChangeLog" @click="handleAnchorClick"></div>
        </div>

        <!-- 相关推荐 -->
        <div class="section-card">
          <h3 class="section-title"><i class="fas fa-thumbs-up icon"></i> 相关推荐</h3>

          <div v-if="recommendLoading" class="loading-wrapper">
            <LoadingState text="正在加载推荐..." />
          </div>

          <div v-else-if="recommendError" class="error-wrapper">
            <ErrorState title="加载推荐失败" :message="recommendError" @retry="loadRecommendations()" />
          </div>

          <EmptyState v-else-if="recommendList.length === 0" title="暂无相关推荐" description="暂时没有更多相关应用推荐" />

          <div v-else class="recommend-grid">
            <div
              v-for="app in recommendList"
              :key="app.packageName || app.title || app.appName"
              class="recommend-card"
              @click="goApp(app)"
            >
              <AppImage :src="recommendIcon(app)" alt="App Logo" image-class="recommend-icon" />
              <div class="recommend-info">
                <span class="recommend-name">{{ recommendName(app) }}</span>
                <span v-if="recommendMeta(app)" class="recommend-meta">{{ recommendMeta(app) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Tab: 版本历史 -->
      <template v-if="activeDetailTab === 'versions'">
        <div v-if="versionsLoading && versionsList.length === 0" class="loading-wrapper">
          <LoadingState text="正在加载版本历史..." />
        </div>

        <div v-else-if="versionsError && versionsList.length === 0" class="error-wrapper">
          <ErrorState title="加载版本历史失败" :message="versionsError" @retry="loadVersions()" />
        </div>

        <div v-else-if="versionsList.length === 0" class="empty-wrapper">
          <EmptyState title="暂无版本记录" description="该应用暂时没有历史版本信息" />
        </div>

        <div v-else class="versions-list">
          <div v-for="(ver, idx) in versionsList" :key="idx" class="version-card">
            <div class="version-card-main">
              <span class="version-name">{{ versionName(ver) }}</span>
              <span v-if="versionSize(ver)" class="version-size">{{ versionSize(ver) }}</span>
            </div>
            <span v-if="versionDate(ver)" class="version-date">{{ versionDate(ver) }}</span>
            <div v-if="versionLog(ver)" class="version-log">{{ versionLog(ver) }}</div>
          </div>
        </div>
      </template>

      <!-- Tab: 发现者 -->
      <template v-if="activeDetailTab === 'discoverers'">
        <div v-if="discoverersLoading && discoverersList.length === 0" class="loading-wrapper">
          <LoadingState text="正在加载发现者..." />
        </div>

        <div v-else-if="discoverersError && discoverersList.length === 0" class="error-wrapper">
          <ErrorState title="加载发现者失败" :message="discoverersError" @retry="loadDiscoverers(true)" />
        </div>

        <div v-else-if="discoverersList.length === 0" class="empty-wrapper">
          <EmptyState title="暂无发现者" description="还没有人发现过该应用" />
        </div>

        <div v-else class="discoverer-list">
          <div
            v-for="user in discoverersList"
            :key="user.uid || user.username"
            class="discoverer-item"
            @click="goUser(user)"
          >
            <AppImage :src="user.userAvatar || ''" alt="头像" image-class="discoverer-avatar" />
            <span class="discoverer-name">{{ user.username || user.uid || '酷安用户' }}</span>
            <i class="fas fa-chevron-right discoverer-arrow"></i>
          </div>

          <div class="pagination-footer">
            <LoadingState v-if="discoverersLoading && discoverersPage > 1" text="加载更多中..." />
            <div v-else-if="discoverersNoMore" class="no-more">没有更多发现者了</div>
          </div>
        </div>
      </template>

      <!-- Tab: 礼包 -->
      <template v-if="activeDetailTab === 'gifts'">
        <div v-if="giftsLoading && giftsList.length === 0" class="loading-wrapper">
          <LoadingState text="正在加载礼包..." />
        </div>

        <div v-else-if="giftsError && giftsList.length === 0" class="error-wrapper">
          <ErrorState title="加载礼包失败" :message="giftsError" @retry="loadGifts(true)" />
        </div>

        <div v-else-if="giftsList.length === 0" class="empty-wrapper">
          <EmptyState title="暂无礼包" description="该应用暂时没有可领取的礼包" />
        </div>

        <div v-else class="gift-list">
          <div v-for="gift in giftsList" :key="gift.id || gift.title || gift.giftName || gift.name" class="gift-card">
            <AppImage v-if="giftLogo(gift)" :src="giftLogo(gift)" alt="礼包图片" image-class="gift-logo" />
            <div class="gift-info">
              <span class="gift-title">{{ giftTitle(gift) }}</span>
              <span v-if="giftDesc(gift)" class="gift-desc">{{ giftDesc(gift) }}</span>
            </div>
            <button
              :class="['gift-btn', { 'is-disabled': !giftLink(gift) }]"
              @click="handleGiftClaim(gift)"
            >
              {{ giftLink(gift) ? '领取' : '已领取' }}
            </button>
          </div>

          <div class="pagination-footer">
            <LoadingState v-if="giftsLoading && giftsPage > 1" text="加载更多中..." />
            <div v-else-if="giftsNoMore" class="no-more">没有更多礼包了</div>
          </div>
        </div>
      </template>

      <!-- Tab: 应用评论；使用 /v6/apk/commentList 与 /v6/apk/comment，区别于动态讨论接口 -->
      <template v-if="activeDetailTab === 'comments'">
        <div v-if="commentsLoading && apkComments.length === 0" class="loading-wrapper">
          <LoadingState text="正在加载应用评论..." />
        </div>

        <div v-else-if="commentsError && apkComments.length === 0" class="error-wrapper">
          <ErrorState title="加载应用评论失败" :message="commentsError" @retry="loadApkComments(true)" />
        </div>

        <div v-else class="app-comments-panel">
          <FeedCommentSection
            :feed-id="''"
            :feed-uid="String(appInfo?.creatoruid || '')"
            :comments="apkComments"
            :loading="false"
            @send-comment="sendAppComment"
          />

          <div class="pagination-footer">
            <LoadingState v-if="commentsLoading" text="加载更多评论..." />
            <button v-else-if="commentsError" class="retry-inline" @click="loadApkComments(false)">加载失败，点击重试</button>
            <div v-else-if="commentsNoMore && apkComments.length > 0" class="no-more">没有更多评论了</div>
          </div>
        </div>
      </template>

      <!-- Tab: 讨论 -->
      <template v-if="activeDetailTab === 'discussions'">
        <div v-if="discussionsLoading && discussionFeeds.length === 0" class="loading-wrapper">
          <LoadingState text="正在加载讨论..." />
        </div>

        <div v-else-if="discussionsError && discussionFeeds.length === 0" class="error-wrapper">
          <ErrorState title="加载讨论失败" :message="discussionsError" @retry="loadDiscussions(false)" />
        </div>

        <div v-else-if="discussionFeeds.length === 0" class="empty-wrapper">
          <EmptyState title="暂无讨论" description="快来发布第一条讨论吧" />
        </div>

        <div v-else class="feed-list">
          <FeedCard v-for="item in discussionFeeds" :key="item.id" :feed="item" @deleted="handleFeedDeleted" />

          <div class="pagination-footer">
            <LoadingState v-if="discussionsLoading && discussionsPage > 1" text="加载更多中..." />
            <div v-else-if="discussionsNoMore" class="no-more">没有更多讨论了</div>
          </div>
        </div>
      </template>

      <!-- Tab: 权限；权限申请列表来自应用详情接口返回的 permissions 字段 -->
      <template v-if="activeDetailTab === 'permissions'">
        <div v-if="permissionEntries.length === 0" class="empty-wrapper">
          <EmptyState title="暂无权限信息" description="该应用详情未返回权限申请列表" />
        </div>

        <div v-else class="section-card">
          <h3 class="section-title"><i class="fas fa-shield-halved icon"></i> 权限申请（{{ permissionEntries.length }}）</h3>
          <div class="permission-list">
            <div v-for="(perm, idx) in permissionEntries" :key="idx" class="permission-item">
              <i class="fas fa-shield-halved permission-icon"></i>
              <div class="permission-info">
                <span class="permission-name">{{ permissionName(perm) }}</span>
                <span v-if="permissionDesc(perm)" class="permission-desc">{{ permissionDesc(perm) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Tab: 相关应用；数据来源 GET /v6/apk/search?searchType=related -->
      <template v-if="activeDetailTab === 'relatedApps'">
        <div v-if="relatedAppsLoading && relatedAppsList.length === 0" class="loading-wrapper">
          <LoadingState text="正在加载相关应用..." />
        </div>

        <div v-else-if="relatedAppsError && relatedAppsList.length === 0" class="error-wrapper">
          <ErrorState title="加载相关应用失败" :message="relatedAppsError" @retry="loadRelatedApps(true)" />
        </div>

        <div v-else-if="relatedAppsList.length === 0" class="empty-wrapper">
          <EmptyState title="暂无相关应用" description="暂时没有更多相关应用" />
        </div>

        <div v-else class="related-apps-wrap">
          <div class="recommend-grid">
            <div
              v-for="app in relatedAppsList"
              :key="app.packageName || app.id || app.title || app.appName"
              class="recommend-card"
              @click="goApp(app)"
            >
              <AppImage :src="recommendIcon(app)" alt="App Logo" image-class="recommend-icon" />
              <div class="recommend-info">
                <span class="recommend-name">{{ recommendName(app) }}</span>
                <span v-if="recommendMeta(app)" class="recommend-meta">{{ recommendMeta(app) }}</span>
              </div>
            </div>
          </div>

          <div class="pagination-footer">
            <LoadingState v-if="relatedAppsLoading && relatedAppsPage > 1" text="加载更多中..." />
            <div v-else-if="relatedAppsNoMore" class="no-more">没有更多相关应用了</div>
          </div>
        </div>
      </template>

      <!-- Tab: 相关专辑；官方客户端经 /v6/album/search 按包名检索收录该应用的应用集 -->
      <template v-if="activeDetailTab === 'relatedAlbums'">
        <div v-if="relatedAlbumsLoading && relatedAlbumsList.length === 0" class="loading-wrapper">
          <LoadingState text="正在加载相关专辑..." />
        </div>

        <div v-else-if="relatedAlbumsError && relatedAlbumsList.length === 0" class="error-wrapper">
          <ErrorState title="加载相关专辑失败" :message="relatedAlbumsError" @retry="loadRelatedAlbums(true)" />
        </div>

        <div v-else-if="relatedAlbumsList.length === 0" class="empty-wrapper">
          <EmptyState title="暂无相关专辑" description="暂时没有收录该应用的应用集" />
        </div>

        <div v-else class="related-albums-grid">
          <div
            v-for="(item, idx) in relatedAlbumsList"
            :key="albumIdOf(item) || idx"
            class="album-card"
            @click="goAlbum(item)"
          >
            <div class="album-cover-wrapper">
              <AppImage
                v-if="albumCoverOf(item)"
                :src="albumCoverOf(item)"
                class="album-cover"
                fit="cover"
                :alt="albumTitleOf(item)"
              />
              <div v-else class="album-cover-fallback">
                <i class="fas fa-layer-group"></i>
              </div>
            </div>

            <div class="album-card-info">
              <span class="album-card-title" :title="albumTitleOf(item)">{{ albumTitleOf(item) }}</span>
              <div v-if="albumAuthorOf(item)" class="album-card-author">
                <i class="far fa-user"></i>
                <span class="album-author-name">{{ albumAuthorOf(item) }}</span>
              </div>
              <div class="album-card-meta">
                <span class="album-count"><i class="fas fa-cubes"></i> {{ formatAlbumCount(albumAppCountOf(item)) }} 应用</span>
              </div>
              <p v-if="albumDescOf(item)" class="album-card-desc">{{ albumDescOf(item) }}</p>
            </div>
          </div>

          <div class="pagination-footer">
            <LoadingState v-if="relatedAlbumsLoading && relatedAlbumsPage > 1" text="加载更多中..." />
            <div v-else-if="relatedAlbumsNoMore" class="no-more">没有更多相关专辑了</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import AppButton from '../components/common/AppButton.vue';
import AppImage from '../components/common/AppImage.vue';
import AppDialog from '../components/common/AppDialog.vue';
import FeedCard from '../components/feed/FeedCard.vue';
import FeedCommentSection from '../components/feed/FeedCommentSection.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { renderCoolapkRichText } from '../utils/richText';
import { handleAnchorClick } from '../utils/anchorClick';
import { getErrorMessage } from '../utils/errors';
import { showToast } from '../utils/toast';
import type { RelatedApp, RelatedAlbum } from '../types/appDetail';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
// 每个完整路径对应独立缓存实例，固定本实例的路由参数，避免页面隐藏后响应其他路由。
const packageName = ref((route.params.packageName as string) || '');


const loading = ref(false);
const appInfo = ref<any>(null);
const isFollowed = ref(false);
const isFavorited = ref(false);
const favoriteLoading = ref(false);

const downloadLoading = ref(false);
const qrLoading = ref(false);
const updateLoading = ref(false);
const qrImageUrl = ref('');

const activeDetailTab = ref('detail');
const detailTabs = [
  { key: 'detail', label: '应用详情' },
  { key: 'versions', label: '版本历史' },
  { key: 'discoverers', label: '发现者' },
  { key: 'discussions', label: '讨论' },
  { key: 'comments', label: '评论' },
  { key: 'gifts', label: '礼包' },
  { key: 'permissions', label: '权限' },
  { key: 'relatedApps', label: '相关应用' },
  { key: 'relatedAlbums', label: '相关专辑' },
];

const discussionFeeds = ref<any[]>([]);
const apkComments = ref<any[]>([]);
const commentsPage = ref(1);
const commentsLoading = ref(false);
const commentsNoMore = ref(false);
const commentsError = ref('');
const commentSubmitting = ref(false);

function handleFeedDeleted(id: string | number) {
  discussionFeeds.value = discussionFeeds.value.filter((f: any) => String(f.id) !== String(id));
}
const discussionsPage = ref(1);
const discussionsLoading = ref(false);
const discussionsNoMore = ref(false);
const discussionsError = ref('');

const versionsList = ref<any[]>([]);
const versionsLoading = ref(false);
const versionsError = ref('');

const discoverersList = ref<any[]>([]);
const discoverersPage = ref(1);
const discoverersLoading = ref(false);
const discoverersNoMore = ref(false);
const discoverersError = ref('');

const giftsList = ref<any[]>([]);
const giftsPage = ref(1);
const giftsLoading = ref(false);
const giftsNoMore = ref(false);
const giftsError = ref('');

const relatedAppsList = ref<RelatedApp[]>([]);
const relatedAppsPage = ref(1);
const relatedAppsLoading = ref(false);
const relatedAppsNoMore = ref(false);
const relatedAppsError = ref('');

const relatedAlbumsList = ref<RelatedAlbum[]>([]);
const relatedAlbumsPage = ref(1);
const relatedAlbumsLoading = ref(false);
const relatedAlbumsNoMore = ref(false);
const relatedAlbumsError = ref('');

const recommendList = ref<any[]>([]);
const recommendLoading = ref(false);
const recommendError = ref('');

const logoUrl = computed(() => appInfo.value?.apkRomIcon || appInfo.value?.logo || appInfo.value?.icon || '');
const appTitle = computed(() => appInfo.value?.title || appInfo.value?.shorttitle || packageName.value);
const appVersion = computed(() => appInfo.value?.apkversionname || appInfo.value?.versionName || appInfo.value?.version || '');
const developerName = computed(() => appInfo.value?.developername || appInfo.value?.shorttitle || '酷安开发者');
const apkSize = computed(() => appInfo.value?.apksize || appInfo.value?.apkSizeFormatted || appInfo.value?.size || '未知大小');
const updateTime = computed(() => {
  const raw = appInfo.value?.lastupdate || appInfo.value?.lastUpdateFormatted || appInfo.value?.update_time;
  if (typeof raw === 'number') {
    const d = new Date(raw * 1000);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }
  return raw || '近期更新';
});

const ratingScore = computed(() => appInfo.value?.score || appInfo.value?.rating || '8.5');
const ratingCount = computed(() => appInfo.value?.votenum || appInfo.value?.score_count || appInfo.value?.rating_count || 1280);
const downloadCount = computed(() => appInfo.value?.downCount || appInfo.value?.downCountFormatted || appInfo.value?.down_count || '10万+');

// 归一化为 5 星制评分 (0.0 ~ 5.0)
const starScore = computed(() => {
  const raw = parseFloat(String(ratingScore.value)) || 0;
  if (raw > 5) return Number((raw / 2).toFixed(1));
  return Number(raw.toFixed(1));
});

// 计算 5 颗星每颗星的类型：full / half / empty
const starList = computed(() => {
  const score = starScore.value;
  const stars: ('full' | 'half' | 'empty')[] = [];
  for (let i = 1; i <= 5; i++) {
    if (score >= i) {
      stars.push('full');
    } else if (score >= i - 0.7) {
      stars.push('half');
    } else {
      stars.push('empty');
    }
  }
  return stars;
});

const appCategory = computed(() => {
  return (
    appInfo.value?.category_title
    || appInfo.value?.category
    || appInfo.value?.tag
    || appInfo.value?.apk_type_title
    || '精选应用'
  );
});

const isCopied = ref(false);
async function copyPackageName() {
  if (!packageName.value) return;
  try {
    await navigator.clipboard.writeText(packageName.value);
    isCopied.value = true;
    showToast('包名已复制到剪贴板');
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch {
    showToast(`包名: ${packageName.value}`);
  }
}

const screenshots = computed<string[]>(() => {
  const raw = appInfo.value?.screenList || appInfo.value?.screenshots || appInfo.value?.screenArr || appInfo.value?.screenshot || appInfo.value?.screen || [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.split(',').filter(Boolean);
  return [];
});

const formattedDescription = computed(() => {
  const text = appInfo.value?.description || appInfo.value?.intro || '暂无应用简介描述。';
  // 应用简介/更新日志是开发者可控内容，必须走安全化渲染（去标签防注入）
  return renderCoolapkRichText(text);
});

const formattedChangeLog = computed(() => {
  const text = appInfo.value?.changeLog || appInfo.value?.changelog || '';
  return renderCoolapkRichText(text);
});

async function fetchAppDetail() {
  if (!packageName.value) return;
  loading.value = true;
  try {
    const res = await CoolapkTauriAPI.getAppDetail(packageName.value);
    const data = res?.data || res;
    if (data) {
      appInfo.value = data;
      if (recommendList.value.length === 0 && !recommendLoading.value) {
        loadRecommendations();
      }
    }
  } catch (err) {
    console.warn('App detail fetch error', err);
  } finally {
    loading.value = false;
  }
}

async function loadDiscussions(reset: boolean = false) {
  if (!packageName.value || discussionsLoading.value) return;
  if (!reset && discussionsNoMore.value) return;

  if (reset) {
    discussionsPage.value = 1;
    discussionsNoMore.value = false;
    discussionFeeds.value = [];
    discussionsError.value = '';
  }

  discussionsLoading.value = true;

  try {
    const res = await CoolapkTauriAPI.getApkFeeds(packageName.value, 'lastupdate_desc', discussionsPage.value);
    const data = res?.data || [];
    const items = Array.isArray(data) ? data : [];

    if (items.length === 0) {
      discussionsNoMore.value = true;
    } else {
      if (reset) {
        discussionFeeds.value = items;
      } else {
        discussionFeeds.value.push(...items);
      }
      discussionsPage.value++;
    }
  } catch (err: any) {
    discussionsError.value = err?.message || '加载讨论失败';
  } finally {
    discussionsLoading.value = false;
  }
}

async function loadApkComments(reset: boolean = false) {
  if (!packageName.value || commentsLoading.value) return;
  if (!reset && commentsNoMore.value) return;

  if (reset) {
    commentsPage.value = 1;
    commentsNoMore.value = false;
    apkComments.value = [];
    commentsError.value = '';
  }

  commentsLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getApkComments(packageName.value, 'dateline_desc', commentsPage.value);
    const data = res?.data || [];
    const items = Array.isArray(data) ? data : [];
    if (items.length === 0) {
      commentsNoMore.value = true;
    } else {
      apkComments.value.push(...items);
      commentsPage.value += 1;
    }
  } catch (err: any) {
    commentsError.value = getErrorMessage(err, '应用评论加载失败');
  } finally {
    commentsLoading.value = false;
  }
}

async function sendAppComment(message: string) {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (!packageName.value || commentSubmitting.value) return;

  commentSubmitting.value = true;
  try {
    // 应用评论写接口要求应用数字 ID；详情接口同时返回 packageName 与 id，不能把包名直接当 id 提交。
    const appId = String(appInfo.value?.id || appInfo.value?.aid || appInfo.value?.entityId || packageName.value);
    await CoolapkTauriAPI.commentApk(appId, message.trim());
    await loadApkComments(true);
    showToast('应用评论发表成功');
  } catch (err: any) {
    showToast(getErrorMessage(err, '应用评论发表失败'), 'error');
  } finally {
    commentSubmitting.value = false;
  }
}

async function loadVersions() {
  if (!packageName.value || versionsLoading.value) return;
  versionsLoading.value = true;
  versionsError.value = '';
  try {
    const res = await CoolapkTauriAPI.getDownloadVersionList(packageName.value);
    const data = res?.data || [];
    versionsList.value = Array.isArray(data) ? data : [];
  } catch (err: any) {
    versionsError.value = err?.message || '加载版本历史失败';
  } finally {
    versionsLoading.value = false;
  }
}

async function loadDiscoverers(reset: boolean = false) {
  if (!packageName.value || discoverersLoading.value) return;
  if (!reset && discoverersNoMore.value) return;

  if (reset) {
    discoverersPage.value = 1;
    discoverersNoMore.value = false;
    discoverersList.value = [];
    discoverersError.value = '';
  }

  discoverersLoading.value = true;

  try {
    const res = await CoolapkTauriAPI.getApkDiscoverers(packageName.value, discoverersPage.value);
    const data = res?.data || [];
    const items = Array.isArray(data) ? data : [];

    if (items.length === 0) {
      discoverersNoMore.value = true;
    } else {
      if (reset) {
        discoverersList.value = items;
      } else {
        discoverersList.value.push(...items);
      }
      discoverersPage.value++;
    }
  } catch (err: any) {
    discoverersError.value = err?.message || '加载发现者失败';
  } finally {
    discoverersLoading.value = false;
  }
}

async function loadGifts(reset: boolean = false) {
  if (!packageName.value || giftsLoading.value) return;
  if (!reset && giftsNoMore.value) return;

  if (reset) {
    giftsPage.value = 1;
    giftsNoMore.value = false;
    giftsList.value = [];
    giftsError.value = '';
  }

  giftsLoading.value = true;

  try {
    const res = await CoolapkTauriAPI.getApkGiftList(packageName.value, giftsPage.value);
    const data = res?.data || [];
    const items = Array.isArray(data) ? data : [];

    if (items.length === 0) {
      giftsNoMore.value = true;
    } else {
      if (reset) {
        giftsList.value = items;
      } else {
        giftsList.value.push(...items);
      }
      giftsPage.value++;
    }
  } catch (err: any) {
    giftsError.value = err?.message || '加载礼包失败';
  } finally {
    giftsLoading.value = false;
  }
}

async function loadRelatedApps(reset: boolean = false) {
  if (!packageName.value || relatedAppsLoading.value) return;
  if (!reset && relatedAppsNoMore.value) return;

  if (reset) {
    relatedAppsPage.value = 1;
    relatedAppsNoMore.value = false;
    relatedAppsList.value = [];
    relatedAppsError.value = '';
  }

  relatedAppsLoading.value = true;

  try {
    const res = await CoolapkTauriAPI.getApkRelatedApps(packageName.value, relatedAppsPage.value);
    const data = res?.data || [];
    const items = Array.isArray(data) ? data : [];

    if (items.length === 0) {
      relatedAppsNoMore.value = true;
    } else {
      if (reset) {
        relatedAppsList.value = items;
      } else {
        relatedAppsList.value.push(...items);
      }
      relatedAppsPage.value++;
    }
  } catch (err: any) {
    relatedAppsError.value = err?.message || '加载相关应用失败';
  } finally {
    relatedAppsLoading.value = false;
  }
}

async function loadRelatedAlbums(reset: boolean = false) {
  if (!packageName.value || relatedAlbumsLoading.value) return;
  if (!reset && relatedAlbumsNoMore.value) return;

  if (reset) {
    relatedAlbumsPage.value = 1;
    relatedAlbumsNoMore.value = false;
    relatedAlbumsList.value = [];
    relatedAlbumsError.value = '';
  }

  relatedAlbumsLoading.value = true;

  try {
    const res = await CoolapkTauriAPI.searchAlbums(packageName.value, relatedAlbumsPage.value);
    const data = res?.data || [];
    const items = Array.isArray(data) ? data : [];

    if (items.length === 0) {
      relatedAlbumsNoMore.value = true;
    } else {
      if (reset) {
        relatedAlbumsList.value = items;
      } else {
        relatedAlbumsList.value.push(...items);
      }
      relatedAlbumsPage.value++;
    }
  } catch (err: any) {
    relatedAlbumsError.value = err?.message || '加载相关专辑失败';
  } finally {
    relatedAlbumsLoading.value = false;
  }
}

async function loadRecommendations() {
  if (recommendLoading.value) return;
  recommendLoading.value = true;
  recommendError.value = '';
  try {
    const res = await CoolapkTauriAPI.getApkRecommendList('1', '推荐', 1);
    const data = res?.data || [];
    const items = Array.isArray(data) ? data : [];
    recommendList.value = items.filter((item: any) => item.packageName || item.title || item.appName);
  } catch (err: any) {
    recommendError.value = err?.message || '加载推荐失败';
  } finally {
    recommendLoading.value = false;
  }
}

function selectDetailTab(key: string) {
  activeDetailTab.value = key;
  if (key === 'discussions' && discussionFeeds.value.length === 0) {
    loadDiscussions(true);
  } else if (key === 'versions' && versionsList.value.length === 0) {
    loadVersions();
  } else if (key === 'discoverers' && discoverersList.value.length === 0) {
    loadDiscoverers(true);
  } else if (key === 'gifts' && giftsList.value.length === 0) {
    loadGifts(true);
  } else if (key === 'comments' && apkComments.value.length === 0) {
    loadApkComments(true);
  } else if (key === 'relatedApps' && relatedAppsList.value.length === 0) {
    loadRelatedApps(true);
  } else if (key === 'relatedAlbums' && relatedAlbumsList.value.length === 0) {
    loadRelatedAlbums(true);
  }
}

function handlePageScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
    if (activeDetailTab.value === 'discussions') {
      if (!discussionsLoading.value && !discussionsNoMore.value) {
        loadDiscussions(false);
      }
    } else if (activeDetailTab.value === 'discoverers') {
      if (!discoverersLoading.value && !discoverersNoMore.value) {
        loadDiscoverers(false);
      }
    } else if (activeDetailTab.value === 'gifts') {
      if (!giftsLoading.value && !giftsNoMore.value) {
        loadGifts(false);
      }
    } else if (activeDetailTab.value === 'comments') {
      if (!commentsLoading.value && !commentsNoMore.value) {
        loadApkComments(false);
      }
    } else if (activeDetailTab.value === 'relatedApps') {
      if (!relatedAppsLoading.value && !relatedAppsNoMore.value) {
        loadRelatedApps(false);
      }
    } else if (activeDetailTab.value === 'relatedAlbums') {
      if (!relatedAlbumsLoading.value && !relatedAlbumsNoMore.value) {
        loadRelatedAlbums(false);
      }
    }
  }
}

function openViewer(idx: number) {
  if (screenshots.value.length > 0) {
    appStore.openImageViewer(screenshots.value, idx);
  }
}

function extractUrl(data: any, keys: string[]): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return '';
  for (const key of keys) {
    const v = data[key];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

async function handleDownload() {
  if (!packageName.value || downloadLoading.value) return;
  downloadLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getApkUrl(packageName.value);
    const data = res?.data ?? res;
    const url = extractUrl(data, ['url', 'downloadUrl', 'download_url', 'apkDownloadUrl', 'apk_download_url']);
    if (!url) {
      alert('获取下载链接失败：接口未返回有效链接');
      return;
    }
    CoolapkTauriAPI.openUrl(url, 'system');
  } catch (err: any) {
    alert(`获取下载链接失败：${err?.message || '请检查网络或登录状态'}`);
  } finally {
    downloadLoading.value = false;
  }
}

async function handleShowQr() {
  if (!packageName.value || qrLoading.value) return;
  qrLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.getApkQr(packageName.value);
    const data = res?.data ?? res;
    const imgUrl = extractUrl(data, ['url', 'qrUrl', 'qr_url', 'imageUrl', 'image_url', 'img', 'image']);
    if (!imgUrl) {
      alert('获取二维码失败：接口未返回图片链接');
      return;
    }
    qrImageUrl.value = imgUrl;
  } catch (err: any) {
    alert(`获取二维码失败：${err?.message || '请检查网络或登录状态'}`);
  } finally {
    qrLoading.value = false;
  }
}

function closeQrModal() {
  qrImageUrl.value = '';
}

function formatUpdateResult(data: any): string {
  if (data == null) return '已是最新版本';

  let hasUpdate = false;
  let firstItem: any = data;
  if (Array.isArray(data)) {
    hasUpdate = data.length > 0;
    firstItem = data[0];
  } else if (typeof data === 'object') {
    hasUpdate = !!(data.hasUpdate || data.has_update);
    if (data.versions && Array.isArray(data.versions) && data.versions.length > 0) {
      hasUpdate = true;
      firstItem = data.versions[0];
    }
  }

  if (!hasUpdate) return '已是最新版本';

  const versionName = firstItem?.versionName || firstItem?.version_name || firstItem?.apkversionname || firstItem?.version || '未知版本';
  const size = firstItem?.size || firstItem?.apksize || firstItem?.apkSizeFormatted || '';
  const changeLog = firstItem?.changeLog || firstItem?.changelog || firstItem?.message || '';
  let text = `发现新版本：${versionName}`;
  if (size) text += `（${size}）`;
  if (changeLog) text += `\n更新日志：${changeLog}`;
  return text;
}

async function handleCheckUpdate() {
  if (!packageName.value || updateLoading.value) return;
  updateLoading.value = true;
  try {
    const res = await CoolapkTauriAPI.checkUpdate(packageName.value);
    const data = res?.data ?? res;
    alert(formatUpdateResult(data));
  } catch (err: any) {
    alert(`检查更新失败：${err?.message || '请检查网络或登录状态'}`);
  } finally {
    updateLoading.value = false;
  }
}

async function toggleFavorite() {
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (favoriteLoading.value || !packageName.value) return;

  const prev = isFavorited.value;
  isFavorited.value = !prev;
  favoriteLoading.value = true;

  try {
    if (prev) {
      await CoolapkTauriAPI.unfavoriteApk(packageName.value);
    } else {
      await CoolapkTauriAPI.favoriteApk(packageName.value);
    }
  } catch (err: any) {
    isFavorited.value = prev;
    console.error('Toggle favorite failed', err);
    alert(`收藏操作失败：${err?.message || '请检查网络或登录状态'}`);
  } finally {
    favoriteLoading.value = false;
  }
}

function toggleFollow() {
  isFollowed.value = !isFollowed.value;
}

function versionName(ver: any): string {
  return ver?.versionName || ver?.version_name || ver?.apkversionname || ver?.version || '未知版本';
}

function versionSize(ver: any): string {
  return ver?.versionSize || ver?.apkSizeFormatted || ver?.apksize || ver?.size || '';
}

function versionDate(ver: any): string {
  const raw = ver?.versionDate || ver?.version_date || ver?.updateTime || ver?.lastupdate;
  if (typeof raw === 'number') {
    const d = new Date(raw * 1000);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }
  return raw || '';
}

function versionLog(ver: any): string {
  return ver?.changeLog || ver?.changelog || ver?.title || ver?.message || '';
}

function recommendIcon(app: any): string {
  return app?.logo || app?.apkRomIcon || app?.icon || app?.pic || 'https://c2.coolapk.com/coolmarket/apk/default_avatar.png';
}

function recommendName(app: any): string {
  return app?.appName || app?.title || app?.shorttitle || '推荐应用';
}

function recommendMeta(app: any): string {
  return app?.apkSizeFormatted || app?.apkSize || app?.size || app?.downCountFormatted || app?.downCount || '';
}

function goApp(app: any) {
  const pkg = app?.packageName || app?.id || app?.appId;
  if (pkg) {
    router.push(`/app/${pkg}`);
  }
}

function goUser(user: any) {
  const uid = user?.uid || user?.uidStr;
  if (uid) {
    router.push(`/user/${uid}`);
  }
}

function giftLogo(gift: any): string {
  return gift?.logo || gift?.pic || gift?.icon || gift?.giftPic || '';
}

function giftTitle(gift: any): string {
  return gift?.title || gift?.giftName || gift?.name || '酷安礼包';
}

function giftDesc(gift: any): string {
  return gift?.description || gift?.desc || gift?.content || '';
}

function giftLink(gift: any): string {
  return gift?.url || gift?.link || gift?.jumpUrl || gift?.apkUrl || '';
}

function handleGiftClaim(gift: any) {
  const link = giftLink(gift);
  if (!link) return;
  CoolapkTauriAPI.openUrl(link, 'system');
}

// === 权限（来自应用详情接口返回的 permissions 字段，官方客户端由系统 PackageManager 本地解析，桌面端直接展示原始列表） ===
const permissionEntries = computed<any[]>(() => {
  const raw = appInfo.value?.permissions || appInfo.value?.permissionList || [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
  return [];
});

function permissionName(perm: any): string {
  if (typeof perm === 'string') return perm;
  if (perm && typeof perm === 'object') {
    return perm.label || perm.name || perm.permissionName || perm.sourceString || perm.title || '';
  }
  return '';
}

function permissionDesc(perm: any): string {
  if (perm && typeof perm === 'object') {
    return perm.description || perm.desc || perm.subTitle || '';
  }
  return '';
}

// === 相关专辑辅助 ===
function albumIdOf(item: any): string {
  return String(item?.id ?? item?.albumId ?? item?.album_id ?? item?.entityId ?? '');
}

function albumCoverOf(item: any): string {
  return item?.pic || item?.cover || item?.logo || item?.icon || '';
}

function albumTitleOf(item: any): string {
  return item?.title || item?.name || item?.albumName || '未命名专辑';
}

function albumAuthorOf(item: any): string {
  return item?.username || item?.userInfo?.username || '';
}

function albumAppCountOf(item: any): number {
  const n = Number(item?.apkCount ?? item?.apk_count ?? item?.apknum ?? 0);
  return isNaN(n) ? 0 : n;
}

function albumDescOf(item: any): string {
  return item?.description || item?.intro || '';
}

function formatAlbumCount(num: number): string {
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

function goAlbum(item: any) {
  const id = albumIdOf(item);
  if (id) router.push(`/album/${id}`);
}

onMounted(() => fetchAppDetail());
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 820px;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
}

.detail-nav-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.nav-app-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
}

.app-detail-content {

  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.app-header-card {
  display: flex;
  align-items: center;
  gap: var(--space-6, 24px);
  background-color: var(--surface);
  border-radius: 18px;
  border: 1px solid var(--border);
  padding: 24px 28px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.app-logo-wrapper {
  flex-shrink: 0;
}

.app-large-icon {
  width: 92px;
  height: 92px;
  border-radius: 20px;
  border: 1px solid var(--border-light);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  display: block;
}

.app-main-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.app-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.version-tag {
  font-size: 12px;
  font-weight: 700;
  color: var(--brand-primary);
  background-color: var(--brand-soft);
  padding: 3px 9px;
  border-radius: 20px;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.package-tag-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-tertiary);
  background-color: var(--surface-hover);
  border: 1px solid var(--border-light);
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  max-width: 220px;
}

.package-tag-btn:hover {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  background-color: var(--brand-soft);
}

.package-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.meta-icon {
  margin-right: 4px;
  color: var(--text-tertiary);
}

.dot-divider {
  color: var(--border-light);
}

/* 核心指标卡片组 */
.metrics-cards-row {
  display: flex;
  align-items: stretch;
  gap: 10px;
  margin-top: 6px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 12px;
  background-color: var(--background);
  border: 1px solid var(--border-light);
  min-width: 100px;
}

.metric-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.rating-score-num {
  font-size: 18px;
  font-weight: 800;
  color: #f59e0b;
  line-height: 1;
}

.stars-track {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.star-unit {
  font-size: 11px;
  color: #f59e0b;
}

.star-empty {
  color: var(--border);
  opacity: 0.7;
}

.metric-big-num {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.metric-tag-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-icon {
  font-size: 11px;
}

.metric-card-sub {
  font-size: 11px;
  color: var(--text-tertiary);
}

/* 右侧紧凑分层操作区 */
.header-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 190px;
  flex-shrink: 0;
}

.primary-download-btn {
  width: 100%;
  font-weight: 700 !important;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25) !important;
}

.secondary-actions-row,
.utility-actions-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.action-half-btn {
  width: 100%;
  font-size: 12px !important;
  padding: 6px 4px !important;
  justify-content: center !important;
}

@media (max-width: 860px) {
  .app-header-card {
    flex-direction: column;
    align-items: stretch;
  }
  .header-actions {
    width: 100%;
    margin-top: 12px;
  }
}

.qr-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
}

.qr-image {
  width: 240px;
  height: 240px;
  border-radius: var(--radius-control);
  border: 1px solid var(--border-light);
  background-color: var(--background);
}

.qr-hint {
  font-size: var(--font-size-sub);
  color: var(--text-secondary);
  margin: 0;
}

.detail-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  min-height: 42px;
  padding: 0 var(--space-2);
  border-bottom: 1px solid var(--border);
}

.detail-tab-item {
  position: relative;
  height: 42px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.detail-tab-item:hover,
.detail-tab-item.is-active {
  color: var(--brand-primary);
}

.detail-tab-item.is-active {
  font-weight: var(--font-weight-semibold);
}

.tab-indicator {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 3px;
  border-radius: var(--radius-pill);
  background: var(--brand-primary);
}

.section-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}

.section-title .icon {
  color: var(--brand-primary);
}

.screenshot-carousel {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

.screenshot-item {
  width: 160px;
  height: 280px;
  border-radius: var(--radius-control);
  overflow: hidden;
  border: 1px solid var(--border-light);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform var(--duration-fast);
}

.screenshot-item:hover {
  transform: scale(1.02);
}

.screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.description-body,
.changelog-body {
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-secondary);
}

.recommend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-3);
}

.recommend-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.recommend-card:hover {
  border-color: var(--brand-primary);
  background-color: var(--surface-hover);
  transform: translateY(-2px);
}

.recommend-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
  flex-shrink: 0;
}

.recommend-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recommend-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recommend-meta {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.versions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.version-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}

.version-card-main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.version-name {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--brand-primary);
}

.version-size {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
  background-color: var(--surface-hover);
  padding: 1px 6px;
  border-radius: var(--radius-pill);
}

.version-date {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.version-log {
  font-size: var(--font-size-sub);
  line-height: var(--line-height-body);
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.discoverer-list,
.gift-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.discoverer-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.discoverer-item:hover {
  border-color: var(--brand-primary);
  background-color: var(--surface-hover);
}

.discoverer-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-light);
  flex-shrink: 0;
}

.discoverer-name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discoverer-arrow {
  color: var(--text-tertiary);
  font-size: 12px;
}

.gift-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}

.gift-logo {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-control);
  border: 1px solid var(--border-light);
  flex-shrink: 0;
}

.gift-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.gift-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.gift-desc {
  font-size: var(--font-size-caption);
  line-height: var(--line-height-sub);
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.gift-btn {
  flex-shrink: 0;
  border: none;
  padding: 6px 14px;
  height: 32px;
  border-radius: var(--radius-pill);
  background-color: var(--brand-primary);
  color: var(--text-inverse);
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.gift-btn:hover:not(.is-disabled) {
  background-color: var(--brand-hover);
}

.gift-btn.is-disabled {
  background-color: var(--surface-hover);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.related-apps-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.permission-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.permission-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-control);
  background-color: var(--background);
}

.permission-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--brand-primary);
}

.permission-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.permission-name {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  word-break: break-all;
}

.permission-desc {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
}

.related-albums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: var(--space-4);
  width: 100%;
}

.album-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
}

.album-card:hover {
  border-color: var(--brand-primary);
  transform: translateY(-2px);
}

.album-cover-wrapper {
  width: 100%;
  aspect-ratio: 4 / 3;
  background-color: var(--background);
  border-bottom: 1px solid var(--border-light);
}

.album-cover {
  width: 100%;
  height: 100%;
}

.album-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  color: var(--brand-primary);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.2));
}

.album-card-info {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.album-card-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.album-card-author {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
}

.album-card-author i {
  font-size: 11px;
  color: var(--text-tertiary);
}

.album-author-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-card-meta {
  display: flex;
  align-items: center;
}

.album-count {
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  color: var(--brand-primary);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.album-card-desc {
  margin: 0;
  font-size: var(--font-size-caption);
  line-height: var(--line-height-caption);
  color: var(--text-tertiary);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.pagination-footer {
  display: flex;
  justify-content: center;
  padding: var(--space-2) 0;
}

.no-more {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}
</style>
