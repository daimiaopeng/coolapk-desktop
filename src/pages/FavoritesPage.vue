<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <!-- 分类快捷标签栏与操作栏 -->
    <div v-if="authStore.isLoggedIn" class="category-toolbar">
      <div class="category-tabs">
        <button
          :class="['cat-tab', { active: activeSubTab === 'all' }]"
          @click="switchSubTab('all')"
        >
          <i class="far fa-bookmark"></i>
          <span>全部收藏</span>
        </button>
        <button
          :class="['cat-tab', { active: activeSubTab === 'collections' }]"
          @click="switchSubTab('collections')"
        >
          <i class="fas fa-folder-open"></i>
          <span>收藏单</span>
          <span v-if="collections.length" class="tab-badge">{{ collections.length }}</span>
        </button>
      </div>

      <div v-if="activeSubTab === 'collections' && !activeCollectionId" class="toolbar-actions">
        <!-- 搜索筛选框 -->
        <div v-if="collections.length > 3" class="filter-search-wrap">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model.trim="collectionFilterKeyword"
            type="text"
            placeholder="搜索收藏单..."
            class="filter-search-input"
          />
          <button
            v-if="collectionFilterKeyword"
            class="search-clear-btn"
            title="清空搜索"
            @click="collectionFilterKeyword = ''"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <button class="btn-create-collection" @click="openCollectionEditor()">
          <i class="fas fa-plus"></i>
          <span>新建收藏单</span>
        </button>

        <button class="favorite-export-trigger" type="button" @click="openFavoriteExport('collections')">
          <i class="fas fa-file-export"></i>
          <span>导出收藏</span>
        </button>

        <div class="collection-display-toolbar" aria-label="收藏单显示设置">
          <div class="collection-view-switch" role="group" aria-label="收藏单视图">
            <button
              v-for="mode in collectionViewModes"
              :key="mode.key"
              type="button"
              :class="['collection-view-btn', { active: collectionViewMode === mode.key }]"
              :title="mode.label"
              @click="setCollectionViewMode(mode.key)"
            >
              <i :class="mode.icon"></i>
              <span>{{ mode.label }}</span>
            </button>
          </div>
          <div ref="collectionSortPickerRef" class="collection-sort-picker">
            <div class="collection-sort-group">
              <button
                type="button"
                class="collection-sort-trigger"
                title="选择排序字段"
                aria-haspopup="listbox"
                :aria-expanded="collectionSortMenuOpen === 'mode'"
                @click.stop="toggleCollectionSortMenu('mode')"
                @keydown.esc="closeCollectionSortMenu"
              >
                <i class="fas fa-sort-amount-down"></i>
                <span>{{ currentCollectionSortLabel }}</span>
                <i :class="['fas', collectionSortMenuOpen === 'mode' ? 'fa-chevron-up' : 'fa-chevron-down', 'collection-sort-arrow']"></i>
              </button>
              <transition name="menu-pop">
                <div v-if="collectionSortMenuOpen === 'mode'" class="collection-sort-menu" role="listbox" aria-label="收藏单排序方式" @click.stop>
                  <button
                    v-for="mode in collectionSortModes"
                    :key="mode.key"
                    type="button"
                    role="option"
                    :aria-selected="collectionSortMode === mode.key"
                    :class="['collection-sort-option', { active: collectionSortMode === mode.key }]"
                    @click="selectCollectionSortMode(mode.key)"
                  >
                    <span>{{ mode.label }}</span>
                    <i v-if="collectionSortMode === mode.key" class="fas fa-check"></i>
                  </button>
                </div>
              </transition>
            </div>

            <div class="collection-sort-group">
              <button
                type="button"
                class="collection-sort-trigger collection-sort-direction-trigger"
                title="切换排序方向"
                aria-haspopup="listbox"
                :aria-expanded="collectionSortMenuOpen === 'direction'"
                @click.stop="toggleCollectionSortMenu('direction')"
                @keydown.esc="closeCollectionSortMenu"
              >
                <i :class="['fas', collectionSortDirection === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down']"></i>
                <span>{{ currentCollectionSortDirectionLabel }}</span>
                <i :class="['fas', collectionSortMenuOpen === 'direction' ? 'fa-chevron-up' : 'fa-chevron-down', 'collection-sort-arrow']"></i>
              </button>
              <transition name="menu-pop">
                <div v-if="collectionSortMenuOpen === 'direction'" class="collection-sort-menu collection-sort-menu--direction" role="listbox" aria-label="收藏单排序方向" @click.stop>
                  <button
                    v-for="direction in collectionSortDirections"
                    :key="direction.key"
                    type="button"
                    role="option"
                    :aria-selected="collectionSortDirection === direction.key"
                    :class="['collection-sort-option', { active: collectionSortDirection === direction.key }]"
                    @click="selectCollectionSortDirection(direction.key)"
                  >
                    <span>{{ direction.label }}</span>
                    <i v-if="collectionSortDirection === direction.key" class="fas fa-check"></i>
                  </button>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="activeSubTab === 'all'" class="toolbar-actions">
        <div class="filter-search-wrap favorite-content-search-wrap">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model.trim="favoriteContentSearchKeyword"
            type="text"
            placeholder="搜索收藏正文（本地索引）..."
            class="filter-search-input"
            @keydown.esc="favoriteContentSearchKeyword = ''"
          />
          <button v-if="favoriteContentSearchKeyword" class="search-clear-btn" title="清空正文搜索" @click="favoriteContentSearchKeyword = ''">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <button class="favorite-index-refresh" type="button" :disabled="favoriteContentIndexing" @click="refreshFavoriteContentIndex(true)">
          <i :class="favoriteContentIndexing ? 'fas fa-spinner fa-spin' : 'fas fa-rotate'"></i>
          <span>{{ favoriteContentIndexing ? '更新索引中' : '更新正文索引' }}</span>
        </button>
        <button class="favorite-export-trigger" type="button" @click="openFavoriteExport('all')">
          <i class="fas fa-file-export"></i>
          <span>导出收藏</span>
        </button>
      </div>
    </div>

    <!-- 云端收藏：未登录状态 -->
    <div v-if="!authStore.isLoggedIn" class="empty-wrapper">
      <EmptyState title="登录后查看云端收藏" description="登录酷安账号后，此处将同步展示您在酷安上真实收藏的动态" />
      <div class="login-hint">
        <AppButton variant="primary" size="sm" @click="authStore.openLoginModal()">立即登录</AppButton>
      </div>
    </div>

    <template v-else>
      <!-- 收藏单内容视图 (详情页) -->
      <div v-if="activeSubTab === 'collections' && activeCollectionId" class="collection-detail">
        <!-- 面包屑导航 -->
        <div class="collection-breadcrumb">
          <button class="breadcrumb-back-btn" @click="backToCollections">
            <i class="fas fa-arrow-left"></i>
            <span>返回收藏单列表</span>
          </button>
          <span class="breadcrumb-divider">/</span>
          <span class="breadcrumb-title">{{ collectionDetail.title || activeCollectionTitle }}</span>
        </div>

        <!-- 收藏单 Hero 信息卡 -->
        <div class="collection-hero-card">
          <div class="hero-cover-container">
            <AppImage
              v-if="collectionCover(collectionDetail)"
              :src="collectionCover(collectionDetail)"
              class="hero-cover"
              fit="cover"
              :alt="collectionDetail.title || activeCollectionTitle"
            />
            <div
              v-else
              class="hero-cover hero-cover-fallback"
              :style="{ background: getCollectionGradient(collectionDetail.title || activeCollectionTitle) }"
            >
              <i class="fas fa-folder-open"></i>
            </div>
          </div>

          <div class="hero-main-content">
            <div class="hero-title-row">
              <h2 class="hero-title">{{ collectionDetail.title || activeCollectionTitle }}</h2>
              <span v-if="isDefaultCollection(collectionDetail)" class="hero-tag tag-default">
                <i class="fas fa-crown"></i> 默认收藏单
              </span>
              <span v-else-if="collectionDetail.isOpen === 1 || collectionDetail.isOpen === true" class="hero-tag tag-public">
                <i class="fas fa-globe"></i> 公开
              </span>
              <span v-else-if="collectionDetail.isOpen === 0 || collectionDetail.isOpen === false" class="hero-tag tag-private">
                <i class="fas fa-lock"></i> 私密
              </span>
            </div>

            <p v-if="collectionDetail.description" class="hero-desc">{{ collectionDetail.description }}</p>

            <div class="hero-stats">
              <div class="stat-pill">
                <i class="fas fa-layer-group"></i>
                <span class="stat-value">{{ collectionItemNum }}</span>
                <span class="stat-label">内容</span>
              </div>
              <div class="stat-pill">
                <i class="fas fa-heart"></i>
                <span class="stat-value">{{ collectionFavnum }}</span>
                <span class="stat-label">收藏</span>
              </div>
              <div class="stat-pill">
                <i class="fas fa-user-plus"></i>
                <span class="stat-value">{{ collectionFollownum }}</span>
                <span class="stat-label">关注</span>
              </div>
            </div>
          </div>

          <div class="hero-actions-toolbar">
            <!-- 关注操作 -->
            <button
              type="button"
              :class="['toolbar-btn', 'btn-follow', { 'is-active': collectionFollowed }]"
              :disabled="collectionFollowPending"
              @click="toggleFollowCollection"
            >
              <i v-if="collectionFollowPending" class="fas fa-spinner fa-spin"></i>
              <i v-else :class="collectionFollowed ? 'fas fa-check' : 'fas fa-plus'"></i>
              <span>{{ collectionFollowed ? '已关注' : '关注' }}</span>
            </button>

            <!-- 点赞操作 -->
            <button
              type="button"
              :class="['toolbar-btn', 'btn-like', { 'is-active': collectionLiked }]"
              :disabled="collectionLikePending"
              @click="toggleLikeCollection"
            >
              <i v-if="collectionLikePending" class="fas fa-spinner fa-spin"></i>
              <i v-else :class="collectionLiked ? 'fas fa-thumbs-up' : 'far fa-thumbs-up'"></i>
              <span>{{ collectionLiked ? '已点赞' : '点赞' }}</span>
            </button>

            <!-- 编辑操作：仅非默认且有管理权限的收藏单展示 -->
            <button
              v-if="canManageCollection(collectionDetail)"
              type="button"
              class="toolbar-btn btn-edit"
              title="编辑收藏单"
              @click="openCollectionEditor(collectionDetail)"
            >
              <i class="fas fa-pen"></i>
              <span>编辑</span>
            </button>

            <!-- 方案 B：更多操作下拉菜单 (···) -->
            <div v-if="hasCollectionMoreActions" class="hero-more-menu-wrap">
              <button
                type="button"
                :class="['toolbar-btn', 'btn-more', { 'is-active': collectionMoreMenuOpen }]"
                title="更多操作"
                aria-label="更多操作"
                @click.stop="collectionMoreMenuOpen = !collectionMoreMenuOpen"
              >
                <i class="fas fa-ellipsis-h"></i>
              </button>

              <!-- 遮罩：点击外部收起下拉菜单 -->
              <div
                v-if="collectionMoreMenuOpen"
                class="hero-menu-backdrop"
                @click.stop="collectionMoreMenuOpen = false"
              ></div>

              <!-- 下拉气泡菜单 -->
              <transition name="menu-pop">
                <div v-if="collectionMoreMenuOpen" class="hero-dropdown-menu" @click.stop>
                  <button
                    type="button"
                    class="dropdown-menu-item"
                    @click="handleShareCollection"
                  >
                    <i class="fas fa-share-nodes"></i>
                    <span>分享收藏单</span>
                  </button>

                  <template v-if="isOwnerCollection(collectionDetail)">
                    <div class="dropdown-menu-divider"></div>
                    <button
                      type="button"
                      class="dropdown-menu-item"
                      :disabled="collectionCleanupPending"
                      @click="handleMenuCleanup"
                    >
                      <i v-if="collectionCleanupPending" class="fas fa-spinner fa-spin"></i>
                      <i v-else class="fas fa-broom"></i>
                      <span>清理失效内容</span>
                    </button>
                  </template>

                  <template v-if="canManageCollection(collectionDetail)">
                    <div class="dropdown-menu-divider"></div>
                    <button
                      type="button"
                      class="dropdown-menu-item is-danger"
                      :disabled="collectionActionLoading"
                      @click="handleMenuDelete"
                    >
                      <i v-if="collectionActionLoading" class="fas fa-spinner fa-spin"></i>
                      <i v-else class="fas fa-trash-alt"></i>
                      <span>删除收藏单</span>
                    </button>
                  </template>
                </div>
              </transition>
            </div>
          </div>
        </div>

        <div class="collection-content-search">
          <div class="filter-search-wrap collection-content-search-input">
            <i class="fas fa-search search-icon"></i>
            <input v-model.trim="collectionContentSearchKeyword" type="text" placeholder="搜索此收藏单内容..." class="filter-search-input" @keydown.esc="collectionContentSearchKeyword = ''" />
            <button v-if="collectionContentSearchKeyword" class="search-clear-btn" title="清空收藏单搜索" @click="collectionContentSearchKeyword = ''">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <span v-if="collectionContentSearchKeyword" class="collection-content-search-hint">
            <i v-if="collectionContentSearchLoading" class="fas fa-spinner fa-spin"></i>
            <span v-else>已匹配 {{ filteredCollectionItems.length }} 条已加载内容</span>
          </span>
        </div>

        <div v-if="collectionItemsLoading && collectionItems.length === 0" class="loading-wrapper">
          <LoadingState text="正在获取收藏单内容..." />
        </div>

        <div v-else-if="collectionItemsError && collectionItems.length === 0" class="error-wrapper">
          <ErrorState title="内容加载失败" :message="collectionItemsError" @retry="fetchCollectionItems(true)" />
        </div>

        <div v-else-if="collectionItems.length === 0 && !collectionItemsLoading" class="empty-wrapper">
          <EmptyState title="收藏单暂无内容" description="在此收藏单中收藏的动态将显示在这里" />
        </div>

        <div v-else-if="collectionContentSearchKeyword && filteredCollectionItems.length === 0" class="empty-wrapper">
          <EmptyState title="此收藏单中未找到匹配内容" description="可继续下滑加载更多内容，或清空搜索词" />
        </div>

        <div v-else class="feed-list">
          <div v-for="item in filteredCollectionItems" :key="item.id" class="collection-feed-item">
            <RatingCard
              v-if="isRatingFeedEntity(item)"
              :feed="item"
              cloud-favorite
              :highlight-keyword="collectionContentSearchKeyword"
              @favorite-changed="handleFavoriteChanged"
            />
            <FeedCard
              v-else
              :feed="item"
              cloud-favorite
              :highlight-keyword="collectionContentSearchKeyword"
              @deleted="handleFeedDeleted"
              @favorite-changed="handleFavoriteChanged"
            />
            <div v-if="collectionItemId(item)" class="collection-item-quick-action">
              <button
                type="button"
                class="btn-remove-collection-item"
                title="从当前收藏单移除"
                :disabled="collectionItemActionId === collectionItemId(item)"
                @click.stop="removeCollectionItem(item)"
              >
                <i v-if="collectionItemActionId === collectionItemId(item)" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-folder-minus"></i>
                <span>移出收藏单</span>
              </button>
            </div>
          </div>
          <div class="pagination-footer">
            <LoadingState v-if="collectionItemsLoadingMore" text="加载更多中..." />
            <div v-else-if="collectionItemsNoMore" class="no-more">没有更多内容了</div>
          </div>
        </div>
      </div>


      <!-- 收藏单列表视图 (卡片网格) -->
      <div v-else-if="activeSubTab === 'collections'" class="collection-grid-view">
        <div v-if="collectionsLoading" class="loading-wrapper">
          <LoadingState text="正在获取收藏单..." />
        </div>

        <div v-else-if="collections.length === 0" class="empty-wrapper">
          <EmptyState title="暂无收藏单" description="在酷安上创建的收藏单会显示在这里" />
        </div>

        <div v-else-if="filteredCollections.length === 0" class="empty-wrapper">
          <EmptyState
            title="未找到匹配的收藏单"
            :description="`没有找到包含 “${collectionFilterKeyword}” 的收藏单`"
          />
        </div>

        <div v-else :class="['collection-cards', `collection-cards--${collectionViewMode}`]">
          <div
            v-for="collection in filteredCollections"
            :key="collection.id"
            :class="['collection-card', `collection-card--${collectionViewMode}`]"
            @click="openCollection(collection)"
          >
            <div v-if="collectionViewMode !== 'no-image'" class="collection-cover-wrapper">
              <AppImage
                v-if="collectionCover(collection)"
                :src="collectionCover(collection)"
                class="collection-cover-img"
                fit="cover"
                :alt="collection.title"
              />
              <div
                v-else
                class="collection-cover-fallback"
                :style="{ background: getCollectionGradient(collection.title || collection.id) }"
              >
                <div class="fallback-glass-icon">
                  <i class="fas fa-folder-open"></i>
                </div>
              </div>

              <!-- 封面状态角标 (左上角) -->
              <div class="cover-badge-group">
                <span v-if="isDefaultCollection(collection)" class="cover-badge badge-default">
                  <i class="fas fa-crown"></i> 默认
                </span>
                <span v-else-if="collection.isOpen === 1 || collection.isOpen === true" class="cover-badge badge-public">
                  <i class="fas fa-globe"></i> 公开
                </span>
                <span v-else-if="collection.isOpen === 0 || collection.isOpen === false" class="cover-badge badge-private">
                  <i class="fas fa-lock"></i> 私密
                </span>
              </div>

              <!-- 封面条目数角标 (右下角) -->
              <div class="cover-count-pill">
                <i class="fas fa-layer-group"></i>
                <span>{{ getCollectionItemCount(collection) }}</span>
              </div>

              <!-- 悬浮操作按钮组 (右上角，悬停浮现) -->
              <div v-if="canManageCollection(collection)" class="collection-card-actions">
                <button
                  type="button"
                  class="collection-action-btn"
                  title="编辑收藏单"
                  @click.stop="openCollectionEditor(collection)"
                >
                  <i class="fas fa-pen"></i>
                </button>
                <button
                  type="button"
                  class="collection-action-btn is-danger"
                  title="删除收藏单"
                  @click.stop="deleteCollection(collection)"
                >
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>

            <!-- 卡片信息区 -->
            <div class="collection-info">
              <div class="collection-title-wrap">
                <span class="collection-title" :title="collection.title">{{ collection.title }}</span>
              </div>

              <!-- 无图模式下的状态徽章 (行内) -->
              <div v-if="collectionViewMode === 'no-image'" class="collection-inline-status">
                <span v-if="isDefaultCollection(collection)" class="inline-status is-default">
                  <i class="fas fa-crown"></i> 默认
                </span>
                <span v-else-if="collection.isOpen === 1 || collection.isOpen === true" class="inline-status is-public">
                  <i class="fas fa-globe"></i> 公开
                </span>
                <span v-else-if="collection.isOpen === 0 || collection.isOpen === false" class="inline-status is-private">
                  <i class="fas fa-lock"></i> 私密
                </span>
              </div>

              <p v-if="collection.description" class="collection-desc" :title="collection.description">
                {{ collection.description }}
              </p>

              <div class="collection-meta-row">
                <!-- 仅在无图模式下展示条目数，其他模式封面右下角已有角标 -->
                <span v-if="collectionViewMode === 'no-image'" class="meta-item meta-item--items">
                  <i class="fas fa-layer-group"></i>
                  <span>{{ getCollectionItemCount(collection) }} 条内容</span>
                </span>
                <!-- 关注数：大图、单栏、双栏、无图下均展示 -->
                <span v-if="hasCollectionFollowers(collection)" class="meta-item meta-item--followers">
                  <i class="fas fa-user-plus"></i>
                  <span>{{ getCollectionFollowerCount(collection) }} 关注</span>
                </span>
                <!-- 收藏数：有收藏数时展示 -->
                <span v-if="hasCollectionFavorites(collection)" class="meta-item meta-item--favorites">
                  <i class="fas fa-heart"></i>
                  <span>{{ getCollectionFavoriteCount(collection) }} 收藏</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 全部收藏视图 -->
      <template v-else>
        <template v-if="favoriteContentSearchKeyword">
          <div v-if="favoriteContentSearchLoading" class="loading-wrapper">
            <LoadingState text="正在检索本地收藏正文..." />
          </div>
          <div v-else-if="favoriteContentSearchError" class="error-wrapper">
            <ErrorState title="本地正文检索失败" :message="favoriteContentSearchError" @retry="runFavoriteContentSearch" />
          </div>
          <div v-else-if="favoriteContentSearchResults.length === 0" class="empty-wrapper">
            <EmptyState title="未找到匹配的收藏正文" :description="favoriteContentIndexing ? '正文索引正在后台更新，请稍后再试' : '可点击“更新正文索引”补齐或刷新本地缓存'" />
          </div>
          <div v-else class="feed-list">
            <div class="favorite-content-search-summary"><i class="fas fa-database"></i> 已索引 {{ favoriteContentIndexCount }} 条收藏正文，命中 {{ favoriteContentSearchResults.length }} 条<span v-if="favoriteContentIndexing">，索引更新中</span></div>
            <template v-for="entry in favoriteContentSearchResults" :key="entry.feedId">
              <RatingCard v-if="isRatingFeedEntity(entry.feed)" :feed="entry.feed" cloud-favorite favorite-picker-on-remove :highlight-keyword="favoriteContentSearchKeyword" @favorite-changed="handleFavoriteChanged" />
              <FeedCard v-else :feed="entry.feed" cloud-favorite favorite-picker-on-remove :highlight-keyword="favoriteContentSearchKeyword" @deleted="handleFeedDeleted" @favorite-changed="handleFavoriteChanged" />
            </template>
          </div>
        </template>
        <template v-else>
          <div v-if="loading && cloudFeeds.length === 0" class="loading-wrapper">
            <LoadingState text="正在获取云端收藏..." />
          </div>

          <div v-else-if="cloudError && cloudFeeds.length === 0" class="error-wrapper">
            <ErrorState title="收藏加载失败" :message="cloudError" @retry="fetchCloudFavorites(true)" />
          </div>

          <div v-else-if="cloudFeeds.length === 0 && !loading" class="empty-wrapper">
            <EmptyState title="暂无云端收藏" description="在酷安上收藏过的动态将显示在这里" />
          </div>

          <div v-else class="feed-list">
            <template v-for="item in cloudFeeds" :key="item.id">
              <RatingCard
                v-if="isRatingFeedEntity(item)"
                :feed="item"
                cloud-favorite
                favorite-picker-on-remove
                @favorite-changed="handleFavoriteChanged"
              />
              <FeedCard
                v-else
                :feed="item"
                cloud-favorite
                favorite-picker-on-remove
                @deleted="handleFeedDeleted"
                @favorite-changed="handleFavoriteChanged"
              />
            </template>
            <div class="pagination-footer">
              <div v-if="cloudError" class="no-more collection-load-warning">
                {{ cloudError }}
                <button type="button" @click="fetchCloudFavorites(true)">重新加载</button>
              </div>
              <div v-else-if="noMore" class="no-more">已加载全部收藏</div>
            </div>
          </div>
        </template>
      </template>
    </template>

    <!-- 编辑/新建收藏单弹窗 -->
    <AppDialog :is-open="collectionEditorOpen" :title="editingCollectionId ? '编辑收藏单' : '新建收藏单'" :width="500" :close-on-backdrop="!collectionActionLoading" @close="closeCollectionEditor">
      <form class="collection-form" @submit.prevent="saveCollection">
        <div class="form-item">
          <label class="form-label">标题 <span class="required-star">*</span></label>
          <input
            v-model.trim="collectionForm.title"
            required
            maxlength="80"
            placeholder="给收藏单起个名字"
            class="form-input"
          />
        </div>

        <div class="form-item">
          <label class="form-label">描述</label>
          <textarea
            v-model.trim="collectionForm.description"
            maxlength="300"
            rows="3"
            placeholder="可选，介绍这个收藏单的内容"
            class="form-textarea"
          ></textarea>
        </div>

        <div class="form-item">
          <label class="collection-visibility-toggle">
            <input v-model="collectionForm.isOpen" type="checkbox" />
            <div class="toggle-text">
              <span class="toggle-title">公开收藏单</span>
              <span class="toggle-subtitle">其他人可以查看和关注该收藏单</span>
            </div>
          </label>
        </div>

        <div class="form-item">
          <label class="form-label">封面</label>
          <div class="cover-upload-section">
            <div v-if="collectionForm.cover" class="cover-preview-wrapper">
              <AppImage :src="collectionForm.cover" class="collection-form-cover" fit="cover" alt="收藏单封面预览" />
              <button type="button" class="btn-remove-cover" title="清除封面" @click="collectionForm.cover = ''">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="upload-btn-wrap">
              <label class="btn-upload-file">
                <i v-if="collectionCoverUploading" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-cloud-arrow-up"></i>
                <span>{{ collectionForm.cover ? '更换封面' : '上传封面' }}</span>
                <input type="file" accept="image/*" :disabled="collectionActionLoading || collectionCoverUploading" @change="uploadCollectionCover" />
              </label>
              <span class="form-hint">支持 JPG、PNG 格式，不超过 10MB</span>
            </div>
          </div>
        </div>

        <p v-if="collectionActionError" class="form-error">{{ collectionActionError }}</p>
        <div class="dialog-actions">
          <AppButton variant="secondary" type="button" :disabled="collectionActionLoading" @click="closeCollectionEditor">取消</AppButton>
          <AppButton variant="primary" type="submit" :loading="collectionActionLoading">保存</AppButton>
        </div>
      </form>
    </AppDialog>
    <FavoriteExportDialog
      :is-open="favoriteExportOpen"
      :mode="favoriteExportMode"
      :collections="collections"
      @close="favoriteExportOpen = false"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FeedCard from '../components/feed/FeedCard.vue';
import RatingCard from '../components/feed/RatingCard.vue';
import AppButton from '../components/common/AppButton.vue';
import AppDialog from '../components/common/AppDialog.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import FavoriteExportDialog from '../components/favorites/FavoriteExportDialog.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import type {
  FavoriteCollectionViewMode,
  FavoriteCollectionSortMode,
  FavoriteCollectionSortDirection,
} from '../types/settings';
import { requestConfirmation } from '../utils/confirm';
import { getErrorMessage } from '../utils/errors';
import { showToast } from '../utils/toast';
import { isRatingFeedEntity } from '../utils/rating';
import { favoriteFeedCursorId, loadAllFavoriteCollections, loadAllFavoriteFeeds } from '../utils/favoriteFeeds';
import {
  getFavoriteContentIndexCount,
  normalizeFavoriteSearchText,
  removeFavoriteContentIndexEntry,
  searchFavoriteContentIndex,
  syncFavoriteContentIndex,
  type FavoriteContentIndexEntry,
} from '../utils/favoriteContentIndex';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const activeSubTab = ref<'all' | 'collections'>('all');
const favoriteExportOpen = ref(false);
const favoriteExportMode = ref<'all' | 'collections'>('all');

function openFavoriteExport(mode: 'all' | 'collections') {
  favoriteExportMode.value = mode;
  favoriteExportOpen.value = true;
}

const cloudFeeds = ref<any[]>([]);
const loading = ref(false);
const cloudError = ref('');
const noMore = ref(false);
const favoriteContentSearchKeyword = ref('');
const favoriteContentSearchResults = ref<FavoriteContentIndexEntry[]>([]);
const favoriteContentSearchLoading = ref(false);
const favoriteContentSearchError = ref('');
const favoriteContentIndexing = ref(false);
const favoriteContentIndexCount = ref(0);
let favoriteContentSearchTimer: ReturnType<typeof setTimeout> | null = null;
let favoriteContentSearchVersion = 0;

const collections = ref<any[]>([]);
const collectionsLoading = ref(false);
const collectionFilterKeyword = ref('');
const activeCollectionId = ref('');
const activeCollectionTitle = ref('');
const collectionItems = ref<any[]>([]);
const collectionItemsLoading = ref(false);
const collectionItemsLoadingMore = ref(false);
const collectionItemsError = ref('');
const collectionItemsPage = ref(1);
const collectionItemsNoMore = ref(false);
const collectionItemsFirstItem = ref('');
const collectionItemsLastItem = ref('');
const collectionContentSearchKeyword = ref('');
const collectionContentSearchIds = ref<Set<string>>(new Set());
const collectionContentSearchLoading = ref(false);
let collectionContentSearchTimer: ReturnType<typeof setTimeout> | null = null;
let collectionContentSearchVersion = 0;
const collectionDetail = ref<any>({});
const collectionFavnum = ref(0);
const collectionFollownum = ref(0);
const collectionItemNum = ref(0);
const collectionFollowed = ref(false);

const settingsStore = useSettingsStore();

const collectionViewModes: Array<{ key: FavoriteCollectionViewMode; label: string; icon: string }> = [
  { key: 'large', label: '大图', icon: 'fas fa-th-large' },
  { key: 'single', label: '单栏', icon: 'fas fa-list' },
  { key: 'double', label: '双栏', icon: 'fas fa-columns' },
  { key: 'no-image', label: '无图', icon: 'fas fa-align-left' },
];

const collectionSortModes: Array<{ key: FavoriteCollectionSortMode; label: string }> = [
  { key: 'default', label: '默认顺序' },
  { key: 'name', label: '按名称' },
  { key: 'item-count', label: '按内容数' },
  { key: 'favorite-count', label: '按收藏数' },
  { key: 'follower-count', label: '按关注数' },
];

const collectionSortDirections: Array<{ key: FavoriteCollectionSortDirection; label: string }> = [
  { key: 'asc', label: '升序' },
  { key: 'desc', label: '降序' },
];

const collectionViewMode = computed<FavoriteCollectionViewMode>({
  get: () => settingsStore.settings.favoriteCollectionViewMode,
  set: (value) => { settingsStore.settings.favoriteCollectionViewMode = value; },
});

const collectionSortMode = computed<FavoriteCollectionSortMode>({
  get: () => settingsStore.settings.favoriteCollectionSortMode,
  set: (value) => { settingsStore.settings.favoriteCollectionSortMode = value; },
});

const collectionSortDirection = computed<FavoriteCollectionSortDirection>({
  get: () => settingsStore.settings.favoriteCollectionSortDirection,
  set: (value) => { settingsStore.settings.favoriteCollectionSortDirection = value; },
});

const currentCollectionSortLabel = computed(() => collectionSortModes.find(mode => mode.key === collectionSortMode.value)?.label || '默认顺序');
const currentCollectionSortDirectionLabel = computed(() => collectionSortDirections.find(direction => direction.key === collectionSortDirection.value)?.label || '升序');

const collectionSortMenuOpen = ref<'mode' | 'direction' | null>(null);
const collectionSortPickerRef = ref<HTMLElement | null>(null);

function setCollectionViewMode(mode: FavoriteCollectionViewMode) {
  collectionViewMode.value = mode;
}

function toggleCollectionSortMenu(type: 'mode' | 'direction') {
  collectionSortMenuOpen.value = collectionSortMenuOpen.value === type ? null : type;
}

function closeCollectionSortMenu() {
  collectionSortMenuOpen.value = null;
}

function selectCollectionSortMode(mode: FavoriteCollectionSortMode) {
  collectionSortMode.value = mode;
  closeCollectionSortMenu();
}

function selectCollectionSortDirection(direction: FavoriteCollectionSortDirection) {
  collectionSortDirection.value = direction;
  closeCollectionSortMenu();
}

function favoriteAccountId(): string {
  return String(authStore.user?.uid || '').trim();
}

async function runCollectionContentSearch() {
  const keyword = collectionContentSearchKeyword.value.trim();
  const accountId = favoriteAccountId();
  const requestVersion = ++collectionContentSearchVersion;
  if (!keyword || !accountId) {
    collectionContentSearchIds.value = new Set();
    collectionContentSearchLoading.value = false;
    return;
  }
  collectionContentSearchLoading.value = true;
  try {
    const results = await searchFavoriteContentIndex(accountId, keyword, 10_000);
    if (requestVersion !== collectionContentSearchVersion) return;
    collectionContentSearchIds.value = new Set(results.map(entry => entry.feedId));
  } catch (error) {
    if (requestVersion === collectionContentSearchVersion) console.warn('搜索收藏单正文索引失败:', error);
  } finally {
    if (requestVersion === collectionContentSearchVersion) collectionContentSearchLoading.value = false;
  }
}

function scheduleCollectionContentSearch() {
  if (collectionContentSearchTimer) clearTimeout(collectionContentSearchTimer);
  collectionContentSearchTimer = setTimeout(() => {
    collectionContentSearchTimer = null;
    void runCollectionContentSearch();
  }, 180);
}

async function runFavoriteContentSearch() {
  const keyword = favoriteContentSearchKeyword.value.trim();
  const accountId = favoriteAccountId();
  const requestVersion = ++favoriteContentSearchVersion;
  if (!keyword || !accountId) {
    favoriteContentSearchResults.value = [];
    favoriteContentSearchError.value = '';
    favoriteContentSearchLoading.value = false;
    return;
  }
  favoriteContentSearchLoading.value = true;
  favoriteContentSearchError.value = '';
  try {
    const [results, count] = await Promise.all([
      searchFavoriteContentIndex(accountId, keyword),
      getFavoriteContentIndexCount(accountId),
    ]);
    if (requestVersion !== favoriteContentSearchVersion) return;
    favoriteContentSearchResults.value = results;
    favoriteContentIndexCount.value = count;
  } catch (error) {
    if (requestVersion !== favoriteContentSearchVersion) return;
    favoriteContentSearchResults.value = [];
    favoriteContentSearchError.value = getErrorMessage(error, '本地正文索引不可用');
  } finally {
    if (requestVersion === favoriteContentSearchVersion) favoriteContentSearchLoading.value = false;
  }
}

function scheduleFavoriteContentSearch() {
  if (favoriteContentSearchTimer) clearTimeout(favoriteContentSearchTimer);
  favoriteContentSearchTimer = setTimeout(() => {
    favoriteContentSearchTimer = null;
    void runFavoriteContentSearch();
  }, 180);
}

async function refreshFavoriteContentIndex(showResult: boolean) {
  const accountId = favoriteAccountId();
  if (!accountId || favoriteContentIndexing.value) return;
  favoriteContentIndexing.value = true;
  try {
    const result = await syncFavoriteContentIndex(accountId);
    favoriteContentIndexCount.value = result.total;
    if (favoriteContentSearchKeyword.value.trim()) await runFavoriteContentSearch();
    if (showResult) {
      const status = result.complete ? '完成' : '部分完成';
      showToast(`正文索引${status}：${result.total} 条，新增 ${result.indexed} 条，更新 ${result.updated} 条`, 'success');
    }
  } catch (error) {
    if (showResult) showToast(getErrorMessage(error, '更新正文索引失败'), 'error');
    else console.warn('后台更新收藏正文索引失败:', error);
  } finally {
    favoriteContentIndexing.value = false;
  }
}

const filteredCollections = computed(() => {
  const keyword = collectionFilterKeyword.value.trim().toLowerCase();
  let list = collections.value;
  if (keyword) {
    list = list.filter((item) => {
      const title = String(item?.title || item?.name || '').toLowerCase();
      const desc = String(item?.description || item?.summary || '').toLowerCase();
      return title.includes(keyword) || desc.includes(keyword);
    });
  }

  const mode = collectionSortMode.value;
  const direction = collectionSortDirection.value;
  if (mode === 'default') return list;

  return [...list].sort((a, b) => {
    let result = 0;
    if (mode === 'name') {
      const nameA = String(a?.title || a?.name || '').trim();
      const nameB = String(b?.title || b?.name || '').trim();
      result = nameA.localeCompare(nameB, 'zh-CN');
    } else if (mode === 'item-count') {
      result = getCollectionItemCount(a) - getCollectionItemCount(b);
    } else if (mode === 'favorite-count') {
      result = getCollectionFavoriteCount(a) - getCollectionFavoriteCount(b);
    } else if (mode === 'follower-count') {
      result = getCollectionFollowerCount(a) - getCollectionFollowerCount(b);
    }
    return direction === 'desc' ? -result : result;
  });
});

const filteredCollectionItems = computed(() => {
  const query = normalizeFavoriteSearchText(collectionContentSearchKeyword.value);
  if (!query) return collectionItems.value;
  const keywords = query.split(' ').filter(Boolean);
  return collectionItems.value.filter((item) => {
    const itemId = String(item?.id || item?.feedId || '').trim();
    if (itemId && collectionContentSearchIds.value.has(itemId)) return true;
    const summary = normalizeFavoriteSearchText(`${item?.title || ''}\n${item?.message || item?.description || ''}`);
    return keywords.every(keyword => summary.includes(keyword));
  });
});

const COLLECTION_GRADIENTS = [
  'linear-gradient(135deg, #10b981 0%, #047857 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
  'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
  'linear-gradient(135deg, #64748b 0%, #334155 100%)',
];

function getCollectionGradient(titleOrId?: string): string {
  const str = String(titleOrId || '').trim();
  if (!str) return COLLECTION_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return COLLECTION_GRADIENTS[Math.abs(hash) % COLLECTION_GRADIENTS.length];
}

function handleFeedDeleted(id: string | number) {
  const filter = (list: any[]) => list.filter((f: any) => String(f.id) !== String(id));
  cloudFeeds.value = filter(cloudFeeds.value);
  collectionItems.value = filter(collectionItems.value);
  void removeFavoriteContentIndexEntry(favoriteAccountId(), id).catch((error) => console.warn('移除删除动态的正文索引失败:', error));
}

function handleFavoriteChanged(payload: { id: string | number; favorited: boolean }) {
  if (payload.favorited) return;
  const filter = (list: any[]) => list.filter((f: any) => String(f.id) !== String(payload.id));
  cloudFeeds.value = filter(cloudFeeds.value);
  collectionItems.value = filter(collectionItems.value);
  favoriteContentSearchResults.value = favoriteContentSearchResults.value.filter(entry => entry.feedId !== String(payload.id));
  void removeFavoriteContentIndexEntry(favoriteAccountId(), payload.id).catch((error) => console.warn('移除取消收藏的正文索引失败:', error));
}
const collectionLiked = ref(false);
const collectionFollowPending = ref(false);
const collectionLikePending = ref(false);
const collectionEditorOpen = ref(false);
const editingCollectionId = ref('');
const collectionActionLoading = ref(false);
const collectionCoverUploading = ref(false);
const collectionCleanupPending = ref(false);
const collectionItemActionId = ref('');
const collectionActionError = ref('');
const collectionMoreMenuOpen = ref(false);
const collectionForm = ref({ title: '', description: '', cover: '', isOpen: true });

function firstValue(obj: any, keys: string[]) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function toBool(value: any) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function collectionId(collection: any): string { return String(collection?.id || collection?.collectionId || collection?.entityId || '').trim(); }
function collectionCover(collection: any): string { return String(firstValue(collection, ['cover', 'coverPic', 'cover_pic', 'pic', 'logo']) || '').trim(); }

function getCollectionItemCount(collection: any): number {
  return Number(firstValue(collection, ['itemNum', 'item_num', 'itemnum', 'feedNum', 'feed_num', 'count']) ?? 0);
}

function getCollectionFollowerCount(collection: any): number {
  return Number(firstValue(collection, ['follownum', 'followNum', 'follow_num']) ?? 0);
}

function hasCollectionFollowers(collection: any): boolean {
  const val = firstValue(collection, ['follownum', 'followNum', 'follow_num']);
  return val !== undefined && val !== null;
}

function getCollectionFavoriteCount(collection: any): number {
  return Number(firstValue(collection, ['favnum', 'favNum', 'fav_num', 'likeNum', 'like_num']) ?? 0);
}

function hasCollectionFavorites(collection: any): boolean {
  const val = firstValue(collection, ['favnum', 'favNum', 'fav_num', 'likeNum', 'like_num']);
  return val !== undefined && val !== null && Number(val) > 0;
}
function isDefaultCollection(collection: any): boolean {
  if (toBool(firstValue(collection, ['defaultCollected', 'default_collected', 'isDefault', 'is_default', 'isDefaultCollection']))) return true;
  const title = String(collection?.title || collection?.name || '').trim().toLowerCase();
  return (
    title === '默认收藏' ||
    title === '默认收藏夹' ||
    title === '默认收藏单' ||
    title.startsWith('默认收藏') ||
    title === 'default collection' ||
    title === 'default favorites'
  );
}
function isOwnerCollection(collection: any): boolean {
  if (!collectionId(collection)) return false;
  const ownerUid = String(firstValue(collection, ['uid', 'userId', 'user_id']) || collection?.userInfo?.uid || '').trim();
  const myUid = String(authStore.user?.uid || '').trim();
  return !ownerUid || !myUid || ownerUid === myUid;
}
function canManageCollection(collection: any): boolean {
  if (!collectionId(collection) || isDefaultCollection(collection)) return false;
  return isOwnerCollection(collection);
}

const hasCollectionMoreActions = computed(() => {
  return Boolean(activeCollectionId.value);
});

async function handleShareCollection() {
  collectionMoreMenuOpen.value = false;
  const col = collectionDetail.value;
  const colId = activeCollectionId.value;
  if (!colId) return;

  const isOpen = col.isOpen ?? col.is_open;
  if (isOpen === 0 || isOpen === false) {
    showToast('该收藏单为私密收藏单，无法分享', 'warning');
    return;
  }

  const shareUrl = col.url
    ? (col.url.startsWith('http') ? col.url : `https://www.coolapk.com${col.url}`)
    : `https://www.coolapk.com/collection/${colId}`;
  const authorName = col.username || col.userInfo?.username || authStore.user?.username || '酷安用户';
  const title = col.title || activeCollectionTitle.value || '收藏单';
  const shareText = `推荐酷安用户@${authorName} 的收藏单：${title} ${shareUrl} 分享自【酷安App】`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: `酷安收藏单 - ${title}`,
        text: shareText,
        url: shareUrl,
      });
      showToast('分享成功', 'success');
      return;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
  }

  try {
    await navigator.clipboard.writeText(shareText);
    showToast('收藏单分享链接已复制到剪贴板', 'success');
  } catch {
    showToast('复制链接失败，请重试', 'error');
  }
}

function handleMenuCleanup() {
  collectionMoreMenuOpen.value = false;
  void clearInvalidCollectionItems();
}

function handleMenuDelete() {
  collectionMoreMenuOpen.value = false;
  void deleteCollection(collectionDetail.value);
}
function collectionItemId(item: any): string {
  return String(
    item?.collectionItem?.id ||
    item?.collectionItem?.itemId ||
    item?.collectionItem?.item_id ||
    item?.collection_item_info?.id ||
    item?.collection_item_info?.itemId ||
    item?.collection_item_info?.item_id ||
    item?.collectionItemId ||
    item?.collection_item_id ||
    ''
  ).trim();
}
function responseData(response: any): any { return response?.data?.data ?? response?.data ?? response; }

function backToCollections() {
  resetCollectionState();
  const { collectionId: _collectionId, collectionTitle: _collectionTitle, ...query } = route.query;
  void router.push({ path: route.path, query });
}

function switchSubTab(tab: 'all' | 'collections') {
  if (activeSubTab.value === tab && !activeCollectionId.value) return;
  activeSubTab.value = tab;
  if (activeCollectionId.value) {
    resetCollectionState();
    const { collectionId: _collectionId, collectionTitle: _collectionTitle, ...query } = route.query;
    void router.push({ path: route.path, query });
  }
  if (tab === 'all') {
    if (cloudFeeds.value.length === 0) void fetchCloudFavorites(true);
  } else {
    if (collections.value.length === 0) void fetchCollections();
  }
}

async function fetchCollections() {
  const uid = authStore.user?.uid;
  if (!uid) return;
  collectionsLoading.value = true;
  try {
    const result = await loadAllFavoriteCollections();
    collections.value = result.collections;
    if (!result.complete) console.warn('收藏单列表分页未完整结束');
  } catch (err) {
    console.warn('获取收藏单失败', err);
  } finally {
    collectionsLoading.value = false;
  }
}

function openCollectionEditor(collection?: any) {
  const id = collectionId(collection);
  const openValue = firstValue(collection, ['isOpen', 'is_open', 'isOpened', 'is_opened']);
  editingCollectionId.value = id;
  collectionForm.value = {
    title: String(collection?.title || collection?.name || '').trim(),
    description: String(collection?.description || collection?.summary || '').trim(),
    cover: collectionCover(collection),
    isOpen: openValue === undefined ? true : toBool(openValue),
  };
  collectionActionError.value = '';
  collectionEditorOpen.value = true;
}

function closeCollectionEditor() {
  if (collectionActionLoading.value || collectionCoverUploading.value) return;
  collectionEditorOpen.value = false;
  collectionActionError.value = '';
}

async function uploadCollectionCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    collectionActionError.value = '请选择图片文件';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    collectionActionError.value = '封面不能超过 10MB';
    return;
  }
  collectionCoverUploading.value = true;
  collectionActionError.value = '';
  try {
    const res: any = await CoolapkTauriAPI.uploadImage(new Uint8Array(await file.arrayBuffer()), file.name, file.type, 'feed_image');
    const data = responseData(res);
    const url = String(data?.url || data?.imageUrl || data || '').trim();
    if (!url) throw new Error('上传接口未返回图片地址');
    collectionForm.value.cover = url;
    showToast('封面上传成功', 'success');
  } catch (err) {
    collectionActionError.value = getErrorMessage(err, '封面上传失败');
    showToast(collectionActionError.value, 'error');
  } finally {
    collectionCoverUploading.value = false;
  }
}

async function saveCollection() {
  const title = collectionForm.value.title.trim();
  if (!title) {
    collectionActionError.value = '收藏单标题不能为空';
    return;
  }
  if (collectionActionLoading.value || collectionCoverUploading.value) return;
  collectionActionLoading.value = true;
  collectionActionError.value = '';
  try {
    const description = collectionForm.value.description.trim();
    const cover = collectionForm.value.cover.trim();
    const isOpen = collectionForm.value.isOpen ? 1 : 0;
    const saved = editingCollectionId.value
      ? await CoolapkTauriAPI.updateCollection(editingCollectionId.value, title, description, cover, isOpen)
      : await CoolapkTauriAPI.createCollection({ title, description, cover, isOpen, sourceId: '' });
    const savedData = responseData(saved);
    const savedId = String(savedData?.id || savedData?.collectionId || editingCollectionId.value || '').trim();
    if (editingCollectionId.value) {
      const targetId = editingCollectionId.value;
      const index = collections.value.findIndex(item => collectionId(item) === targetId);
      const updated = { ...(index >= 0 ? collections.value[index] : {}), ...(savedData && typeof savedData === 'object' ? savedData : {}), id: targetId, title, description, cover, isOpen };
      if (index >= 0) collections.value[index] = updated;
      if (activeCollectionId.value === targetId) {
        collectionDetail.value = { ...collectionDetail.value, ...updated };
        activeCollectionTitle.value = title;
      }
    }
    collectionEditorOpen.value = false;
    await fetchCollections();
    if (savedId && activeCollectionId.value === savedId) await fetchCollectionDetail();
    showToast(editingCollectionId.value ? '收藏单已更新' : '收藏单已创建', 'success');
  } catch (err) {
    collectionActionError.value = getErrorMessage(err, editingCollectionId.value ? '更新收藏单失败' : '创建收藏单失败');
    showToast(collectionActionError.value, 'error');
  } finally {
    collectionActionLoading.value = false;
  }
}

async function deleteCollection(collection: any) {
  const id = collectionId(collection);
  if (!id || !canManageCollection(collection) || collectionActionLoading.value) return;
  const confirmed = await requestConfirmation({ title: '删除收藏单', message: `确定删除“${collection?.title || activeCollectionTitle.value || '收藏单'}”吗？删除后会取消其中内容的归属。`, confirmText: '删除', danger: true });
  if (!confirmed) return;
  collectionActionLoading.value = true;
  try {
    await CoolapkTauriAPI.deleteCollection(id);
    collections.value = collections.value.filter(item => collectionId(item) !== id);
    if (activeCollectionId.value === id) backToCollections();
    showToast('收藏单已删除', 'success');
  } catch (err) {
    showToast(getErrorMessage(err, '删除收藏单失败'), 'error');
  } finally {
    collectionActionLoading.value = false;
  }
}

async function clearInvalidCollectionItems() {
  if (!activeCollectionId.value || collectionCleanupPending.value) return;
  const confirmed = await requestConfirmation({ title: '清理失效内容', message: '确定清理这个收藏单中的失效内容吗？酷安会在后台处理，通常需要几分钟。', confirmText: '确认清理', danger: true });
  if (!confirmed) return;
  collectionCleanupPending.value = true;
  try {
    await CoolapkTauriAPI.clearCollectionInvalidItems(activeCollectionId.value);
    showToast('清理请求已提交', 'success');
    await fetchCollectionItems(true);
  } catch (err) {
    showToast(getErrorMessage(err, '清理失效内容失败'), 'error');
  } finally {
    collectionCleanupPending.value = false;
  }
}

async function removeCollectionItem(item: any) {
  const itemId = collectionItemId(item);
  if (!itemId || collectionItemActionId.value) return;
  const confirmed = await requestConfirmation({ title: '移除收藏内容', message: '确定只从当前收藏单移除这条内容吗？原内容不会被删除。', confirmText: '移除', danger: true });
  if (!confirmed) return;
  collectionItemActionId.value = itemId;
  try {
    await CoolapkTauriAPI.removeCollectionItem(itemId);
    collectionItems.value = collectionItems.value.filter(current => collectionItemId(current) !== itemId);
    collectionItemNum.value = Math.max(0, collectionItemNum.value - 1);
    const current = collections.value.find(collection => collectionId(collection) === activeCollectionId.value);
    if (current) current.itemNum = collectionItemNum.value;
    showToast('已从收藏单移除', 'success');
  } catch (err) {
    showToast(getErrorMessage(err, '移除收藏内容失败'), 'error');
  } finally {
    collectionItemActionId.value = '';
  }
}

function openCollection(collection: any) {
  const id = collectionId(collection);
  if (!id) return;
  activateCollection(collection);
  void router.push({
    path: route.path,
    query: {
      ...route.query,
      collectionId: id,
      collectionTitle: collection.title || '收藏单',
    },
  });
}

function activateCollection(collection: any) {
  activeCollectionId.value = collectionId(collection);
  collectionContentSearchKeyword.value = '';
  collectionContentSearchIds.value = new Set();
  activeCollectionTitle.value = collection.title || '收藏单';
  collectionDetail.value = { ...collection };
  collectionFavnum.value = getCollectionFavoriteCount(collection);
  collectionFollownum.value = getCollectionFollowerCount(collection);
  collectionItemNum.value = getCollectionItemCount(collection);
  collectionFollowed.value = toBool(firstValue(collection, ['isFollowed', 'isFollow', 'is_followed']));
  collectionLiked.value = toBool(firstValue(collection, ['isLiked', 'isLike', 'is_liked']));
  void fetchCollectionDetail();
  void fetchCollectionItems(true);
}

function resetCollectionState() {
  activeCollectionId.value = '';
  activeCollectionTitle.value = '';
  collectionDetail.value = {};
  collectionFavnum.value = 0;
  collectionFollownum.value = 0;
  collectionItemNum.value = 0;
  collectionFollowed.value = false;
  collectionLiked.value = false;
  collectionItems.value = [];
  collectionItemsPage.value = 1;
  collectionItemsNoMore.value = false;
  collectionItemsFirstItem.value = '';
  collectionItemsLastItem.value = '';
  collectionContentSearchKeyword.value = '';
  collectionContentSearchIds.value = new Set();
  collectionMoreMenuOpen.value = false;
}

watch(
  () => route.query.collectionId,
  (value) => {
    const collectionIdValue = Array.isArray(value) ? value[0] : value;
    if (!collectionIdValue) {
      if (activeCollectionId.value) resetCollectionState();
      return;
    }
    if (activeCollectionId.value === String(collectionIdValue)) return;

    const titleValue = route.query.collectionTitle;
    const collectionTitle = Array.isArray(titleValue) ? titleValue[0] : titleValue;
    const source = collections.value.find(item => collectionId(item) === String(collectionIdValue)) || {
      id: String(collectionIdValue),
      title: collectionTitle || '收藏单',
    };
    activeSubTab.value = 'collections';
    activateCollection(source);
  },
  { immediate: true }
);

function applyCollectionDetail(detail: any, fallback: any) {
  const source = detail && Object.keys(detail).length > 0 ? detail : fallback;
  const fav = firstValue(source, ['fav_num', 'favnum', 'favNum', 'like_num', 'likeNum'])
    ?? firstValue(fallback, ['fav_num', 'favnum', 'favNum', 'like_num', 'likeNum']);
  if (fav !== undefined && fav !== null) {
    collectionFavnum.value = Number(fav);
  }

  const follow = firstValue(source, ['follow_num', 'follownum', 'followNum'])
    ?? firstValue(fallback, ['follow_num', 'follownum', 'followNum']);
  if (follow !== undefined && follow !== null) {
    collectionFollownum.value = Number(follow);
  }

  const itemNum = firstValue(source, ['item_num', 'itemNum', 'itemnum', 'feed_num', 'feedNum', 'count'])
    ?? firstValue(fallback, ['item_num', 'itemNum', 'itemnum', 'feed_num', 'feedNum', 'count']);
  if (itemNum !== undefined && itemNum !== null) {
    collectionItemNum.value = Number(itemNum);
  }

  collectionFollowed.value = toBool(
    firstValue(source, ['isFollowed', 'isFollow', 'is_followed']) ??
    firstValue(source?.userAction, ['isFollowed', 'isFollow']) ??
    firstValue(fallback, ['isFollowed', 'isFollow', 'is_followed'])
  );
  collectionLiked.value = toBool(
    firstValue(source, ['isLiked', 'isLike', 'is_liked']) ??
    firstValue(source?.userAction, ['isLiked', 'isLike']) ??
    firstValue(fallback, ['isLiked', 'isLike', 'is_liked'])
  );
  if (!collectionDetail.value.title && (source?.title || fallback?.title)) {
    collectionDetail.value = { ...collectionDetail.value, title: source?.title || fallback?.title };
  }
  if (!collectionDetail.value.description && (source?.description || fallback?.description)) {
    collectionDetail.value = { ...collectionDetail.value, description: source?.description || fallback?.description };
  }
  if (!collectionCover(collectionDetail.value) && (collectionCover(source) || collectionCover(fallback))) {
    collectionDetail.value = { ...collectionDetail.value, cover: collectionCover(source) || collectionCover(fallback) };
  }
}

async function fetchCollectionDetail() {
  if (!activeCollectionId.value) return;
  try {
    const res = await CoolapkTauriAPI.getCollectionDetail(activeCollectionId.value);
    const detail = res && res.data ? res.data : {};
    collectionDetail.value = { ...collectionDetail.value, ...detail };
    applyCollectionDetail(detail, collections.value.find(c => collectionId(c) === activeCollectionId.value) || {});
  } catch (err) {
    console.warn('获取收藏单详情失败', err);
    applyCollectionDetail({}, collections.value.find(c => collectionId(c) === activeCollectionId.value) || {});
  }
}

async function toggleFollowCollection() {
  if (!activeCollectionId.value || collectionFollowPending.value) return;
  collectionFollowPending.value = true;
  try {
    const action = collectionFollowed.value ? CoolapkTauriAPI.unfollowCollection : CoolapkTauriAPI.followCollection;
    const res = await action(activeCollectionId.value);
    if (res && res.code === 200) {
      collectionFollowed.value = !collectionFollowed.value;
      collectionFollownum.value = Math.max(0, collectionFollownum.value + (collectionFollowed.value ? 1 : -1));
    } else {
      console.warn('关注操作失败', res);
      alert('操作失败，请稍后重试');
    }
  } catch (err) {
    console.warn('关注操作失败', err);
    alert('操作失败，请检查网络');
  } finally {
    collectionFollowPending.value = false;
  }
}

async function toggleLikeCollection() {
  if (!activeCollectionId.value || collectionLikePending.value) return;
  collectionLikePending.value = true;
  try {
    const action = collectionLiked.value ? CoolapkTauriAPI.unlikeCollection : CoolapkTauriAPI.likeCollection;
    const res = await action(activeCollectionId.value);
    if (res && res.code === 200) {
      collectionLiked.value = !collectionLiked.value;
      collectionFavnum.value = Math.max(0, collectionFavnum.value + (collectionLiked.value ? 1 : -1));
    } else {
      console.warn('点赞操作失败', res);
      alert('操作失败，请稍后重试');
    }
  } catch (err) {
    console.warn('点赞操作失败', err);
    alert('操作失败，请检查网络');
  } finally {
    collectionLikePending.value = false;
  }
}

async function fetchCollectionItems(isRefresh = false) {
  if (!activeCollectionId.value) return;
  if (collectionItemsLoading.value || (collectionItemsLoadingMore.value && !isRefresh)) return;

  if (isRefresh) {
    collectionItemsPage.value = 1;
    collectionItemsNoMore.value = false;
    collectionItemsFirstItem.value = '';
    collectionItemsLastItem.value = '';
    collectionItems.value = [];
    collectionItemsLoading.value = true;
  } else {
    if (collectionItemsNoMore.value) return;
    collectionItemsLoadingMore.value = true;
  }
  collectionItemsError.value = '';

  try {
    const res = await CoolapkTauriAPI.getCollectionItemList(activeCollectionId.value, collectionItemsPage.value, collectionItemsFirstItem.value, collectionItemsLastItem.value);
    const newItems = (res && res.data && Array.isArray(res.data)) ? res.data : [];
    if (newItems.length === 0) {
      collectionItemsNoMore.value = true;
    } else {
      if (isRefresh) {
        collectionItems.value = newItems;
      } else {
        const existingIds = new Set(collectionItems.value.map(i => i.id));
        collectionItems.value.push(...newItems.filter((i: any) => !existingIds.has(i.id)));
      }
      if (!collectionItemsFirstItem.value) collectionItemsFirstItem.value = favoriteFeedCursorId(collectionItems.value[0]);
      collectionItemsLastItem.value = favoriteFeedCursorId(collectionItems.value[collectionItems.value.length - 1]);
      collectionItemsPage.value++;
    }
  } catch (err: any) {
    collectionItemsError.value = err?.message || '加载失败，请检查网络';
  } finally {
    collectionItemsLoading.value = false;
    collectionItemsLoadingMore.value = false;
  }
}

async function fetchCloudFavorites(isRefresh = false) {
  const uid = authStore.user?.uid;
  if (!uid) return;
  if (loading.value || (!isRefresh && noMore.value)) return;

  if (isRefresh) {
    noMore.value = false;
    cloudFeeds.value = [];
    loading.value = true;
  }
  cloudError.value = '';

  try {
    const result = await loadAllFavoriteFeeds();
    cloudFeeds.value = result.feeds;
    noMore.value = true;
    if (!result.complete) cloudError.value = '部分收藏单或内容未能完整读取，请刷新重试';
  } catch (err: any) {
    cloudError.value = err?.message || '加载失败，请检查网络';
    noMore.value = true;
  } finally {
    loading.value = false;
  }
}

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const { scrollTop, clientHeight, scrollHeight } = target;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    if (activeSubTab.value === 'collections' && activeCollectionId.value) {
      if (!collectionItemsLoading.value && !collectionItemsLoadingMore.value && !collectionItemsNoMore.value) {
        fetchCollectionItems(false);
      }
    }
  }
}

watch(
  () => authStore.user?.uid,
  () => {
    if (authStore.isLoggedIn) {
      void fetchCloudFavorites(true);
      void fetchCollections();
      void refreshFavoriteContentIndex(false);
    }
  }
);

watch(favoriteContentSearchKeyword, () => scheduleFavoriteContentSearch());
watch(collectionContentSearchKeyword, () => scheduleCollectionContentSearch());

onMounted(() => {
  if (authStore.isLoggedIn) {
    void fetchCloudFavorites(true);
    void fetchCollections();
    void refreshFavoriteContentIndex(false);
  }
});

onBeforeUnmount(() => {
  if (favoriteContentSearchTimer) clearTimeout(favoriteContentSearchTimer);
  if (collectionContentSearchTimer) clearTimeout(collectionContentSearchTimer);
});
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0;
}

/* 顶部工具栏与选项卡 */
.category-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
}

.category-tabs {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.cat-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  background-color: var(--surface);
  border: 1px solid var(--border);
  font-size: var(--font-size-sub);
  font-weight: 550;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.cat-tab:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--border-light);
}

.cat-tab.active {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(16, 183, 104, 0.12);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 7px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: var(--radius-pill);
  background: rgba(16, 183, 104, 0.15);
  color: var(--brand-primary);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 200px;
}

.filter-search-wrap .search-icon {
  position: absolute;
  left: 11px;
  color: var(--text-tertiary);
  font-size: 12.5px;
  pointer-events: none;
}

.filter-search-input {
  width: 100%;
  height: 34px;
  padding: 0 28px 0 32px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all 0.18s ease;
}

.filter-search-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.filter-search-input::-webkit-search-cancel-button,
.filter-search-input::-webkit-search-decoration {
  -webkit-appearance: none;
  appearance: none;
  display: none;
}

.search-clear-btn {
  position: absolute;
  right: 8px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  font-size: 11px;
}

.search-clear-btn:hover {
  color: var(--text-primary);
}

.favorite-content-search-wrap {
  width: min(300px, 48vw);
}

.favorite-index-refresh,
.favorite-export-trigger,
.btn-create-collection {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.favorite-index-refresh:hover:not(:disabled),
.favorite-export-trigger:hover,
.btn-create-collection:hover {
  background: var(--brand-soft);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.favorite-index-refresh:disabled {
  opacity: 0.62;
  cursor: wait;
}

.favorite-content-search-summary {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0 0 var(--space-3);
  padding: 8px 11px;
  border: 1px solid var(--border-light, var(--border));
  border-radius: var(--radius-control);
  background: var(--brand-soft);
  color: var(--text-secondary);
  font-size: 12.5px;
}

.favorite-content-search-summary i {
  color: var(--brand-primary);
}

.btn-create-collection:active {
  transform: translateY(0);
}

/* 收藏单工具栏：视图切换与排序选择 */
.collection-display-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.collection-view-switch {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
}

.collection-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.collection-view-btn:hover {
  color: var(--text-primary);
  background: var(--hover-surface, rgba(0, 0, 0, 0.04));
}

.collection-view-btn.active {
  color: #ffffff;
  background: var(--brand-primary);
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25);
}

.collection-sort-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.collection-sort-group {
  position: relative;
  display: inline-flex;
}

.collection-sort-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.collection-sort-trigger:hover {
  color: var(--text-primary);
  border-color: var(--border-hover, var(--brand-primary));
}

.collection-sort-direction-trigger {
  padding: 0 10px;
}

.collection-sort-arrow {
  font-size: 10px;
  opacity: 0.7;
  margin-left: 2px;
}

.collection-sort-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 140px;
  padding: 6px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collection-sort-menu--direction {
  left: 0;
  right: auto;
  min-width: 100%;
  width: max-content;
}

.collection-sort-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
  transition: all 0.14s ease;
}

.collection-sort-option:hover {
  color: var(--text-primary);
  background: var(--hover-surface, rgba(0, 0, 0, 0.04));
}

.collection-sort-option.active {
  color: var(--brand-primary);
  font-weight: 600;
  background: var(--brand-soft);
}

/* 收藏单卡片网格与视图模式 */
.collection-grid-view {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.collection-cards {
  display: grid;
  width: 100%;
}

/* 大图视图：每行自适应卡片，更开阔的视觉效果 */
.collection-cards--large {
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 14px;
}

/* 单栏视图：整行横向展示，左侧封面，右侧信息 */
.collection-cards--single {
  grid-template-columns: 1fr;
  gap: 12px;
}

/* 双栏视图：左右对齐横向卡片 */
.collection-cards--double {
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 12px;
}

/* 无图视图：纯净卡片网格 */
.collection-cards--no-image {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

/* 卡片基础样式与交互 */
.collection-card {
  position: relative;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.collection-card:hover {
  transform: translateY(-4px);
  border-color: rgba(16, 183, 104, 0.4);
  box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.03);
}

/* 单栏与双栏的横向布局 */
.collection-card--single {
  flex-direction: row;
  align-items: stretch;
}

.collection-card--double {
  flex-direction: row;
  align-items: stretch;
}

.collection-card--no-image {
  flex-direction: column;
}

/* 封面容器尺寸 */
.collection-cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background-color: var(--background-secondary);
  overflow: hidden;
  border-bottom: 1px solid var(--border-light);
}

.collection-card--large .collection-cover-wrapper {
  width: 100%;
  aspect-ratio: 16 / 10;
  max-height: 150px;
}

.collection-card--single .collection-cover-wrapper {
  width: 180px;
  flex: 0 0 180px;
  aspect-ratio: unset;
  min-height: 128px;
  border-bottom: none;
  border-right: 1px solid var(--border-light);
}

.collection-card--double .collection-cover-wrapper {
  width: 140px;
  flex: 0 0 140px;
  aspect-ratio: unset;
  min-height: 120px;
  border-bottom: none;
  border-right: 1px solid var(--border-light);
}

.collection-cover-img {
  width: 100%;
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.collection-card:hover .collection-cover-img {
  transform: scale(1.04);
}

.collection-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.collection-card:hover .collection-cover-fallback {
  transform: scale(1.04);
}

.fallback-glass-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.cover-badge-group {
  position: absolute;
  top: 9px;
  left: 9px;
  display: flex;
  gap: 6px;
  z-index: 1;
}

.cover-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.cover-badge.badge-default {
  background: rgba(16, 185, 129, 0.85);
  color: #ffffff;
}

.cover-badge.badge-public {
  background: rgba(0, 0, 0, 0.45);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.cover-badge.badge-private {
  background: rgba(0, 0, 0, 0.55);
  color: #fcd34d;
  border: 1px solid rgba(252, 211, 77, 0.3);
}

.cover-count-pill {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 550;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  z-index: 1;
}

.collection-card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transform: translateY(-3px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 2;
}

.collection-card:hover .collection-card-actions {
  opacity: 1;
  transform: translateY(0);
}

.collection-action-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.16s ease;
  font-size: 12px;
}

.collection-action-btn:hover {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  transform: scale(1.08);
}

.collection-action-btn.is-danger:hover {
  background: var(--danger);
  border-color: var(--danger);
  transform: scale(1.08);
}

/* 卡片信息区 */
.collection-info {
  padding: 14px 16px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collection-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.collection-title {
  font-size: 15.5px;
  font-weight: 650;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.35;
  transition: color 0.15s ease;
}

.collection-card:hover .collection-title {
  color: var(--brand-primary);
}

.collection-inline-status {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 2px;
}

.inline-status {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.inline-status.is-default {
  background: rgba(16, 185, 129, 0.12);
  color: var(--brand-primary);
}

.inline-status.is-public {
  background: var(--background-secondary);
  color: var(--text-secondary);
}

.inline-status.is-private {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
}

.collection-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 统计胶囊徽章（Capsule Pill） */
.collection-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  flex-wrap: wrap;
  padding-top: 4px;
}

.meta-item {
  font-size: 11.5px;
  font-weight: 550;
  display: inline-flex;
  align-items: center;
  gap: 4.5px;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-light);
  background: var(--background-secondary);
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.meta-item--items {
  color: var(--brand-primary);
  background: var(--brand-soft);
  border-color: rgba(16, 185, 129, 0.2);
}

.meta-item--followers {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.18);
}

.meta-item--favorites {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.18);
}

.meta-item i {
  font-size: 11px;
}

/* 详情页面包屑与 Hero Header */
.collection-detail {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.collection-content-search {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 var(--space-4);
}

.collection-content-search-input {
  width: min(360px, 100%);
}

.collection-content-search-hint {
  color: var(--text-tertiary);
  font-size: 12px;
}

.collection-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--space-4);
  font-size: 13.5px;
}

.breadcrumb-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 4px 8px;
  margin-left: -8px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 550;
  transition: all 0.16s ease;
}

.breadcrumb-back-btn:hover {
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.breadcrumb-divider {
  color: var(--text-tertiary);
  font-size: 12px;
}

.breadcrumb-title {
  color: var(--text-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.collection-hero-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 18px 24px;
  margin-bottom: var(--space-5);
  background: linear-gradient(135deg, var(--surface) 0%, rgba(16, 185, 129, 0.025) 100%);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
}

.hero-cover-container {
  flex-shrink: 0;
  width: 84px;
  height: 84px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.15));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-cover {
  width: 100%;
  height: 100%;
}

.hero-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #ffffff;
}

.hero-main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.hero-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
}

.hero-tag.tag-default {
  background: rgba(16, 183, 104, 0.12);
  color: var(--brand-primary);
}

.hero-tag.tag-public {
  background: rgba(47, 128, 237, 0.12);
  color: #2f80ed;
}

.hero-tag.tag-private {
  background: rgba(245, 159, 0, 0.12);
  color: #d97706;
}

.hero-desc {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--background);
  border: 1px solid var(--border-light);
  font-size: 12.5px;
  color: var(--text-secondary);
}

.stat-pill i {
  color: var(--brand-primary);
  font-size: 11.5px;
}

.stat-value {
  font-weight: 650;
  color: var(--text-primary);
}

.stat-label {
  color: var(--text-tertiary);
  font-size: 12px;
}

/* Option B: 主操作突出 + 更多菜单收纳 (···) */
.hero-actions-toolbar {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--background);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
  transform: translateY(-1px);
}

.toolbar-btn:active:not(:disabled) {
  transform: translateY(0);
}

.toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 关注按钮高亮 */
.toolbar-btn.btn-follow {
  background: linear-gradient(135deg, var(--brand-primary), #0ea05b);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(16, 185, 102, 0.25);
}

.toolbar-btn.btn-follow:hover:not(:disabled) {
  filter: brightness(1.06);
  color: #ffffff;
}

.toolbar-btn.btn-follow.is-active {
  background: var(--brand-soft);
  border-color: rgba(16, 183, 104, 0.3);
  color: var(--brand-primary);
  box-shadow: none;
}

/* 点赞按钮高亮 */
.toolbar-btn.btn-like.is-active {
  background: rgba(16, 183, 104, 0.12);
  border-color: rgba(16, 183, 104, 0.3);
  color: var(--brand-primary);
}

/* 更多按钮 (···) */
.toolbar-btn.btn-more {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  font-size: 13px;
}

.toolbar-btn.btn-more.is-active {
  background: var(--brand-soft);
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

/* 更多菜单容器与遮罩 */
.hero-more-menu-wrap {
  position: relative;
  display: inline-flex;
}

.hero-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: transparent;
}

.hero-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 100;
  min-width: 156px;
  padding: 6px;
  background: var(--surface-elevated, var(--surface));
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.14), 0 4px 10px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 2px;
  transform-origin: top right;
}

.dropdown-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.dropdown-menu-item:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--brand-primary);
}

.dropdown-menu-item i {
  width: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
  transition: color 0.15s ease;
}

.dropdown-menu-item:hover:not(:disabled) i {
  color: var(--brand-primary);
}

.dropdown-menu-item.is-danger {
  color: var(--danger, #ef4444);
}

.dropdown-menu-item.is-danger i {
  color: var(--danger, #ef4444);
}

.dropdown-menu-item.is-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger, #ef4444);
}

.dropdown-menu-item.is-danger:hover:not(:disabled) i {
  color: var(--danger, #ef4444);
}

.dropdown-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dropdown-menu-divider {
  height: 1px;
  background: var(--border-light, var(--border));
  margin: 4px 6px;
}

/* 菜单淡入弹出动效 */
.menu-pop-enter-active,
.menu-pop-leave-active {
  transition: opacity 0.16s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.95);
}

/* 详情列表与移除操作（浮动在卡片右上角，零占用空间） */
.collection-feed-item {
  position: relative;
  width: 100%;
}

.collection-item-quick-action {
  position: absolute;
  top: 14px;
  right: 52px;
  z-index: 5;
  display: flex;
  align-items: center;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.collection-feed-item:hover .collection-item-quick-action,
.collection-feed-item:focus-within .collection-item-quick-action {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

@media (hover: none) {
  .collection-item-quick-action {
    opacity: 0.8;
    pointer-events: auto;
  }
}

.btn-remove-collection-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-tertiary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.16s ease;
}

.btn-remove-collection-item:hover {
  color: var(--danger);
  background: rgba(240, 68, 68, 0.08);
  border-color: rgba(240, 68, 68, 0.3);
  transform: translateY(-1px);
}

/* 弹窗样式 */
.collection-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: var(--font-size-sub);
  font-weight: 600;
  color: var(--text-primary);
}

.required-star {
  color: var(--danger);
}

.form-input,
.form-textarea {
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--background);
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
  transition: all 0.16s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.collection-visibility-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-control);
  background: var(--background);
  border: 1px solid var(--border-light);
  cursor: pointer;
}

.collection-visibility-toggle input {
  margin-top: 3px;
  accent-color: var(--brand-primary);
  width: 16px;
  height: 16px;
}

.toggle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.toggle-subtitle {
  font-size: 12px;
  color: var(--text-tertiary);
}

.cover-upload-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cover-preview-wrapper {
  position: relative;
  width: 100%;
  max-height: 160px;
  border-radius: var(--radius-control);
  overflow: hidden;
  border: 1px solid var(--border);
}

.collection-form-cover {
  width: 100%;
  height: 160px;
  object-fit: cover;
}

.btn-remove-cover {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  transition: background 0.15s ease;
}

.btn-remove-cover:hover {
  background: var(--danger);
}

.upload-btn-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-upload-file {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-control);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.16s ease;
}

.btn-upload-file input[type='file'] {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.btn-upload-file:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--brand-soft);
}

.form-hint {
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.login-hint {
  margin-top: var(--space-3);
  text-align: center;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pagination-footer {
  padding: 16px 0;
  text-align: center;
}

.no-more {
  color: var(--text-tertiary);
  font-size: 12px;
}

.loading-wrapper,
.error-wrapper,
.empty-wrapper {
  padding: var(--space-10) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
