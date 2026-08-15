<template>
  <div class="user-page-wrapper custom-scrollbar" @scroll="handleUserPageScroll">
    <!-- 全屏加载阻断 -->
    <div v-if="loadingProfile && !profile" class="loading-wrapper-full">
      <LoadingState text="正在获取酷友个人主页..." />
    </div>

    <!-- 用户资料不存在防护 -->
    <div v-else-if="!profile" class="empty-wrapper-full">
      <EmptyState :title="profileError || '未找到酷友空间'" description="该用户不存在或个人主页暂不可访问" />
      <button class="profile-retry-button" type="button" @click="fetchUserProfile">重试</button>
    </div>

    <!-- 正常主卡片与全套 Tab 页面 -->
    <template v-else>
      <div class="app-style-user-card">
        <!-- 极高大图背景 + 沉浸式透明遮罩 -->
        <div class="banner-cover-area">
          <AppImage v-if="profile.cover" :src="profile.cover" image-class="banner-cover-img" />
          <div class="banner-cover-placeholder" v-else></div>
          <div class="banner-cover-gradient"></div>

          <!-- 悬浮顶部交互栏；页面导航统一放在全局顶栏。 -->
          <div class="banner-top-bar">
            <div class="top-bar-right">
              <button class="icon-circle-btn" title="搜索" @click="router.push('/search')">
                <i class="fas fa-search"></i>
              </button>
              <button class="icon-circle-btn" title="更多设置" @click="openProfileMenu">
                <i class="fas fa-ellipsis-v"></i>
              </button>
            </div>
          </div>

          <!-- 沉浸式大图上方的 Hero 全量内容区 -->
          <div class="banner-hero-content">
            <!-- 1. 头像与行动按钮组 -->
            <div class="banner-avatar-row">
              <AppAvatar
                :src="profile.userAvatar || getAvatarUrlByUid(profile.uid)" 
                :plugin-url="profile.avatar_plugin_url"
                size="xl" 
                class="app-hero-avatar" 
                @click="showAvatarPreview"
              />
              <div class="banner-actions">
                <template v-if="isSelfUser">
                  <button class="app-btn btn-secondary-glass" @click="router.push('/settings/account')">
                    <i class="fas fa-edit"></i> 编辑资料
                  </button>
                  <button class="app-btn btn-icon-glass" title="二维码" @click="showUserQr">
                    <i class="fas fa-qrcode"></i>
                  </button>
                </template>
                <template v-else>
                  <button 
                    :class="['app-btn', isFlag(profile.isFollow) ? 'btn-following' : 'btn-follow-primary']"
                    :disabled="followLoading"
                    @click="toggleFollow"
                  >
                    <i :class="isFlag(profile.isFollow) ? 'fas fa-check' : 'fas fa-plus'"></i>
                    {{ isFlag(profile.isFollow) ? (isFlag(profile.isSpecialFollow) ? '特别关注' : '已关注') : '关注' }}
                  </button>
                  <button class="app-btn btn-icon-glass" @click="sendMessage" title="私信">
                    <i class="far fa-envelope"></i>
                  </button>
                  <button class="app-btn btn-icon-glass" @click="openProfileMenu" title="更多操作">
                    <i class="fas fa-ellipsis-h"></i>
                  </button>
                </template>
              </div>
            </div>

            <!-- 2. 用户信息包（全白字半透明沉浸展示） -->
            <div class="user-details-area-immersive">
              <!-- 名字与等级 -->
              <div class="username-title-row">
                <h1 class="app-username">{{ profile.username }}</h1>
                <span class="app-user-level" v-if="profile.level">Lv.{{ profile.level }}</span>
                <span v-if="profile.isDeveloper || profile.verify_title" class="app-verify-tag">
                  <i class="fas fa-check-circle"></i> {{ profile.verify_title || '酷安认证开发者' }}
                </span>
              </div>

              <!-- 个性签名 -->
              <p class="app-user-bio">
                <i class="fas fa-pen bio-icon"></i>
                {{ profile.bio || '点击设置我的签名' }}
              </p>

              <!-- 获赞·关注·粉丝 高对比度白字行 -->
              <div class="app-stats-row">
                <button class="stat-cell stat-cell-button" type="button" @click="profileDetailsOpen = true">
                  <span class="num">{{ getLikeCount(profile) }}</span>
                  <span class="label">获赞</span>
                </button>
                <button class="stat-cell stat-cell-button" type="button" @click="openRelations('follow')">
                  <span class="num">{{ getFollowCount(profile) }}</span>
                  <span class="label">关注</span>
                </button>
                <button class="stat-cell stat-cell-button" type="button" @click="openRelations('fans')">
                  <span class="num">{{ getFansCount(profile) }}</span>
                  <span class="label">粉丝</span>
                </button>
              </div>

              <!-- 活跃状态与属性 Chip 标签组（点击可直接打开详细档案） -->
              <div class="app-chips-row">
                <span class="chip-item chip-online" v-if="profile.logintime" @click="profileDetailsOpen = true">
                  <span class="chip-status-dot"></span>
                  {{ formatLoginTime(profile.logintime) }}活跃
                </span>
                <span class="chip-item chip-glass" v-if="getGenderLabel(profile) || getGenderAgeTag(profile)" @click="profileDetailsOpen = true">
                  <i :class="getGenderIcon(profile)"></i>
                  {{ getGenderAgeTag(profile) || getGenderLabel(profile) }}
                </span>
                <span class="chip-item chip-glass" v-if="getAstroTag(profile)" @click="profileDetailsOpen = true">
                  <i class="fas fa-meteor chip-icon-astro"></i>
                  {{ getAstroTag(profile) }}
                </span>
                <span class="chip-item chip-glass" v-if="getCityTag(profile)" @click="profileDetailsOpen = true">
                  <i class="fas fa-location-dot chip-icon-location"></i>
                  {{ getCityTag(profile) }}
                </span>
                <span class="chip-item chip-glass" v-if="getIpLocationTag(profile)" @click="profileDetailsOpen = true">
                  <i class="fas fa-network-wired chip-icon-location"></i>
                  IP属地 {{ getIpLocationTag(profile) }}
                </span>
                <span class="chip-item chip-glass" v-if="getRegDaysTag(profile)" @click="profileDetailsOpen = true">
                  <i class="fas fa-calendar-check chip-icon-astro"></i>
                  {{ getRegDaysTag(profile) }}
                </span>
                <span class="chip-item chip-glass chip-verify" v-if="getVerifyBadgeTag(profile)" @click="profileDetailsOpen = true">
                  <i class="fas fa-certificate chip-icon-verify"></i>
                  {{ getVerifyBadgeTag(profile) }}
                </span>
              </div>

              <!-- 他的装备 / 我的装备 / 商品店铺 并排入口条 -->
              <div class="equipment-entries-row">
                <div class="equipment-entry-bar-glass" @click="openEquipment">
                  <div class="equipment-left">
                    <i class="fas fa-laptop-code equipment-icon"></i>
                    <span class="equipment-title">{{ isSelfUser ? '我的装备' : '他的装备' }}</span>
                  </div>
                  <div class="equipment-right">
                    <span class="equipment-count">{{ profile.product_owner_count || 0 }}个装备</span>
                    <i class="fas fa-chevron-right arrow-icon"></i>
                  </div>
                </div>
                <div v-if="Number(profile.goods_count || profile.goodsCount || 0) > 0 || Number(profile.goods_store_status || 0) === 1" class="equipment-entry-bar-glass" @click="openGoodsStore">
                  <div class="equipment-left">
                    <i class="fas fa-store equipment-icon"></i>
                    <span class="equipment-title">商品店铺</span>
                  </div>
                  <div class="equipment-right">
                    <span class="equipment-count">{{ profile.goods_count || profile.goodsCount || 0 }}件商品</span>
                    <i class="fas fa-chevron-right arrow-icon"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- App 官方全系 Tab 栏 -->
        <div class="app-tab-navigation">
          <div ref="tabScrollContainer" class="tab-scroll-container">
            <button 
              v-for="tab in tabs" 
              :key="tab.key"
              :class="['app-tab-item', { 'active': activeTab === tab.key }]"
              @click="activeTab = tab.key"
            >
              <span class="tab-text">{{ tab.label }}</span>
              <span v-if="activeTab === tab.key" class="tab-indicator"></span>
            </button>
          </div>
        </div>
      </div>

    <!-- 各 Tab 内容展示区 -->
    <div class="tab-content-container">
      <div v-if="activeTab !== 'home' && activeTabState.error" class="tab-content-toolbar">
        <span class="tab-content-status">加载失败</span>
      </div>
      <div v-if="activeTab !== 'home' && activeTabState.error && !userFeeds.length" class="tab-error-state">
        <p>{{ activeTabState.error }}</p>
        <button class="tab-retry-button" type="button" @click="retryActiveTab">重试</button>
      </div>

      <!-- 1. 主页：完全按服务端 homeTabCardRows 的顺序和 Entity 渲染，支持热门动态向下无限滚动加载 -->
      <div v-if="activeTab === 'home'" class="home-aggregated-view">
        <UserHomeCardRows
          v-if="homeTabCardRows.length"
          :rows="homeTabCardRows"
          :extra-feeds="homeExtraFeeds"
          :uid="effectiveUid"
          :is-self="isSelfUser"
          @switch-tab="activeTab = $event"
          @deleted="handleFeedDeleted"
        />
        <div v-else class="empty-wrapper"><EmptyState title="暂无主页卡片" /></div>
      </div>

      <!-- 2. 「点评」视图 (带机主评分、多维参数打分及二级筛选) -->
      <div v-else-if="activeTab === 'rating'" class="rating-tab-view">
        <!-- 二级筛选分类条 (全部 / 只看应用 / 只看数码) -->
        <div class="sub-filter-row">
          <span class="filter-label">筛选</span>
          <div class="filter-pills">
            <button 
              v-for="f in ratingFilters" 
              :key="f.key"
              :class="['filter-pill', { 'active': activeRatingFilter === f.key }]"
              @click="activeRatingFilter = f.key"
            >
              {{ f.label }}
            </button>
          </div>
        </div>

        <div v-if="loadingFeeds" class="loading-wrapper">
          <LoadingState text="正在获取酷友点评..." />
        </div>
        <div v-else-if="userFeeds.length === 0" class="empty-wrapper">
          <EmptyState title="暂无点评记录" />
        </div>
        <div v-else class="feed-list">
          <UserEntityCard v-for="(item, index) in userFeeds" :key="item.id || item.entityId || index" :entity="item" tab="rating" @deleted="handleFeedDeleted" />
        </div>
      </div>

      <!-- 3. 常规动态/回复/图文/二手 Tab 视图 -->
      <div v-else class="standard-feed-tab-view">
        <div v-if="loadingFeeds" class="loading-wrapper">
          <LoadingState text="正在加载内容..." />
        </div>
        <div v-else-if="userFeeds.length === 0" class="empty-wrapper">
          <EmptyState title="暂无相关内容" />
        </div>
        <div v-else class="feed-list">
          <UserEntityCard v-for="(item, index) in userFeeds" :key="item.id || item.entityId || index" :entity="item" :tab="activeTab" @deleted="handleFeedDeleted" />
        </div>
      </div>

      <!-- 底部无限加载更多指示器 -->
      <div v-if="userFeedsLoadingMore" class="loading-more-footer">
        <i class="fas fa-circle-notch fa-spin"></i> 正在读取下一页动态...
      </div>
      <div v-else-if="userFeedsNoMore && (userFeeds.length > 5 || (activeTab === 'home' && homeExtraFeeds.length > 0))" class="no-more-footer">
        已无更多动态内容
      </div>
    </div>
  </template>

  <!-- 1. 用户二维码卡片 -->
  <AppDialog :is-open="Boolean(qrImageUrl)" title="用户二维码" :width="360" @close="qrImageUrl = ''">
    <div class="coolapk-qr-card" v-if="profile">
      <div class="qr-header">
        <AppAvatar :src="profile.userAvatar || getAvatarUrlByUid(profile.uid)" size="md" />
        <div class="qr-header-text">
          <span class="qr-username">{{ profile.username || '酷友' }}</span>
          <span class="qr-hint">扫一扫，在手机酷安打开主页</span>
        </div>
      </div>
      <div class="qr-image-frame">
        <LoadingState v-if="qrLoading" text="正在生成二维码..." />
        <AppImage v-else-if="qrImageUrl" :src="qrImageUrl" alt="用户二维码" image-class="user-qr-image" />
      </div>
      <div class="qr-footer-actions">
        <button type="button" class="btn-copy-link" @click="copyShareLink">
          <i class="fas fa-link"></i> 复制主页链接
        </button>
      </div>
    </div>
  </AppDialog>

  <!-- 2. 用户操作更多菜单 (参考酷安 APK ActionSheet) -->
  <AppDialog :is-open="profileActionOpen" title="用户操作" :width="400" @close="profileActionOpen = false">
    <div class="user-action-sheet" v-if="profile">
      <!-- 顶部用户信息概要条 -->
      <div class="action-sheet-user-card">
        <AppAvatar
          :src="profile.userAvatar || getAvatarUrlByUid(profile.uid)"
          :plugin-url="profile.avatar_plugin_url"
          size="md"
        />
        <div class="user-info-text">
          <div class="name-row">
            <span class="user-name">{{ profile.username || '酷友' }}</span>
            <span class="app-user-level" v-if="profile.level">Lv.{{ profile.level }}</span>
          </div>
          <span class="user-subtext">UID: {{ profile.uid }} · {{ formatLoginTime(profile.logintime) }}活跃</span>
        </div>
      </div>

      <!-- 操作菜单项组 -->
      <div class="action-menu-card">
        <button
          v-if="!isSelfUser && isFlag(profile?.isFollow)"
          type="button"
          class="action-menu-tile"
          @click="toggleSpecialFollow"
        >
          <div class="tile-left">
            <i :class="[isFlag(profile?.isSpecialFollow) ? 'fas fa-star' : 'far fa-star', 'tile-icon icon-star']"></i>
            <span class="tile-title">{{ isFlag(profile?.isSpecialFollow) ? '取消特别关注' : '设为特别关注' }}</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>

        <button type="button" class="action-menu-tile" @click="openRemarkDialog">
          <div class="tile-left">
            <i class="fas fa-pen tile-icon"></i>
            <span class="tile-title">设置备注名称</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>

        <button type="button" class="action-menu-tile" @click="copyUserInfo">
          <div class="tile-left">
            <i class="fas fa-copy tile-icon"></i>
            <span class="tile-title">复制用户信息</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>

        <button type="button" class="action-menu-tile" @click="shareUserPage">
          <div class="tile-left">
            <i class="fas fa-share-nodes tile-icon"></i>
            <span class="tile-title">分享用户主页</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>

        <button type="button" class="action-menu-tile" @click="profileActionOpen = false; profileDetailsOpen = true">
          <div class="tile-left">
            <i class="fas fa-id-card tile-icon"></i>
            <span class="tile-title">查看详细资料</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>
      </div>

      <!-- 敏感/危险操作组 -->
      <div v-if="!isSelfUser" class="action-menu-card action-menu-card-danger">
        <button
          type="button"
          class="action-menu-tile tile-danger"
          :disabled="blacklistLoading"
          @click="toggleBlacklist"
        >
          <div class="tile-left">
            <i class="fas fa-ban tile-icon"></i>
            <span class="tile-title">{{ isBlacklisted ? '取消拉黑' : '加入黑名单' }}</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>

        <button
          type="button"
          class="action-menu-tile tile-danger"
          :disabled="ignoreLoading"
          @click="toggleIgnore"
        >
          <div class="tile-left">
            <i class="fas fa-eye-slash tile-icon"></i>
            <span class="tile-title">{{ isIgnored ? '取消屏蔽' : '屏蔽该用户' }}</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>

        <button
          v-if="profile?.isFans"
          type="button"
          class="action-menu-tile tile-danger"
          @click="removeFollower"
        >
          <div class="tile-left">
            <i class="fas fa-user-minus tile-icon"></i>
            <span class="tile-title">移除粉丝</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>

        <button
          type="button"
          class="action-menu-tile"
          @click="profileActionOpen = false; router.push('/blacklist')"
        >
          <div class="tile-left">
            <i class="fas fa-list-check tile-icon"></i>
            <span class="tile-title">黑名单与屏蔽管理</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>

        <button type="button" class="action-menu-tile tile-danger" @click="reportUser">
          <div class="tile-left">
            <i class="fas fa-flag tile-icon"></i>
            <span class="tile-title">举报该用户</span>
          </div>
          <i class="fas fa-chevron-right tile-arrow"></i>
        </button>
      </div>
    </div>
  </AppDialog>

  <!-- 3. 设置备注名称弹窗 (参考酷安 APK 原生样式) -->
  <AppDialog :is-open="remarkDialogOpen" title="设置备注名称" :width="400" @close="remarkDialogOpen = false">
    <div class="remark-dialog-container">
      <div class="remark-user-preview" v-if="profile">
        <AppAvatar
          :src="profile.userAvatar || getAvatarUrlByUid(profile.uid)"
          :plugin-url="profile.avatar_plugin_url"
          size="sm"
        />
        <div class="preview-text">
          <span class="original-title">原昵称：</span>
          <span class="original-name">{{ profile.username || '酷友' }}</span>
        </div>
      </div>

      <form class="remark-edit-form" @submit.prevent="saveRemark">
        <div class="remark-input-box">
          <i class="fas fa-pen input-prefix-icon"></i>
          <input
            v-model="remarkName"
            class="remark-native-input"
            maxlength="30"
            placeholder="输入备注名称（留空则清除备注）"
            autofocus
          />
          <button
            v-if="remarkName"
            type="button"
            class="input-clear-btn"
            title="清空"
            @click="remarkName = ''"
          >
            <i class="fas fa-times-circle"></i>
          </button>
          <span class="char-count">{{ remarkName.length }}/30</span>
        </div>

        <div class="dialog-actions-row">
          <button type="button" class="btn-cancel" @click="remarkDialogOpen = false">取消</button>
          <button type="submit" class="btn-submit-primary" :disabled="remarkSaving">
            <i v-if="remarkSaving" class="fas fa-circle-notch fa-spin"></i>
            {{ remarkSaving ? '保存中...' : '确定保存' }}
          </button>
        </div>
      </form>
    </div>
  </AppDialog>

  <!-- 4. 查看详细资料档案弹窗 (参考酷安 APK 个人档案卡片) -->
  <AppDialog :is-open="profileDetailsOpen" title="酷安档案 · 详细资料" :width="460" @close="profileDetailsOpen = false">
    <div class="coolapk-profile-sheet" v-if="profile">
      <!-- 头部概览卡片 -->
      <div class="sheet-hero-card">
        <AppAvatar
          :src="profile.userAvatar || getAvatarUrlByUid(profile.uid)"
          :plugin-url="profile.avatar_plugin_url"
          size="lg"
          class="sheet-avatar"
        />
        <div class="sheet-hero-info">
          <div class="hero-name-row">
            <h3 class="hero-name">{{ profile.username || '酷友' }}</h3>
            <span class="app-user-level" v-if="profile.level">Lv.{{ profile.level }}</span>
          </div>
          <p class="hero-bio">{{ profile.bio || '这家伙很神秘，什么都没写' }}</p>
        </div>
      </div>

      <!-- 档案详情网格分组 -->
      <div class="profile-section-group">
        <div class="section-header">
          <i class="fas fa-id-badge section-icon"></i>
          <span>账号信息</span>
        </div>
        <div class="profile-grid">
          <div class="profile-grid-item" @click="copyUid" title="点击复制 UID">
            <span class="grid-label"><i class="fas fa-fingerprint"></i> UID</span>
            <div class="grid-value-interactive">
              <span class="grid-value font-mono">{{ profile.uid }}</span>
              <i class="far fa-copy copy-icon"></i>
            </div>
          </div>
          <div class="profile-grid-item">
            <span class="grid-label"><i class="fas fa-shield-halved"></i> 账号身份</span>
            <span class="grid-value">{{ profile.verify_title || (profile.isDeveloper ? '认证开发者' : '普通酷友') }}</span>
          </div>
          <div class="profile-grid-item">
            <span class="grid-label"><i class="fas fa-calendar-check"></i> 注册时间</span>
            <span class="grid-value">{{ formatRegisterDate(profile.regdate || profile.regDate) || formatLoginTime(profile.regdate || profile.regDate) || '未公开' }}</span>
          </div>
          <div class="profile-grid-item">
            <span class="grid-label"><i class="fas fa-clock"></i> 最近活跃</span>
            <span class="grid-value highlight-green">{{ formatLoginTime(profile.logintime) }}活跃</span>
          </div>
        </div>
      </div>

      <div class="profile-section-group">
        <div class="section-header">
          <i class="fas fa-user-gear section-icon"></i>
          <span>个人属性</span>
        </div>
        <div class="profile-grid">
          <div class="profile-grid-item">
            <span class="grid-label"><i class="fas fa-venus-mars"></i> 性别</span>
            <span class="grid-value">{{ getGenderLabel(profile) || '未公开' }}</span>
          </div>
          <div class="profile-grid-item">
            <span class="grid-label"><i class="fas fa-cake-candles"></i> 生日 / 年龄</span>
            <span class="grid-value">{{ getBirthdayLabel(profile) || getGenderAgeTag(profile) || '未公开' }}</span>
          </div>
          <div class="profile-grid-item">
            <span class="grid-label"><i class="fas fa-meteor"></i> 星座</span>
            <span class="grid-value">{{ getAstroTag(profile) || '未公开' }}</span>
          </div>
          <div class="profile-grid-item">
            <span class="grid-label"><i class="fas fa-location-dot"></i> 常居地区</span>
            <span class="grid-value">{{ getCityTag(profile) || '未公开' }}</span>
          </div>
          <div class="profile-grid-item profile-grid-item-full">
            <span class="grid-label"><i class="fas fa-network-wired"></i> IP 属地</span>
            <span class="grid-value">{{ getIpLocationTag(profile) || '未公开' }}</span>
          </div>
        </div>
      </div>
    </div>
  </AppDialog>

  <!-- 5. 头像原图预览 -->
  <AppDialog :is-open="avatarPreviewOpen" title="头像原图预览" :width="440" @close="avatarPreviewOpen = false">
    <div class="avatar-preview-lightbox" v-if="profile">
      <div class="avatar-img-container">
        <AppImage :src="getAvatarBigUrl(profile)" alt="用户头像" image-class="avatar-preview-image" />
      </div>
      <div class="avatar-preview-footer">
        <button type="button" class="btn-preview-action" @click="copyAvatarUrl">
          <i class="fas fa-copy"></i> 复制图片链接
        </button>
        <button type="button" class="btn-preview-action" @click="openAvatarInBrowser">
          <i class="fas fa-arrow-up-right-from-square"></i> 在浏览器打开
        </button>
      </div>
    </div>
  </AppDialog>
</div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CoolapkTauriAPI } from '../api/coolapk';
import AppAvatar from '../components/common/AppAvatar.vue';
import AppImage from '../components/common/AppImage.vue';
import UserEntityCard from '../components/user/UserEntityCard.vue';
import UserHomeCardRows from '../components/user/UserHomeCardRows.vue';
import AppDialog from '../components/common/AppDialog.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuthStore } from '../stores/auth';
import { showToast } from '../utils/toast';
import { requestConfirmation } from '../utils/confirm';
import { asUserSpaceProfile, entityKey, normalizeEntityPage } from '../types/userSpace';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const effectiveUid = computed(() => {
  const rUid = (route.params.uid as string) || (route.params.id as string) || '';
  return String((!rUid || rUid === 'me') ? (authStore.user?.uid || '') : rUid);
});

const isSelfUser = computed(() => {
  if (!authStore.user?.uid) return false;
  return String(effectiveUid.value) === String(authStore.user.uid);
});

const loadingProfile = ref(false);
const profileError = ref('');
const followLoading = ref(false);
const qrImageUrl = ref('');
const qrLoading = ref(false);
const profileActionOpen = ref(false);
const profileDetailsOpen = ref(false);
const avatarPreviewOpen = ref(false);
const remarkDialogOpen = ref(false);
const remarkName = ref('');
const remarkSaving = ref(false);
const relationshipActionLoading = ref(false);

const profile = ref<any>(null);
const homeTabCardRows = computed<any[]>(() => (
  Array.isArray(profile.value?.homeTabCardRows) ? profile.value.homeTabCardRows : []
));
const activeTab = ref('home');
const tabScrollContainer = ref<HTMLElement | null>(null);

// APK 的 Tab 标题和顺序来自客户端资源；真正的主页卡片和列表内容仍由接口返回。
// 这里保留 APK 已确认的客户端纯文本映射，并按 UserSpaceV9TabHelper 的权限规则筛选。
const tabs = computed(() => {
  const p = profile.value || {};
  const homeRows = Array.isArray(p.homeTabCardRows) ? p.homeTabCardRows : [];
  const session = (authStore.user || {}) as any;
  const isModerator = Boolean(
    Number(session.adminType || session.admin_type || p.adminType || p.admin_type || 0) > 0 ||
    session.isAdmin || session.isModerator || p.isAdmin || p.isModerator
  );
  const isSelf = isSelfUser.value;
  const optionalTabs = [
    ...(Number(p.albumNum ?? p.album_num ?? 0) > 0
      ? [{ key: 'album', label: '图集' }]
      : []),
    ...(Number(p.apkDevNum ?? p.apk_dev_num ?? 0) > 0 || isFlag(p.isDeveloper)
      ? [{ key: 'developer_apps', label: '开发者应用' }]
      : []),
    ...(Number(p.apkFollowNum ?? p.apk_follow_num ?? 0) > 0
      ? [{ key: 'apk_follow', label: '关注的应用' }]
      : []),
    ...(Number(p.discoveryNum ?? p.discovery_num ?? 0) > 0
      ? [{ key: 'discovery', label: '发现' }]
      : []),
    ...(Number(p.goodsCount ?? p.goods_count ?? 0) > 0 || Number(p.goodsStoreStatus ?? p.goods_store_status ?? 0) === 1
      ? [{ key: 'goods_store', label: '商品店铺' }]
      : [])
  ];

  return [
    ...(homeRows.length > 0 ? [{ key: 'home', label: '主页' }] : []),
    { key: 'feed', label: '动态' },
    ...(isSelf || isModerator ? [{ key: 'reply', label: '回复' }] : []),
    ...(isModerator ? [{ key: 'blacklist', label: '黑名单' }] : []),
    { key: 'rating', label: '评分' },
    { key: 'article', label: '图文' },
    { key: 'qa', label: '问答' },
    { key: 'coolpic', label: '酷图' },
    { key: 'ershou', label: '二手' },
    { key: 'goods', label: '好物' },
    { key: 'goods_rank', label: '好物榜' },
    { key: 'collection', label: '收藏' },
    ...optionalTabs,
    ...(isModerator ? [{ key: 'recycle', label: '回收站' }] : [])
  ];
});

interface UserTabState {
  items: any[];
  page: number;
  firstItem: string;
  lastItem: string;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  loaded: boolean;
}

function createTabState(): UserTabState {
  return { items: [], page: 1, firstItem: '', lastItem: '', hasMore: true, loading: false, loadingMore: false, error: '', loaded: false };
}

const tabStates = reactive<Record<string, UserTabState>>({});

function getTabState(key: string): UserTabState {
  if (!tabStates[key]) tabStates[key] = createTabState();
  return tabStates[key];
}

const activeTabState = computed(() => getTabState(activeTab.value));
const userFeeds = computed(() => activeTabState.value.items);
const homeExtraFeeds = computed(() => getTabState('home').items);
const loadingFeeds = computed(() => activeTabState.value.loading);
const userFeedsLoadingMore = computed(() => activeTabState.value.loadingMore);
const userFeedsNoMore = computed(() => !activeTabState.value.hasMore);

function resetTabStates() {
  for (const key of Object.keys(tabStates)) tabStates[key] = createTabState();
  const homeState = getTabState('home');
  homeState.page = 2;
  homeState.hasMore = true;
  homeState.loaded = true;
}

function selectInitialTab(spaceData: any) {
  const selectedTab = String(spaceData?.selectedTab || '');
  const preferredTab = selectedTab === 'home' || selectedTab === 'feed'
    ? selectedTab
    : (isSelfUser.value || isFlag(spaceData?.isFollow) ? 'feed' : 'home');
  if (tabs.value.some(tab => tab.key === preferredTab)) activeTab.value = preferredTab;
  else if (tabs.value.length > 0) activeTab.value = tabs.value[0].key;
}

const activeRatingFilter = ref('all');
const ratingFilters = [
  { key: 'all', label: '全部' },
  { key: 'app', label: '只看应用' },
  { key: 'digital', label: '只看数码' }
];

const getFollowCount = (p: any) => p?.follow ?? p?.followNum ?? p?.follow_num ?? 0;
const getFansCount = (p: any) => p?.fans ?? p?.fansNum ?? p?.fans_num ?? 0;
const getLikeCount = (p: any) => p?.be_like_num ?? p?.likeNum ?? 0;
const isFlag = (value: unknown) => value === true || value === 1 || value === '1';

const getGenderIcon = (p: any) => {
  const gender = p?.gender ?? p?.userInfo?.gender;
  if (gender === 1 || gender === '1') return 'fas fa-mars gender-mars';
  if (gender === 0 || gender === '0' || gender === 2) return 'fas fa-venus gender-venus';
  return 'fas fa-user';
};

const getGenderLabel = (p: any) => {
  const gender = p?.gender ?? p?.userInfo?.gender;
  if (gender === 1 || gender === '1') return '男';
  if (gender === 0 || gender === '0' || gender === 2) return '女';
  return '';
};

const getGenderAgeTag = (p: any) => {
  const info = p?.userInfo || {};
  const direct = p?.age_group ?? p?.ageGroup ?? p?.age_tag ?? p?.ageTag ?? p?.age_group_tag
    ?? info.age_group ?? info.ageGroup ?? info.age_tag ?? info.ageTag ?? info.age_group_tag;
  if (direct) return String(direct);

  // APK r93.m61204：出生年份按 5 年分组显示，例如 1995 -> 95后。
  const birthYear = Number(p?.birthyear ?? p?.birthYear ?? p?.birth_year
    ?? info.birthyear ?? info.birthYear ?? info.birth_year ?? 0);
  if (!Number.isFinite(birthYear) || birthYear <= 0) return '';
  const cohort = (birthYear - (birthYear % 5)) % 100;
  return `${String(cohort).padStart(2, '0')}后`;
};

const getAstroTag = (p: any) => {
  const info = p?.userInfo || {};
  const direct = p?.astro ?? p?.constellation ?? p?.zodiacSign ?? p?.zodiac_sign
    ?? info.astro ?? info.constellation ?? info.zodiacSign ?? info.zodiac_sign;
  if (direct) return String(direct);

  const month = Number(p?.birthmonth ?? p?.birthMonth ?? p?.birth_month
    ?? info.birthmonth ?? info.birthMonth ?? info.birth_month ?? 0);
  const day = Number(p?.birthday ?? p?.birthDay ?? p?.birth_day
    ?? info.birthday ?? info.birthDay ?? info.birth_day ?? 0);
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const signs = [
    ['摩羯座', 1, 19], ['水瓶座', 2, 18], ['双鱼座', 3, 20], ['白羊座', 4, 19],
    ['金牛座', 5, 20], ['双子座', 6, 21], ['巨蟹座', 7, 22], ['狮子座', 8, 22],
    ['处女座', 9, 22], ['天秤座', 10, 23], ['天蝎座', 11, 22], ['射手座', 12, 21],
  ] as const;
  const index = signs.findIndex(([, endMonth, endDay]) => month === endMonth && day <= endDay);
  return index >= 0 ? signs[index][0] : (month === 12 ? '摩羯座' : signs[month - 1][0]);
};

const getBirthdayLabel = (p: any) => {
  const info = p?.userInfo || {};
  const year = Number(p?.birthyear ?? p?.birthYear ?? p?.birth_year ?? info.birthyear ?? info.birthYear ?? info.birth_year ?? 0);
  const month = Number(p?.birthmonth ?? p?.birthMonth ?? p?.birth_month ?? info.birthmonth ?? info.birthMonth ?? info.birth_month ?? 0);
  const day = Number(p?.birthday ?? p?.birthDay ?? p?.birth_day ?? info.birthday ?? info.birthDay ?? info.birth_day ?? 0);

  if (year > 0 && month > 0 && day > 0) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    return `${year}年${month}月${day}日${age > 0 ? ` (${age}岁)` : ''}`;
  }
  if (year > 0 && month > 0) {
    return `${year}年${month}月`;
  }
  if (year > 0) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    const cohort = (year - (year % 5)) % 100;
    return `${year}年 (${String(cohort).padStart(2, '0')}后${age > 0 ? ` · ${age}岁` : ''})`;
  }
  if (month > 0 && day > 0) {
    return `${month}月${day}日`;
  }
  return '';
};

function hasBirthProfileFields(value: any): boolean {
  const info = value?.userInfo || {};
  return [
    value?.age_group, value?.ageGroup, value?.age_tag, value?.ageTag, value?.age_group_tag,
    value?.zodiacSign, value?.zodiac_sign, value?.astro, value?.constellation,
    value?.birthyear, value?.birthYear, value?.birth_year,
    value?.birthmonth, value?.birthMonth, value?.birth_month,
    value?.birthday, value?.birthDay, value?.birth_day,
    info.age_group, info.ageGroup, info.age_tag, info.ageTag, info.age_group_tag,
    info.zodiacSign, info.zodiac_sign, info.astro, info.constellation,
    info.birthyear, info.birthYear, info.birth_year,
    info.birthmonth, info.birthMonth, info.birth_month,
    info.birthday, info.birthDay, info.birth_day,
  ].some((item) => typeof item === 'number' ? item > 0 : item !== undefined && item !== null && item !== '');
}

async function enrichProfileDetails(uid: string, spaceData: any) {
  try {
    const detailRes: any = await CoolapkTauriAPI.getUserProfile(uid);
    const detail = detailRes?.data;
    if (!detail || String(effectiveUid.value) !== String(uid)) return;
    const spaceUserInfo = (spaceData.userInfo && typeof spaceData.userInfo === 'object') ? spaceData.userInfo : {};
    const detailUserInfo = (detail.userInfo && typeof detail.userInfo === 'object') ? detail.userInfo : {};

    const merged = {
      ...spaceUserInfo,
      ...spaceData,
      ...detail,
      ...detailUserInfo,
      homeTabCardRows: spaceData.homeTabCardRows || detail.homeTabCardRows || [],
      selectedTab: spaceData.selectedTab || detail.selectedTab,
      isFollow: spaceData.isFollow ?? detail.isFollow,
      isFans: spaceData.isFans ?? detail.isFans,
      isSpecialFollow: spaceData.isSpecialFollow ?? detail.isSpecialFollow,
      isInBlackList: spaceData.isInBlackList ?? detail.isInBlackList,
      isInIgnoreList: spaceData.isInIgnoreList ?? detail.isInIgnoreList,
      userInfo: {
        ...spaceUserInfo,
        ...detailUserInfo,
      },
    };
    profile.value = asUserSpaceProfile(merged, uid);
  } catch (e) {
    console.warn('获取用户详细资料失败:', e);
  }
}

const formatRegisterDate = (ts: any) => {
  try {
    if (!ts) return '';
    const num = Number(ts);
    if (isNaN(num) || num <= 0) return '';
    const date = new Date(num * 1000);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  } catch {
    return '';
  }
};

const getRegDaysTag = (p: any) => {
  try {
    const ts = p?.regdate || p?.regDate || p?.userInfo?.regdate || p?.userInfo?.regDate;
    if (!ts) return '';
    const num = Number(ts);
    if (isNaN(num) || num <= 0) return '';
    const diffDays = Math.floor((Date.now() - num * 1000) / (86400 * 1000));
    if (diffDays > 365) {
      const years = (diffDays / 365.25).toFixed(1).replace(/\.0$/, '');
      return `酷龄 ${years}年`;
    }
    if (diffDays > 0) return `酷安第${diffDays}天`;
    return '';
  } catch { return ''; }
};

const getIpLocationTag = (p: any) => {
  const info = p?.userInfo || {};
  const loc = p?.ip_location || p?.ipLocation || p?.ip_region || p?.ipRegion || info.ip_location || info.ipLocation || info.ip_region || info.ipRegion;
  if (loc && String(loc).trim() && String(loc).trim() !== '未知' && String(loc).trim() !== '保密' && String(loc).trim() !== '未公开') {
    return String(loc).trim();
  }
  return '';
};

const getVerifyBadgeTag = (p: any) => {
  const info = p?.userInfo || {};
  const title = p?.verify_title || p?.verifyTitle || p?.verify_show_name || info.verify_title || info.verifyTitle;
  if (title && String(title).trim()) return String(title).trim();
  if (p?.isDeveloper || info.isDeveloper) return '认证开发者';
  return '';
};

const getCityTag = (p: any) => {
  const info = p?.userInfo || {};
  const city = p?.city || p?.province || p?.location || info.city || info.province || info.location;
  if (city && String(city).trim() && String(city).trim() !== '保密' && String(city).trim() !== '未知' && String(city).trim() !== '未公开') {
    return String(city).trim();
  }
  return '';
};

const getAvatarUrlByUid = (uid: any) => {
  try {
    if (!uid) return '';
    const strUid = String(uid);
    const padded = strUid.padStart(9, '0');
    return `https://avatar.coolapk.com/data/${padded.slice(0, 3)}/${padded.slice(3, 5)}/${padded.slice(5, 7)}/${strUid.slice(-2)}_avatar_middle.jpg`;
  } catch { return ''; }
};

const getAvatarBigUrl = (p: any) => {
  const source = String(p?.userAvatar || p?.avatar || getAvatarUrlByUid(p?.uid) || '');
  return source.replace(/_(middle|small)(\.[a-z0-9]+)$/i, '_big$2');
};

const formatLoginTime = (ts: any) => {
  try {
    if (!ts) return '刚刚';
    const numTs = Number(ts);
    if (isNaN(numTs) || numTs <= 0) return '刚刚';
    const date = new Date(numTs * 1000);
    const diffSec = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return '刚刚';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } catch { return '刚刚'; }
};

async function fetchUserProfile() {
  const targetUid = effectiveUid.value;
  if (!targetUid) return;

  loadingProfile.value = true;
  profileError.value = '';
  try {
    let profRes: any;
    try {
      profRes = await CoolapkTauriAPI.getUserSpace(targetUid);
    } catch (spaceError) {
      // 与 APK 的降级路径一致：部分旧账号的 space 被拦截时仍可读取 profile。
      profRes = await CoolapkTauriAPI.getUserProfile(targetUid).catch(() => { throw spaceError; });
    }
    if (profRes && profRes.data) {
      const spaceData = profRes.data;
      profile.value = asUserSpaceProfile(spaceData, targetUid);
      isBlacklisted.value = isFlag(spaceData.isBlackList ?? spaceData.isInBlackList);
      isIgnored.value = isFlag(spaceData.isIgnoreList ?? spaceData.isInIgnoreList);
      selectInitialTab(spaceData);
      await enrichProfileDetails(targetUid, spaceData);
    } else {
      const backupProf = await CoolapkTauriAPI.getUserProfile(targetUid);
      if (backupProf && backupProf.data) {
        profile.value = asUserSpaceProfile(backupProf.data, targetUid);
        selectInitialTab(backupProf.data);
      }
    }
  } catch (err) {
    profileError.value = err instanceof Error ? err.message : '用户资料加载失败';
    console.warn('获取用户信息异常:', err);
  } finally {
    loadingProfile.value = false;
  }
}

async function fetchTabFeeds(isRefresh = true, tabKey = activeTab.value) {
  const targetUid = effectiveUid.value;
  if (!targetUid) return;
  const state = getTabState(tabKey);
  if (state.loading || (!isRefresh && (state.loadingMore || !state.hasMore))) return;

  if (isRefresh) {
    state.page = tabKey === 'home' ? 2 : 1;
    state.firstItem = '';
    state.lastItem = '';
    state.hasMore = true;
    state.error = '';
    state.items = [];
    state.loading = tabKey !== 'home';
  } else {
    state.loadingMore = true;
  }

  try {
    const apiTab = tabKey === 'home' ? 'feed' : (tabKey === 'picture' ? 'coolpic' : tabKey);
    const ratingTarget = activeRatingFilter.value === 'app' ? 'apk' : activeRatingFilter.value === 'digital' ? 'product' : 'all';
    const response: any = await CoolapkTauriAPI.getUserTabData(targetUid, apiTab, state.page, state.firstItem, state.lastItem, ratingTarget);
    const normalized = normalizeEntityPage(response, state.page);
    const existing = new Set(state.items.map((item, index) => entityKey(item, index)));
    const incoming = normalized.items.filter((item, index) => !existing.has(entityKey(item, index)));
    state.items = isRefresh ? normalized.items : [...state.items, ...incoming];
    state.firstItem = normalized.firstItem;
    state.lastItem = normalized.lastItem;
    state.hasMore = normalized.hasMore;
    state.page = Math.max(state.page + 1, normalized.page + 1);
    state.loaded = true;
  } catch (err: any) {
    state.error = err?.message || '内容加载失败，请重试';
    console.warn(`获取用户 ${tabKey} 列表异常:`, err);
  } finally {
    state.loading = false;
    state.loadingMore = false;
  }
}

function handleFeedDeleted(id: string | number) {
  activeTabState.value.items = activeTabState.value.items.filter((item: any) => String(item.id ?? item.entityId) !== String(id));
}

function refreshActiveTab() { void fetchTabFeeds(true); }
function retryActiveTab() { void fetchTabFeeds(true); }

function handleUserPageScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 220) {
    if (!loadingFeeds.value && !userFeedsLoadingMore.value && !userFeedsNoMore.value) {
      void fetchTabFeeds(false);
    }
  }
}

async function toggleFollow() {
  if (!profile.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const previousFollow = isFlag(profile.value.isFollow);
  followLoading.value = true;
  profile.value.isFollow = !previousFollow;
  try {
    if (previousFollow) {
      await CoolapkTauriAPI.unfollowUser(effectiveUid.value);
      profile.value.isSpecialFollow = 0;
    } else {
      await CoolapkTauriAPI.followUser(effectiveUid.value);
    }
  } catch (err: any) {
    profile.value.isFollow = previousFollow;
    alert(err?.message || '关注操作失败，请稍后重试');
  } finally {
    followLoading.value = false;
  }
}

const isBlacklisted = ref(false);
const isIgnored = ref(false);
const blacklistLoading = ref(false);
const ignoreLoading = ref(false);

async function toggleBlacklist() {
  const uid = effectiveUid.value;
  if (!uid || blacklistLoading.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (!isBlacklisted.value) {
    const confirmed = await requestConfirmation({
      title: '拉黑用户',
      message: '确定要拉黑该用户吗？',
      confirmText: '拉黑',
      danger: true
    });
    if (!confirmed) return;
  }
  blacklistLoading.value = true;
  try {
    if (isBlacklisted.value) {
      await CoolapkTauriAPI.removeFromBlackList(uid);
      isBlacklisted.value = false;
      alert('已取消拉黑该用户');
    } else {
      await CoolapkTauriAPI.addToBlackList(uid);
      isBlacklisted.value = true;
      alert('已成功拉黑该用户');
    }
  } catch (err: any) {
    alert(err?.message || '拉黑操作失败，请稍后重试');
  } finally {
    blacklistLoading.value = false;
  }
}

async function toggleIgnore() {
  const uid = effectiveUid.value;
  if (!uid || ignoreLoading.value) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  if (!isIgnored.value) {
    const confirmed = await requestConfirmation({
      title: '屏蔽用户',
      message: '确定要屏蔽该用户吗？',
      confirmText: '屏蔽',
      danger: true
    });
    if (!confirmed) return;
  }
  ignoreLoading.value = true;
  try {
    if (isIgnored.value) {
      await CoolapkTauriAPI.removeFromIgnoreList(uid);
      isIgnored.value = false;
      alert('已取消屏蔽该用户');
    } else {
      await CoolapkTauriAPI.addToIgnoreList(uid);
      isIgnored.value = true;
      alert('已成功屏蔽该用户');
    }
  } catch (err: any) {
    alert(err?.message || '屏蔽操作失败，请稍后重试');
  } finally {
    ignoreLoading.value = false;
  }
}

function sendMessage() {
  if (effectiveUid.value) {
    router.push(`/messages?uid=${effectiveUid.value}`);
  }
}

async function showUserQr() {
  const uid = effectiveUid.value;
  if (!uid || qrLoading.value) return;
  qrLoading.value = true;
  try {
    const res: any = await CoolapkTauriAPI.getUserQrImage(uid);
    const data = res?.data ?? res;
    const image = typeof data === 'string'
      ? data
      : data?.image || data?.imageUrl || data?.image_url || data?.url || '';
    if (!image) throw new Error('接口未返回二维码图片');
    qrImageUrl.value = image;
  } catch (err: any) {
    alert(`获取二维码失败：${err?.message || '请检查网络或登录状态'}`);
  } finally {
    qrLoading.value = false;
  }
}

function openProfileMenu() {
  profileActionOpen.value = true;
}

function showAvatarPreview() {
  if (profile.value) avatarPreviewOpen.value = true;
}

function openRelations(relation: 'follow' | 'fans') {
  const uid = effectiveUid.value;
  if (uid) void router.push(`/user/${uid}/relations/${relation}`);
}

async function toggleSpecialFollow() {
  const uid = effectiveUid.value;
  if (!uid || relationshipActionLoading.value || !profile.value?.isFollow) return;
  if (!authStore.isLoggedIn) {
    authStore.openLoginModal();
    return;
  }
  const previous = isFlag(profile.value.isSpecialFollow);
  relationshipActionLoading.value = true;
  profile.value.isSpecialFollow = !previous;
  try {
    await CoolapkTauriAPI.specialFollowUser(uid, !previous);
    showToast(!previous ? '已特别关注' : '已取消特别关注');
    profileActionOpen.value = false;
  } catch (err: any) {
    profile.value.isSpecialFollow = previous;
    alert(err?.message || '特别关注操作失败');
  } finally {
    relationshipActionLoading.value = false;
  }
}

async function removeFollower() {
  const uid = effectiveUid.value;
  if (!uid || relationshipActionLoading.value) return;
  const confirmed = await requestConfirmation({ title: '移除粉丝', message: '确定移除该用户的粉丝关系吗？', confirmText: '移除', danger: true });
  if (!confirmed) return;
  relationshipActionLoading.value = true;
  try {
    await CoolapkTauriAPI.cancelFollower(uid);
    profile.value.isFans = 0;
    profileActionOpen.value = false;
    showToast('已移除粉丝');
  } catch (err: any) {
    alert(err?.message || '移除粉丝失败');
  } finally {
    relationshipActionLoading.value = false;
  }
}

function openRemarkDialog() {
  const remarks = Array.isArray(profile.value?.userRemarkList) ? profile.value.userRemarkList : [];
  remarkName.value = String(profile.value?.remarkName || remarks[0]?.name || remarks[0]?.remark || '');
  profileActionOpen.value = false;
  remarkDialogOpen.value = true;
}

async function saveRemark() {
  const uid = effectiveUid.value;
  if (!uid || remarkSaving.value) return;
  remarkSaving.value = true;
  try {
    await CoolapkTauriAPI.updateUserRemark(uid, remarkName.value.trim());
    profile.value.remarkName = remarkName.value.trim();
    remarkDialogOpen.value = false;
    showToast('备注已保存');
  } catch (err: any) {
    alert(err?.message || '备注保存失败');
  } finally {
    remarkSaving.value = false;
  }
}

async function copyUserInfo() {
  const uid = effectiveUid.value;
  if (!uid) return;
  const text = `${profile.value?.username || '酷友'} ${uid}\nhttps://www.coolapk.com/u/${uid}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast('用户信息已复制');
  } catch {
    alert(text);
  }
  profileActionOpen.value = false;
}

async function shareUserPage() {
  const uid = effectiveUid.value;
  if (!uid) return;
  const link = `https://www.coolapk.com/u/${uid}`;
  if (navigator.share) {
    await navigator.share({ title: profile.value?.username || '酷安用户', text: `${profile.value?.username || '酷安用户'} 的酷安主页`, url: link }).catch(() => undefined);
  } else {
    await copyUserInfo();
  }
  profileActionOpen.value = false;
}

function reportUser() {
  const uid = effectiveUid.value;
  if (!uid) return;
  profileActionOpen.value = false;
  void CoolapkTauriAPI.openUrl(`https://m.coolapk.com/mp/do?c=user&m=report&id=${encodeURIComponent(uid)}`);
}

function openEquipment() {
  const uid = effectiveUid.value;
  if (uid) {
    void CoolapkTauriAPI.openUrl(`https://m.coolapk.com/myDevice/${encodeURIComponent(uid)}`);
  }
}

function openGoodsStore() {
  if (tabs.value.some((tab) => tab.key === 'goods_store')) activeTab.value = 'goods_store';
}

async function copyUid() {
  const uid = profile.value?.uid;
  if (!uid) return;
  try {
    await navigator.clipboard.writeText(String(uid));
    showToast(`UID ${uid} 已复制`);
  } catch {
    alert(String(uid));
  }
}

async function copyAvatarUrl() {
  const url = getAvatarBigUrl(profile.value);
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast('头像链接已复制');
  } catch {
    alert(url);
  }
}

function openAvatarInBrowser() {
  const url = getAvatarBigUrl(profile.value);
  if (url) void CoolapkTauriAPI.openUrl(url);
}

async function copyShareLink() {
  const uid = effectiveUid.value;
  if (!uid) return;
  const link = `https://www.coolapk.com/u/${uid}`;
  try {
    await navigator.clipboard.writeText(link);
    showToast('主页链接已复制');
  } catch {
    alert(link);
  }
}

watch(effectiveUid, (newUid) => {
  isBlacklisted.value = false;
  isIgnored.value = false;
  if (newUid) {
    resetTabStates();
    void fetchUserProfile();
    void fetchTabFeeds(true);
  }
}, { immediate: true });

watch(activeTab, () => {
  const state = getTabState(activeTab.value);
  if (activeTab.value !== 'home' && !state.loaded) void fetchTabFeeds(true);
  void nextTick(() => {
    const activeButton = tabScrollContainer.value?.querySelector('.app-tab-item.active') as HTMLElement | null;
    activeButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  });
});

watch(activeRatingFilter, () => {
  if (activeTab.value === 'rating') void fetchTabFeeds(true);
});
</script>

<style scoped>
.user-page-wrapper {
  width: 100%;
  /* 用户页是沉浸式主页，铺满右侧主容器，不使用动态/列表页的窄栏宽度。 */
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: 40px;
}

.profile-debug-alert {
  padding: var(--space-4) var(--space-5);
  background-color: var(--surface);
  border: 1px dashed var(--brand-primary);
  border-radius: var(--radius-card);
  color: var(--brand-primary);
  font-size: var(--font-size-sub);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-4);
}

.profile-retry-button { margin-top: 16px; padding: 9px 24px; border: 0; border-radius: 18px; color: #fff; background: var(--primary); cursor: pointer; }

/* App 原生沉浸式 Header 整体卡片 */
.app-style-user-card {
  position: relative;
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 100%;
}

.banner-cover-area {
  position: relative;
  width: 100%;
  min-height: 420px;
  background-color: #2a2a2a;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  flex-shrink: 0;
}

.banner-cover-area :deep(.banner-cover-img) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.banner-cover-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e3a8a 0%, #065f46 100%);
}

.banner-cover-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.55) 60%, rgba(0, 0, 0, 0.85) 100%);
  z-index: 1;
}

.banner-top-bar {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.top-bar-right {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.icon-circle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-circle-btn:hover {
  background: rgba(0, 0, 0, 0.6);
  transform: scale(1.05);
}

.banner-hero-content {
  position: relative;
  z-index: 5;
  padding: 80px 20px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.banner-avatar-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 4px;
}

.app-hero-avatar {
  border: 3px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  background-color: var(--surface);
}

.banner-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.blacklist-manage-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.blacklist-manage-link:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
}

.btn-danger-glass {
  background: rgba(239, 68, 68, 0.85);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.btn-danger-glass:hover {
  background: rgba(220, 38, 38, 0.95);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.btn-danger-ghost {
  background: rgba(239, 68, 68, 0.35);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(239, 68, 68, 0.6);
}

.btn-danger-ghost:hover {
  background: rgba(239, 68, 68, 0.55);
}

.btn-blacklisted,
.btn-ignored {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.app-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 18px;
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-follow-primary {
  background: #10b981;
  color: #ffffff;
}

.btn-follow-primary:hover {
  background: #059669;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-following {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.btn-secondary-glass {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.btn-icon-glass {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

/* 沉浸式详情描述行 */
.user-details-area-immersive {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.username-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-username {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.app-user-level {
  font-size: 11px;
  font-weight: 800;
  font-style: italic;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(16, 185, 129, 0.35);
}

.app-verify-tag {
  font-size: 11px;
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.25);
  backdrop-filter: blur(8px);
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.app-user-bio {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.bio-icon {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.app-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 2px;
}

.stat-cell {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.stat-cell-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.stat-cell-button:hover .num,
.stat-cell-button:hover .label { color: #a7f3d0; }

.stat-cell .num {
  font-size: 17px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.stat-cell .label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

.app-chips-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.chip-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.chip-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.9);
  display: inline-block;
  animation: pulse-dot 2s infinite ease-in-out;
}

@keyframes pulse-dot {
  0% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.15); }
  100% { opacity: 0.5; transform: scale(0.9); }
}

.gender-mars {
  color: #60a5fa;
  font-size: 11px;
}

.gender-venus {
  color: #f472b6;
  font-size: 11px;
}

.chip-icon-astro {
  color: #f59e0b;
  font-size: 10px;
}

.chip-icon-location {
  color: #38bdf8;
  font-size: 10px;
}

.chip-glass {
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.chip-glass:hover {
  background: rgba(255, 255, 255, 0.28);
  border-color: rgba(255, 255, 255, 0.4);
}

.chip-online {
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

/* 他的装备 / 商品店铺 Card 毛玻璃入口条 */
.equipment-entries-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  margin-top: 2px;
  flex-wrap: wrap;
}

.equipment-entry-bar-glass {
  display: flex;
  flex: 1 1 200px;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  padding: 9px 14px;
  border-radius: 12px;
  cursor: pointer;
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transition: all 0.2s ease;
}

.equipment-entry-bar-glass:hover {
  background: rgba(255, 255, 255, 0.24);
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
}

.equipment-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.equipment-icon {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}

.equipment-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
}

.equipment-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.95);
  flex-shrink: 0;
  white-space: nowrap;
}

/* App 风格全系 Tab 栏 */
.app-tab-navigation {
  border-top: 1px solid var(--border);
  padding: 0 16px;
}

.tab-scroll-container {
  display: flex;
  align-items: center;
  gap: 20px;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.tab-scroll-container::-webkit-scrollbar { height: 4px; }
.tab-scroll-container::-webkit-scrollbar-track { background: transparent; }
.tab-scroll-container::-webkit-scrollbar-thumb { background: transparent; border-radius: 999px; }
.tab-scroll-container::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.tab-scroll-container:hover { scrollbar-color: rgba(16, 185, 129, .55) transparent; }
.tab-scroll-container:hover::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, .55); }

.app-tab-item {
  position: relative;
  flex: 0 0 auto;
  height: 48px;
  background: transparent;
  border: none;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  padding: 0 4px;
  transition: color 0.2s;
}

.app-tab-item:hover {
  color: var(--text-primary);
}

.app-tab-item.active {
  font-size: 16px;
  font-weight: 700;
  color: #10b981;
}

.tab-indicator {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  background: #10b981;
  border-radius: 3px;
}

/* 各 Tab 内容与聚合模块 */
.tab-content-container {
  margin-top: 8px;
}

.tab-content-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 0 4px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.tab-retry-button {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 6px 14px;
  color: var(--text-secondary);
  background: var(--surface);
  cursor: pointer;
}

.tab-error-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px 16px;
  color: var(--danger, #d9534f);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
}

.tab-error-state p { margin: 0; }

.home-aggregated-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.home-section-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.home-section-card.no-padding {
  padding: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-header.with-padding {
  padding: 16px 16px 0 16px;
  margin-bottom: 8px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.section-arrow {
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
}

.section-sub-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.common-devices-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.common-device-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.common-device-item:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.common-device-item:disabled {
  opacity: 0.6;
  cursor: default;
}

.common-device-icon {
  color: var(--brand-primary);
  font-size: 14px;
}

.common-device-name {
  font-weight: 600;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.common-device-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.common-device-spinner {
  font-size: 12px;
  color: var(--brand-primary);
}

.config-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  font-size: var(--font-size-caption);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background-color: var(--background-secondary, rgba(0, 0, 0, 0.02));
  min-width: 0;
}

.config-key {
  flex-shrink: 0;
  min-width: 90px;
  color: var(--text-tertiary);
  word-break: break-all;
}

.config-value {
  min-width: 0;
  color: var(--text-primary);
  word-break: break-all;
}

.follow-users-grid {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.follow-nodes-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.node-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--background);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-pill);
  padding: 3px 10px;
  cursor: default;
}

.node-chip-all {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  background: var(--brand-soft);
  font-weight: var(--font-weight-medium);
}

.node-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

.follow-user-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 64px;
  flex-shrink: 0;
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-default);
}

.follow-user-item:hover {
  opacity: 0.75;
}

.follow-user-name {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.section-loading-placeholder {
  display: flex;
  gap: 16px;
}

.placeholder-user-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.placeholder-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--background-secondary);
}

.placeholder-text {
  width: 40px;
  height: 10px;
  border-radius: 4px;
  background: var(--background-secondary);
}

.follow-topics-grid {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.follow-topic-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 76px;
  flex-shrink: 0;
  background: var(--background-secondary, rgba(0, 0, 0, 0.02));
  padding: 10px 8px;
  border-radius: 10px;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}

.follow-topic-item:hover {
  border-color: var(--brand-primary);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.12);
}

.topic-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.topic-fallback-icon {
  color: #ffffff;
  font-size: 18px;
}

.topic-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.topic-name {
  font-size: 11px;
  color: var(--text-primary);
  font-weight: 500;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.2;
}

.loading-more-footer,
.no-more-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 0 24px;
  font-size: 12px;
  color: var(--text-tertiary, rgba(0, 0, 0, 0.35));
  user-select: none;
}

.no-more-footer::before,
.no-more-footer::after {
  content: '';
  width: 48px;
  height: 1px;
  background: var(--border-light, rgba(0, 0, 0, 0.08));
}

/* 点评 Tab Filter */
.sub-filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 0 4px;
}

.filter-label {
  font-size: 13px;
  color: var(--text-tertiary);
}

.filter-pills {
  display: flex;
  gap: 8px;
}

.filter-pill {
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-pill.active {
  background: var(--background-secondary, #e5e7eb);
  color: var(--text-primary);
  font-weight: 700;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.feed-list :deep(.feed-card),
.feed-list :deep(.user-entity-card) {
  margin-bottom: 8px;
}

.loading-wrapper,
.empty-wrapper {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-8);
  display: flex;
  justify-content: center;
}

.custom-scrollbar-hidden::-webkit-scrollbar {
  display: none;
}
.custom-scrollbar-hidden {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 1. 用户操作 ActionSheet 酷安卡片风 */
.user-action-sheet {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-sheet-user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--background-secondary, rgba(0, 0, 0, 0.04));
}

.action-sheet-user-card .user-info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.action-sheet-user-card .name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-sheet-user-card .user-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.action-sheet-user-card .user-subtext {
  font-size: 12px;
  color: var(--text-tertiary);
}

.action-menu-card {
  display: flex;
  flex-direction: column;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border-light, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  overflow: hidden;
}

.action-menu-card-danger {
  border-color: rgba(239, 68, 68, 0.15);
}

.action-menu-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 16px;
  border: none;
  border-bottom: 1px solid var(--border-light, rgba(0, 0, 0, 0.05));
  background: transparent;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.15s ease;
}

.action-menu-tile:last-child {
  border-bottom: none;
}

.action-menu-tile:hover {
  background: var(--surface-hover, var(--background-secondary, rgba(0, 0, 0, 0.04)));
}

.tile-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tile-icon {
  font-size: 15px;
  width: 18px;
  text-align: center;
  color: var(--text-secondary);
  transition: color 0.15s ease;
}

.icon-star {
  color: #f59e0b;
}

.tile-title {
  font-size: 14.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.tile-danger .tile-icon,
.tile-danger .tile-title {
  color: #ef4444;
}

.tile-arrow {
  font-size: 12px;
  color: var(--text-tertiary);
  opacity: 0.5;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.action-menu-tile:hover .tile-arrow {
  transform: translateX(2px);
  opacity: 0.9;
}

/* 2. 设置备注名称弹窗 */
.remark-dialog-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.remark-user-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--background-secondary);
}

.remark-user-preview .original-title {
  font-size: 12px;
  color: var(--text-tertiary);
}

.remark-user-preview .original-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.remark-edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.remark-input-box {
  display: flex;
  align-items: center;
  background: var(--background-secondary);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 0 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.remark-input-box:focus-within {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.input-prefix-icon {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-right: 8px;
}

.remark-native-input {
  flex: 1;
  height: 42px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: var(--text-primary);
}

.input-clear-btn {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
}

.input-clear-btn:hover {
  color: var(--text-secondary);
}

.char-count {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-left: 6px;
}

.dialog-actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-cancel {
  height: 36px;
  padding: 0 18px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.btn-submit-primary {
  height: 36px;
  padding: 0 20px;
  border-radius: 18px;
  border: none;
  background: #10b981;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s ease, transform 0.1s ease;
}

.btn-submit-primary:hover:not(:disabled) {
  background: #059669;
}

.btn-submit-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 3. 详细资料档案弹窗 */
.coolapk-profile-sheet {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sheet-hero-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--background-secondary);
}

.sheet-avatar {
  border: 2px solid var(--surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.sheet-hero-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hero-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hero-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.hero-bio {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
  word-break: break-word;
}

.profile-section-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.section-icon {
  color: #10b981;
  font-size: 12px;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.profile-grid-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--background-secondary);
  border: 1px solid var(--border-light);
  transition: all 0.2s ease;
}

.profile-grid-item[title] {
  cursor: pointer;
}

.profile-grid-item[title]:hover {
  background: var(--surface-hover);
  border-color: rgba(16, 185, 129, 0.4);
}

.grid-label {
  font-size: 11px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 5px;
}

.grid-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.grid-value-interactive {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.font-mono {
  font-family: monospace;
}

.copy-icon {
  font-size: 12px;
  color: var(--text-tertiary);
  transition: color 0.2s ease;
}

.profile-grid-item:hover .copy-icon {
  color: #10b981;
}

.profile-grid-item-full {
  grid-column: span 2;
}

.highlight-green {
  color: #10b981;
}

/* 4. 二维码弹窗 */
.coolapk-qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.qr-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.qr-header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.qr-username {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.qr-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.qr-image-frame {
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid var(--border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.qr-image-frame :deep(.user-qr-image) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-footer-actions {
  display: flex;
  justify-content: center;
  width: 100%;
}

.btn-copy-link {
  height: 38px;
  padding: 0 20px;
  border-radius: 19px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.btn-copy-link:hover {
  background: var(--surface-hover);
  border-color: #10b981;
  color: #10b981;
}

/* 5. 头像原图预览 Lightbox */
.avatar-preview-lightbox {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.avatar-img-container {
  width: 100%;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--background-secondary);
  border-radius: 12px;
  padding: 16px;
}

.avatar-img-container :deep(.avatar-preview-image) {
  width: 260px;
  height: 260px;
  max-width: 100%;
  object-fit: contain;
  border-radius: 50%;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  border: 3px solid var(--surface);
}

.avatar-preview-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  width: 100%;
}

.btn-preview-action {
  height: 36px;
  padding: 0 16px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.btn-preview-action:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--border-dark);
}
</style>
