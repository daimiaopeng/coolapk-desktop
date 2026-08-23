<template>
  <div class="more-page-container custom-scrollbar">
    <!-- 顶部 Header 区域 -->
    <div class="more-header-section">
      <div class="header-content">
        <div class="header-title-row">
          <div class="title-with-badge">
            <span class="hub-icon-wrapper">
              <i class="fas fa-shapes"></i>
            </span>
            <h1 class="page-title">更多服务</h1>
          </div>
          <span class="hub-count-tag">共 {{ allItemsCount }} 个专区与功能</span>
        </div>
      </div>

      <!-- 快捷搜索框 -->
      <div class="search-bar-wrapper">
        <i class="fas fa-search search-icon"></i>
        <input
          v-model="searchQuery"
          type="text"
          class="hub-search-input"
          placeholder="快速查找专区、服务或功能..."
        />
        <button
          v-if="searchQuery"
          class="clear-search-btn"
          title="清空搜索"
          @click="searchQuery = ''"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- 搜索结果模式 -->
    <div v-if="searchQuery.trim()" class="search-results-section">
      <div class="section-header">
        <h2 class="section-title">
          <i class="fas fa-filter"></i> 搜索结果 ({{ filteredSearchResults.length }})
        </h2>
      </div>

      <div v-if="filteredSearchResults.length > 0" class="cards-grid">
        <div
          v-for="item in filteredSearchResults"
          :key="item.id"
          class="hub-card-item"
          role="button"
          tabindex="0"
          @click="navigateTo(item.path)"
          @keydown.enter="navigateTo(item.path)"
        >
          <div :class="['hub-icon-circle', item.colorClass]">
            <i :class="item.icon"></i>
          </div>
          <div class="hub-card-info">
            <span class="hub-card-title">{{ item.title }}</span>
          </div>
          <i class="fas fa-chevron-right hub-card-arrow"></i>
        </div>
      </div>

      <div v-else class="empty-search-state">
        <i class="fas fa-search-minus empty-icon"></i>
        <p class="empty-text">未找到与 "{{ searchQuery }}" 相关的专区或功能</p>
      </div>
    </div>

    <!-- 默认浏览模式：常用金刚区 + 业务分组 -->
    <div v-else class="hub-content-body">
      <!-- 1. 核心与常用服务（主页同款圆形彩色金刚区，纯粹图标+标题） -->
      <section class="hub-section featured-section">
        <div class="section-header">
          <h2 class="section-title">
            <i class="fas fa-fire-alt fire-icon"></i> 常用与核心专区
          </h2>
        </div>

        <div class="featured-icons-grid">
          <button
            v-for="item in featuredItems"
            :key="item.id"
            type="button"
            class="featured-btn-item"
            @click="navigateTo(item.path)"
          >
            <span :class="['featured-icon-circle', item.colorClass]">
              <i :class="item.icon"></i>
            </span>
            <span class="featured-item-title">{{ item.title }}</span>
          </button>
        </div>
      </section>

      <!-- 2. 分类板块组（纯粹图标+标题，极致清爽） -->
      <div class="categories-container">
        <section
          v-for="cat in hubCategories"
          :key="cat.id"
          class="hub-section category-section"
        >
          <div class="section-header">
            <h2 class="section-title">
              <i :class="cat.icon" class="cat-icon"></i> {{ cat.title }}
            </h2>
            <span class="section-count">({{ cat.items.length }})</span>
          </div>

          <div class="cards-grid">
            <div
              v-for="item in cat.items"
              :key="item.id"
              class="hub-card-item"
              role="button"
              tabindex="0"
              @click="navigateTo(item.path)"
              @keydown.enter="navigateTo(item.path)"
            >
              <div :class="['hub-icon-circle', item.colorClass]">
                <i :class="item.icon"></i>
              </div>
              <div class="hub-card-info">
                <span class="hub-card-title">{{ item.title }}</span>
              </div>
              <i class="fas fa-chevron-right hub-card-arrow"></i>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';

interface HubItem {
  id: string;
  title: string;
  shortDesc: string;
  desc: string;
  icon: string;
  colorClass: string;
  path: string;
  badge?: string;
  tags?: string[];
}

interface HubCategory {
  id: string;
  title: string;
  desc: string;
  icon: string;
  items: HubItem[];
}

const router = useRouter();
const searchQuery = ref('');

function navigateTo(path: string) {
  router.push(path);
}

// 核心推荐与常用金刚区（主页同款）
const featuredItems: HubItem[] = [
  {
    id: 'my-products',
    title: '我的数码',
    shortDesc: '我的装备',
    desc: '管理正在使用的数码设备、评分与真实点评',
    icon: 'fas fa-box-open',
    colorClass: 'bg-blue',
    path: '/my-products',
    tags: ['数码', '装备', '手机', '我的'],
  },
  {
    id: 'goods',
    title: '好物推荐',
    shortDesc: '精选折扣',
    desc: '社区酷友精选数码好物、实时好价与折扣榜单',
    icon: 'fas fa-gift',
    colorClass: 'bg-orange',
    path: '/goods',
    tags: ['好物', '优惠', '折扣', '购买', '清单'],
  },
  {
    id: 'center',
    title: '酷安中心',
    shortDesc: '创作者/福利',
    desc: '官方活动福利、创作者激励计划与身份认证',
    icon: 'fas fa-shapes',
    colorClass: 'bg-green',
    path: '/center',
    tags: ['中心', '官方', '活动', '认证', '福利'],
  },
  {
    id: 'albums',
    title: '我的专辑',
    shortDesc: '收藏合集',
    desc: '创建并管理精选动态、应用与数码主题合集',
    icon: 'fas fa-layer-group',
    colorClass: 'bg-purple',
    path: '/albums',
    tags: ['专辑', '合集', '整理', '收藏'],
  },
  {
    id: 'pictures',
    title: '酷图精选',
    shortDesc: '壁纸大图',
    desc: '发现酷友分享的高清摄影、精美手机壁纸与图赏',
    icon: 'far fa-image',
    colorClass: 'bg-red',
    path: '/pictures',
    tags: ['酷图', '壁纸', '摄影', '美图'],
  },
  {
    id: 'secondhand',
    title: '二手市场',
    shortDesc: '闲置数码',
    desc: '酷友真实闲置数码好物流转与安全交流',
    icon: 'fas fa-store',
    colorClass: 'bg-teal',
    path: '/secondhand',
    tags: ['二手', '闲置', '交易', '买卖'],
  },
  {
    id: 'reviews',
    title: '评测专区',
    shortDesc: '深度体验',
    desc: '客观真实的深度机型体验与专业产品评测',
    icon: 'fas fa-flask',
    colorClass: 'bg-yellow',
    path: '/reviews',
    tags: ['评测', '体验', '测评'],
  },
  {
    id: 'games',
    title: '游戏中心',
    shortDesc: '精品好游',
    desc: '发现高分热门手游、单机神作与游戏社区',
    icon: 'fas fa-gamepad',
    colorClass: 'bg-indigo',
    path: '/games',
    tags: ['游戏', '好游', '手游', '单机'],
  },
];

// 多维度分类架构（高扩展性，轻松承载 n 个栏目）
const hubCategories: HubCategory[] = [
  {
    id: 'digital',
    title: '数码与装备专区',
    desc: '数码库、装备管理与机型生态',
    icon: 'fas fa-mobile-alt',
    items: [
      {
        id: 'my_products_cat',
        title: '我的数码装备',
        shortDesc: '设备管理',
        desc: '登记并管理正在使用的数码设备，撰写打分与点评',
        icon: 'fas fa-box-open',
        colorClass: 'bg-blue',
        path: '/my-products',
        tags: ['数码', '设备', '装备'],
      },
      {
        id: 'digital_category',
        title: '数码分类库',
        shortDesc: '全品类数码',
        desc: '手机、平板、笔记本、摄影与穿戴设备全景库',
        icon: 'fas fa-microchip',
        colorClass: 'bg-indigo',
        path: '/digital',
        tags: ['数码', '分类', '手机', '平板', '电脑'],
      },
      {
        id: 'product_compare',
        title: '机型多维对比',
        shortDesc: '参数对比',
        desc: '多款数码机型参数规格、屏幕性能与跑分全面对比',
        icon: 'fas fa-balance-scale',
        colorClass: 'bg-cyan',
        path: '/product-selector?mode=compare',
        tags: ['对比', '参数', '选机'],
      },
      {
        id: 'product_selector',
        title: '精准选机中心',
        shortDesc: '选机助手',
        desc: '按预算、品牌、处理器与拍照需求智能筛选机型',
        icon: 'fas fa-filter',
        colorClass: 'bg-purple',
        path: '/product-selector',
        tags: ['选机', '筛选', '购买'],
      },
      {
        id: 'secondhand_cat',
        title: '二手市场',
        shortDesc: '闲置流转',
        desc: '数码玩家闲置流通，真实成色与自提交流',
        icon: 'fas fa-store',
        colorClass: 'bg-teal',
        path: '/secondhand',
        tags: ['二手', '闲置', '交易'],
      },
      {
        id: 'reviews_cat',
        title: '数码深度评测',
        shortDesc: '专业测评',
        desc: '数码发烧友与专业作者带来的硬核深度使用报告',
        icon: 'fas fa-flask',
        colorClass: 'bg-yellow',
        path: '/reviews',
        tags: ['评测', '文章', '测评'],
      },
    ],
  },
  {
    id: 'community',
    title: '内容与社区生态',
    desc: '灵感合集、摄影美图与自媒体',
    icon: 'fas fa-users',
    items: [
      {
        id: 'albums_cat',
        title: '我的专辑合集',
        shortDesc: '专辑收藏',
        desc: '汇聚优质动态与好玩应用的自定义主题专辑',
        icon: 'fas fa-layer-group',
        colorClass: 'bg-purple',
        path: '/albums',
        tags: ['专辑', '合集', '整理'],
      },
      {
        id: 'pictures_cat',
        title: '酷图与壁纸精选',
        shortDesc: '高清图赏',
        desc: '海量高清手机壁纸、数码摄影大图与调色交流',
        icon: 'far fa-image',
        colorClass: 'bg-red',
        path: '/pictures',
        tags: ['酷图', '壁纸', '摄影'],
      },
      {
        id: 'my_dyh',
        title: '我的看看号',
        shortDesc: '订阅专栏',
        desc: '关注的官方自媒体号、科技媒体与独立专栏',
        icon: 'fas fa-building-columns',
        colorClass: 'bg-blue',
        path: '/my-dyh',
        tags: ['看看号', '媒体', '专栏'],
      },
      {
        id: 'headline_cat',
        title: '头条快讯要闻',
        shortDesc: '要闻聚合',
        desc: '精选科技要闻、官方头条榜单与行业新鲜事',
        icon: 'fas fa-newspaper',
        colorClass: 'bg-orange',
        path: '/headline',
        tags: ['头条', '新闻', '快讯'],
      },
    ],
  },
  {
    id: 'lifestyle',
    title: '福利、活动与好物',
    desc: '官方权益、好物折扣与社区活动',
    icon: 'fas fa-gift',
    items: [
      {
        id: 'goods_cat',
        title: '好物推荐',
        shortDesc: '精选好物',
        desc: '真实好物口碑排行榜、折扣爆料与值得买清单',
        icon: 'fas fa-gift',
        colorClass: 'bg-orange',
        path: '/goods',
        tags: ['好物', '折扣', '特惠'],
      },
      {
        id: 'center_cat',
        title: '酷安中心',
        shortDesc: '官方权益',
        desc: '创作者收益、官方活动中心、身份头衔认证',
        icon: 'fas fa-shapes',
        colorClass: 'bg-green',
        path: '/center',
        tags: ['中心', '创作者', '活动'],
      },
      {
        id: 'events_cat',
        title: '酷友圈活动',
        shortDesc: '有奖活动',
        desc: '参与官方有奖征文、话题打卡与众测评测试用',
        icon: 'fas fa-trophy',
        colorClass: 'bg-red',
        path: '/events',
        tags: ['活动', '酷友圈活动', '活动中心', '征文', '抽奖'],
      },
    ],
  },
  {
    id: 'tools',
    title: '实用工具与清单',
    desc: '高效小工具与自定义管理',
    icon: 'fas fa-toolbox',
    items: [
      {
        id: 'anylist_cat',
        title: '全能清单 AnyList',
        shortDesc: '清单管理',
        desc: '创建并管理你的个性化清单、游戏排行与待办汇总',
        icon: 'fas fa-list-check',
        colorClass: 'bg-teal',
        path: '/anylist',
        tags: ['清单', 'anylist', '管理'],
      },
      {
        id: 'blacklist_cat',
        title: '黑名单管理',
        shortDesc: '屏蔽管理',
        desc: '管理屏蔽的用户、动态与标签，净化浏览体验',
        icon: 'fas fa-user-slash',
        colorClass: 'bg-gray',
        path: '/blacklist',
        tags: ['黑名单', '屏蔽', '隐私'],
      },
    ],
  },
];

// 计算全部服务数量
const allItems = computed(() => {
  const list: HubItem[] = [];
  const addedIds = new Set<string>();

  for (const cat of hubCategories) {
    for (const item of cat.items) {
      if (!addedIds.has(item.title)) {
        addedIds.add(item.title);
        list.push(item);
      }
    }
  }
  return list;
});

const allItemsCount = computed(() => allItems.value.length);

// 搜索过滤逻辑
const filteredSearchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return [];

  return allItems.value.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(query);
    const descMatch = item.desc.toLowerCase().includes(query);
    const tagMatch = item.tags?.some((t) => t.toLowerCase().includes(query));
    return titleMatch || descMatch || tagMatch;
  });
});
</script>

<style scoped>
.more-page-container {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 24px 32px 64px 32px;
  background-color: var(--background);
  color: var(--text-primary);
  box-sizing: border-box;
}

/* 顶部 Header */
.more-header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hub-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--brand-soft);
  color: var(--brand-primary);
  font-size: 18px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.hub-count-tag {
  font-size: 12px;
  color: var(--text-tertiary);
  background-color: var(--surface-hover);
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.page-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

/* 搜索框 */
.search-bar-wrapper {
  position: relative;
  width: 280px;
  flex-shrink: 0;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  font-size: 13px;
}

.hub-search-input {
  width: 100%;
  height: 38px;
  padding: 0 32px 0 34px;
  border-radius: var(--radius-control, 10px);
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all var(--duration-fast, 0.15s) ease;
  box-sizing: border-box;
}

.hub-search-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.clear-search-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  font-size: 12px;
}

.clear-search-btn:hover {
  color: var(--text-primary);
}

/* 核心常用金刚区（主页同款大圆图标） */
.hub-section {
  margin-bottom: 32px;
}

.featured-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: var(--shadow-sm);
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.fire-icon {
  color: #f97316;
}

.cat-icon {
  color: var(--brand-primary);
  font-size: 15px;
}

.section-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-tertiary);
}

/* 金刚区网格 */
.featured-icons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 12px 8px;
}

.featured-btn-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  border: none;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.featured-btn-item:hover {
  background-color: var(--surface-hover);
  transform: translateY(-2px);
}

.featured-icon-circle {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--brand-primary, #10b981);
  background-color: var(--brand-soft, rgba(16, 185, 129, 0.1));
  box-shadow: none;
  transition: transform 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}

.featured-btn-item:hover .featured-icon-circle {
  transform: scale(1.08);
  background-color: var(--brand-primary, #10b981);
  color: #ffffff;
}

.featured-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 分类板块容器 */
.categories-container {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* 分类卡片网格 */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.hub-card-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  min-height: 54px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  box-sizing: border-box;
}

.hub-card-item:hover,
.hub-card-item:focus-visible {
  border-color: var(--brand-primary);
  background-color: var(--surface-elevated, var(--surface));
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(16, 185, 129, 0.08);
}

.hub-icon-circle {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--text-secondary);
  background-color: var(--surface-hover);
  transition: all 0.2s ease;
}

.hub-card-item:hover .hub-icon-circle {
  color: var(--brand-primary, #10b981);
  background-color: var(--brand-soft, rgba(16, 185, 129, 0.12));
}

.hub-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.hub-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hub-card-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--danger, #ef4444);
  color: #ffffff;
  font-weight: 600;
}

.hub-card-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hub-card-arrow {
  color: var(--text-tertiary);
  font-size: 12px;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.hub-card-item:hover .hub-card-arrow {
  opacity: 1;
  color: var(--brand-primary);
  transform: translateX(2px);
}

/* 空搜索状态 */
.empty-search-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--text-tertiary);
  gap: 12px;
}

.empty-icon {
  font-size: 40px;
  opacity: 0.4;
}

.empty-text {
  font-size: 14px;
}

@media (max-width: 900px) {
  .more-page-container {
    padding: 18px 20px 48px 20px;
  }
  .more-header-section {
    flex-direction: column;
    align-items: stretch;
  }
  .search-bar-wrapper {
    width: 100%;
  }
}
</style>
