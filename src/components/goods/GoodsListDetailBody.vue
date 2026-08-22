<template>
  <div class="page-container custom-scrollbar" @scroll="handleScroll">
    <div v-if="loading && !feed" class="state-wrapper">
      <LoadingState text="正在加载好物详情..." />
    </div>

    <div v-else-if="error && !feed" class="state-wrapper">
      <ErrorState title="加载失败" :message="error" @retry="loadAll(true)" />
    </div>

    <template v-else-if="feed">
      <div class="detail-card">
        <div class="detail-cover">
          <AppImage
            v-if="coverUrl"
            :src="coverUrl"
            image-class="detail-cover-img"
            fit="cover"
          />
          <div v-else class="detail-cover-fallback">
            <i class="fas fa-gift"></i>
          </div>
        </div>

        <div class="detail-info">
          <div class="detail-badges">
            <span class="kind-badge">
              <i :class="kind === 'ranking' ? 'fas fa-trophy' : 'fas fa-gift'"></i>
              {{ kind === 'ranking' ? '好物榜' : '好物清单' }}
            </span>
            <span v-if="openVote" class="vote-badge">
              <i class="fas fa-poll"></i> 公开投票
            </span>
          </div>
          <h2 class="detail-title">{{ infoTitle || '未命名好物' }}</h2>
          <div v-if="infoMessage" class="detail-message" v-html="formattedMessage" @click="handleAnchorClick"></div>

          <FeedHeader
            :uid="feedUid"
            :avatar="feedAvatar"
            :username="feedUsername"
            :level="feedUserInfo?.level"
            :verify-title="feedUserInfo?.verify_title"
            :dateline="feed.dateline"
            :show-device-info="false"
          />

          <div class="detail-stats">
            <span v-if="itemNum > 0"><i class="fas fa-box-open"></i> {{ itemNum }} 件好物</span>
            <span v-if="voteNum > 0"><i class="fas fa-thumbs-up"></i> {{ voteNum }} 票</span>
            <span v-if="votePersonNum > 0"><i class="far fa-user"></i> {{ votePersonNum }} 人投过</span>
            <span v-if="followNum > 0"><i class="far fa-heart"></i> {{ followNum }} 关注</span>
            <span v-if="replyNum > 0"><i class="far fa-comment"></i> {{ replyNum }} 回复</span>
          </div>

          <div class="detail-actions">
            <AppButton v-if="isOwner" size="sm" variant="secondary" icon="fas fa-pen" @click="openEdit">
              编辑
            </AppButton>
            <AppButton v-if="isOwner" size="sm" variant="soft" icon="fas fa-plus" @click="pickerOpen = true">
              添加好物
            </AppButton>
          </div>
        </div>
      </div>

      <div class="items-section">
        <div class="section-header">
          <h3 class="section-title">榜单内容</h3>
          <span class="section-count">{{ items.length }} 件</span>
        </div>

        <div v-if="loading && items.length === 0" class="state-wrapper is-small">
          <LoadingState text="正在加载榜单内容..." />
        </div>

        <div v-else-if="error && items.length === 0" class="state-wrapper is-small">
          <ErrorState title="榜单内容加载失败" :message="error" @retry="loadItems()" />
        </div>

        <div v-else-if="items.length === 0" class="state-wrapper is-small">
          <EmptyState title="清单还没有内容" description="点击右上角添加好物，收录第一件好物" />
        </div>

        <div v-else class="items-list">
          <GoodsListItemCard
            v-for="item in items"
            :key="itemKey(item)"
            :item="item"
            :goods-list-id="goodsListId"
            :can-manage="isOwner"
            :can-vote="kind === 'ranking'"
            @vote="handleVote"
            @edit="openItemEdit"
            @delete="removeItem"
          />
        </div>
      </div>

      <div class="replies-section">
        <div class="section-header">
          <h3 class="section-title">回复</h3>
        </div>
        <FeedCommentSection
          v-if="replyReady"
          :feed-id="feedId"
          :feed-uid="feedUid"
          :feed-username="feedUsername"
          :comments="comments"
          :loading="commentsLoading"
          :normalize-img="(u) => u"
          :format-rich-text="formatRichText"
          @retry-comments="loadComments"
        />
        <div v-else class="state-wrapper is-small">
          <AppButton size="sm" variant="ghost" @click="loadComments">加载回复</AppButton>
        </div>
      </div>
    </template>

    <GoodsSearchPickerDialog
      :is-open="pickerOpen"
      @close="pickerOpen = false"
      @pick="handlePickGoods"
    />

    <AppDialog :is-open="itemEditOpen" title="编辑商品备注" :width="420" @close="closeItemEdit">
      <div class="item-edit-body">
        <textarea
          v-model="itemEditNote"
          class="text-area"
          rows="3"
          placeholder="为这件好物写点备注"
          maxlength="200"
        ></textarea>
      </div>
      <template #footer>
        <AppButton variant="ghost" :disabled="itemEditSaving" @click="closeItemEdit">取消</AppButton>
        <AppButton variant="primary" :loading="itemEditSaving" @click="saveItemEdit">保存</AppButton>
      </template>
    </AppDialog>

    <CreateGoodsListDialog
      :is-open="editListOpen"
      :kind="kind"
      :editing="feed?.goodsListInfo"
      @close="editListOpen = false"
      @created="handleListEdited"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppButton from '../common/AppButton.vue';
import AppImage from '../common/AppImage.vue';
import AppDialog from '../common/AppDialog.vue';
import LoadingState from '../common/LoadingState.vue';
import ErrorState from '../common/ErrorState.vue';
import EmptyState from '../common/EmptyState.vue';
import FeedHeader from '../feed/FeedHeader.vue';
import FeedCommentSection from '../feed/FeedCommentSection.vue';
import GoodsListItemCard from './GoodsListItemCard.vue';
import GoodsSearchPickerDialog from './GoodsSearchPickerDialog.vue';
import CreateGoodsListDialog from './CreateGoodsListDialog.vue';
import { renderCoolapkRichText } from '../../utils/richText';
import { handleAnchorClick } from '../../utils/anchorClick';
import { getReplyData } from '../../utils/commentList';
import { useAuthStore } from '../../stores/auth';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';

const props = withDefaults(
  defineProps<{
    feedId: string;
    kind?: 'lists' | 'ranking';
  }>(),
  {
    kind: 'lists',
  },
);

const authStore = useAuthStore();

const feed = ref<any>(null);
const loading = ref(false);
const error = ref('');

const items = ref<any[]>([]);

const comments = ref<any[]>([]);
const commentsLoading = ref(false);
const replyReady = ref(false);

const pickerOpen = ref(false);
const itemEditOpen = ref(false);
const itemEditNote = ref('');
const itemEditTarget = ref<any>(null);
const itemEditSaving = ref(false);
const editListOpen = ref(false);

const info = computed(() => feed.value?.goodsListInfo || feed.value || {});

const goodsListId = computed(() => String(info.value?.id ?? props.feedId));

const coverUrl = computed(() =>
  info.value?.cover
    || info.value?.coverPic
    || info.value?.logo
    || info.value?.pic
    || feed.value?.pic
    || '',
);

const infoTitle = computed(() => info.value?.title || feed.value?.title || '');

const infoMessage = computed(() =>
  info.value?.message
    || info.value?.description
    || info.value?.sort_message
    || '',
);

const feedUid = computed(() => feed.value?.uid || feed.value?.userInfo?.uid || '');
const feedUsername = computed(() => feed.value?.username || feed.value?.userInfo?.username || '');
const feedAvatar = computed(() => feed.value?.userAvatar || feed.value?.userInfo?.userAvatar || '');
const feedUserInfo = computed(() => feed.value?.userInfo || {});

const itemNum = computed(() => Number(info.value?.item_num || 0));
const voteNum = computed(() => Number(info.value?.vote_num || 0));
const votePersonNum = computed(() => Number(info.value?.vote_person_num || 0));
const followNum = computed(() => Number(info.value?.follow_num || 0));
const replyNum = computed(() => Number(info.value?.reply_num || 0));

const openVote = computed(() => {
  const value = info.value?.is_open_vote;
  return value === true || value === 1 || value === '1';
});

const isOwner = computed(() => {
  const currentUid = authStore.isLoggedIn ? String(authStore.user?.uid || '') : '';
  return Boolean(currentUid) && String(feedUid.value) === currentUid;
});

const formattedMessage = computed(() => {
  if (!infoMessage.value) return '';
  return renderCoolapkRichText(infoMessage.value);
});

function itemKey(item: any): string {
  return String(item?.id ?? item?.entityId ?? item?.feed_id ?? `${item?.product_goods_id}-${item?.dateline}`);
}

function sortedItems(list: any[]): any[] {
  if (props.kind !== 'ranking') return list;
  return [...list].sort((a: any, b: any) => Number(b?.vote_num || 0) - Number(a?.vote_num || 0));
}

async function loadFeed() {
  loading.value = true;
  error.value = '';
  try {
    const res = await CoolapkTauriAPI.getFeedDetail(props.feedId);
    const detail = res?.data || res || null;
    feed.value = detail;
    // 好物清单/好物榜的商品条目随 Feed 详情返回（Feed.goodsListItem）。
    // 注意：不要使用 goodsList/list 兜底，该接口忽略 goodsId，返回的是全局好物清单列表，
    // 会导致榜单内容显示成其他榜单（与当前清单无关）。
    const embedded = Array.isArray((detail as any)?.goodsListItem) ? (detail as any).goodsListItem : [];
    items.value = sortedItems(embedded);
  } catch (err: any) {
    error.value = err?.message || '好物详情加载失败';
  } finally {
    loading.value = false;
  }
}

async function loadItems() {
  // 商品条目随 Feed 详情返回；重新拉取详情以刷新投票最新数值。
  return loadFeed();
}

async function loadComments() {
  commentsLoading.value = true;
  replyReady.value = true;
  try {
    const res = await CoolapkTauriAPI.getFeedReplies(props.feedId, 1);
    comments.value = getReplyData(res);
  } catch (err) {
    console.warn('加载回复失败', err);
  } finally {
    commentsLoading.value = false;
  }
}

function loadAll(isRefresh = false) {
  void loadFeed();
}

function handleScroll() {
  // 商品条目随 Feed 详情一次性返回，无需滚动分页。
}

function handleVote(_item: any, _value: number) {
  // 投票成功后的本地刷新，确保 isVote/vote_num 与后台一致
  void loadItems();
}

async function removeItem(item: any) {
  const goodsId = String(item?.product_goods_id ?? '');
  const cancelFeedId = String(item?.feed_id ?? props.feedId);
  if (!goodsId) {
    showToast('缺少商品参数', 'error');
    return;
  }
  try {
    await CoolapkTauriAPI.deleteGoodsListItems(cancelFeedId, goodsId);
    items.value = items.value.filter((i) => itemKey(i) !== itemKey(item));
    showToast('已移除该好物', 'success');
  } catch (err) {
    showToast(getErrorMessage(err, '移除失败'), 'error');
  }
}

function openItemEdit(item: any) {
  itemEditTarget.value = item;
  itemEditNote.value = item?.note || '';
  itemEditOpen.value = true;
}

function closeItemEdit() {
  if (itemEditSaving.value) return;
  itemEditOpen.value = false;
  itemEditTarget.value = null;
  itemEditNote.value = '';
}

async function saveItemEdit() {
  if (itemEditSaving.value) return;
  const item = itemEditTarget.value;
  if (!item) return;
  itemEditSaving.value = true;
  try {
    await CoolapkTauriAPI.editGoodsListItem({
      feedId: String(item?.feed_id ?? props.feedId),
      goodsId: String(item?.product_goods_id ?? ''),
      note: itemEditNote.value.trim(),
      pic: item?.product_goods_cover || item?.pic || '',
    });
    item.note = itemEditNote.value.trim();
    closeItemEdit();
    showToast('已保存', 'success');
  } catch (err) {
    showToast(getErrorMessage(err, '保存失败'), 'error');
  } finally {
    itemEditSaving.value = false;
  }
}

async function handlePickGoods(goods: any) {
  const goodsId = String(goods?.id ?? '');
  if (!goodsId) {
    showToast('商品 ID 缺失', 'error');
    return;
  }
  try {
    await CoolapkTauriAPI.addGoodsToGoodsList({
      feedId: goodsListId.value,
      goodsId,
      note: '',
      pic: goods?.goods_pic || '',
    });
    pickerOpen.value = false;
    showToast('已添加好物', 'success');
    void loadItems();
  } catch (err) {
    showToast(getErrorMessage(err, '添加失败'), 'error');
  }
}

function openEdit() {
  editListOpen.value = true;
}

function handleListEdited() {
  editListOpen.value = false;
  void loadFeed();
}

function formatRichText(text: string) {
  if (!text) return '';
  return renderCoolapkRichText(text);
}

void loadAll(true);
</script>

<style scoped>
.page-container {
  width: 100%;
  max-width: var(--feed-max-width);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-5);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.state-wrapper {
  padding: var(--space-10) 0;
}

.state-wrapper.is-small {
  padding: var(--space-6) 0;
}

.detail-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-cover {
  width: 100%;
  height: 200px;
  background-color: var(--background-secondary);
  position: relative;
}

.detail-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 48px;
}

.detail-info {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.detail-badges {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.kind-badge,
.vote-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--font-size-caption);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
}

.kind-badge {
  background-color: var(--brand-soft);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
}

.vote-badge {
  background-color: var(--background-secondary);
  color: var(--text-secondary);
}

.detail-title {
  font-size: var(--font-size-title-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.detail-message {
  font-size: var(--font-size-body);
  color: var(--text-primary);
  line-height: var(--line-height-body);
}

.detail-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--text-tertiary);
  font-size: var(--font-size-caption);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-light);
}

.detail-actions {
  display: flex;
  gap: var(--space-2);
}

.items-section,
.replies-section {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.section-title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.section-count {
  font-size: var(--font-size-caption);
  color: var(--text-tertiary);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.item-edit-body {
  padding: var(--space-2) 0;
}

.text-area {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background-color: var(--surface);
  color: var(--text-primary);
  font-size: var(--font-size-sub);
  padding: 8px 12px;
  outline: none;
  resize: vertical;
  font-family: inherit;
}

.text-area:focus {
  border-color: var(--brand-primary);
}
</style>