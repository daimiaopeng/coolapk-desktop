<template>
  <div :class="['page-container', { 'is-embedded': embedded }]" class="custom-scrollbar">
    <div v-if="!embedded" class="page-header">
      <div class="header-main">
        <div class="header-titles"><h2 class="page-title"><i class="fas fa-layer-group icon"></i> 我的专辑</h2><span class="page-subtitle">管理账号创建的应用专辑，数据来自酷安云端</span></div>
        <div class="header-actions">
          <AppButton v-if="!embedded" variant="secondary" size="sm" icon="fas fa-sync-alt" :loading="loading" @click="loadAlbums">刷新</AppButton>
          <AppButton variant="primary" size="sm" icon="fas fa-plus" @click="openCreate">新建专辑</AppButton>
        </div>
      </div>
    </div>

    <div v-if="!authStore.isLoggedIn" class="empty-wrapper"><EmptyState title="登录后管理我的专辑" description="专辑列表和写入操作都需要酷安登录态" /><AppButton variant="primary" size="sm" @click="authStore.openLoginModal()">立即登录</AppButton></div>
    <template v-else>
      <div v-if="embedded" class="embedded-actions">
        <AppButton variant="primary" size="sm" icon="fas fa-plus" @click="openCreate">新建专辑</AppButton>
      </div>
      <LoadingState v-if="loading && !albums.length" text="正在读取我的专辑..." />
      <ErrorState v-else-if="error && !albums.length" title="专辑加载失败" :message="error" @retry="loadAlbums" />
      <EmptyState v-else-if="!albums.length" title="暂无我的专辑" description="创建一个专辑来整理常用应用" />
      <div v-else class="album-grid">
        <article v-for="album in albums" :key="albumId(album)" class="album-card" :class="{ active: selectedId === albumId(album) }" @click="selectAlbum(album)">
          <AppImage v-if="albumCover(album)" :src="albumCover(album)" class="album-cover" fit="cover" :alt="albumTitle(album)" />
          <div v-else class="album-cover album-cover-fallback"><i class="fas fa-layer-group"></i></div>
          <div class="album-info"><strong>{{ albumTitle(album) }}</strong><span>{{ album.intro || album.description || '暂无简介' }}</span><small>{{ Number(album.apkCount || album.apk_count || album.itemNum || 0) }} 个应用</small></div>
          <button type="button" class="edit-button" title="编辑专辑" @click.stop="openEdit(album)"><i class="fas fa-pen"></i></button>
        </article>
      </div>

      <section v-if="selectedAlbum" class="detail-panel">
        <div class="detail-header"><div><h3>{{ albumTitle(selectedAlbum) }}</h3><p>{{ selectedAlbum.intro || selectedAlbum.description || '暂无简介' }}</p></div><AppButton variant="secondary" size="sm" icon="fas fa-plus" @click="addApkOpen = true">添加应用</AppButton></div>
        <LoadingState v-if="detailLoading" text="正在读取专辑应用..." />
        <EmptyState v-else-if="!albumItems.length" title="专辑暂无应用" />
        <div v-else class="apk-list"><div v-for="item in albumItems" :key="String(item.packageName || item.package_name || item.id)" class="apk-row"><AppImage :src="item.logo || item.icon" class="apk-logo" fit="contain" alt="" /><span>{{ item.title || item.name || item.packageName }}</span><button type="button" class="remove-button" :disabled="actionLoading" @click="removeApk(item)"><i class="fas fa-trash"></i></button></div></div>
      </section>
    </template>

    <AppDialog :is-open="editorOpen" :title="editingId ? '编辑专辑' : '新建专辑'" :width="460" @close="editorOpen = false">
      <form class="album-form" @submit.prevent="saveAlbum"><label>标题<input v-model.trim="form.title" required maxlength="80" /></label><label>简介<textarea v-model.trim="form.intro" maxlength="300" rows="4"></textarea></label><label>封面<input type="file" accept="image/*" @change="uploadCover" /><span class="form-hint">{{ form.cover ? '已上传封面' : '可选，使用真实 uploadImage 接口' }}</span></label><div class="dialog-actions"><AppButton variant="secondary" type="button" @click="editorOpen = false">取消</AppButton><AppButton variant="primary" type="submit" :loading="actionLoading">保存</AppButton></div></form>
    </AppDialog>

    <AppDialog :is-open="addApkOpen" title="添加应用到专辑" :width="460" @close="addApkOpen = false">
      <form class="album-form" @submit.prevent="addApk"><label>包名<input v-model.trim="apkForm.packageName" required placeholder="com.example.app" /></label><label>应用名称<input v-model.trim="apkForm.title" required /></label><label>应用链接<input v-model.trim="apkForm.url" placeholder="https://www.coolapk.com/apk/..." /></label><div class="dialog-actions"><AppButton variant="secondary" type="button" @click="addApkOpen = false">取消</AppButton><AppButton variant="primary" type="submit" :loading="actionLoading">添加</AppButton></div></form>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AppButton from '../components/common/AppButton.vue';
import AppDialog from '../components/common/AppDialog.vue';
import AppImage from '../components/common/AppImage.vue';
import LoadingState from '../components/common/LoadingState.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { CoolapkTauriAPI } from '../api/coolapk';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const { embedded = false } = defineProps<{ embedded?: boolean }>();
const albums = ref<any[]>([]);
const selectedAlbum = ref<any>(null);
const selectedId = computed(() => selectedAlbum.value ? albumId(selectedAlbum.value) : '');
const albumItems = ref<any[]>([]);
const loading = ref(false);
const detailLoading = ref(false);
const actionLoading = ref(false);
const error = ref('');
const editorOpen = ref(false);
const addApkOpen = ref(false);
const editingId = ref('');
const form = ref({ title: '', intro: '', cover: '' });
const apkForm = ref({ packageName: '', title: '', url: '' });

function albumId(album: any) { return String(album?.id || album?.albumId || album?.album_id || album?.entityId || ''); }
function albumTitle(album: any) { return album?.title || album?.name || '未命名专辑'; }
function albumCover(album: any) { return album?.cover || album?.pic || album?.logo || ''; }

async function loadAlbums() {
  if (!authStore.user?.uid) return;
  loading.value = true; error.value = '';
  try { const res = await CoolapkTauriAPI.getUserAlbumList(String(authStore.user.uid)); albums.value = Array.isArray(res?.data) ? res.data : []; }
  catch (err: any) { error.value = err?.message || '加载失败，请检查网络'; }
  finally { loading.value = false; }
}

async function selectAlbum(album: any) {
  selectedAlbum.value = album; detailLoading.value = true; albumItems.value = [];
  try { const res = await CoolapkTauriAPI.getAlbumDetail(albumId(album)); const detail = res?.data || {}; selectedAlbum.value = { ...album, ...detail }; albumItems.value = Array.isArray(detail.apkList) ? detail.apkList : (Array.isArray(detail.data) ? detail.data : []); }
  catch (err: any) { error.value = err?.message || '读取专辑详情失败'; }
  finally { detailLoading.value = false; }
}

function openCreate() { editingId.value = ''; form.value = { title: '', intro: '', cover: '' }; editorOpen.value = true; }
function openEdit(album: any) { editingId.value = albumId(album); form.value = { title: albumTitle(album), intro: album.intro || album.description || '', cover: albumCover(album) }; editorOpen.value = true; }

async function uploadCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
  try { const res: any = await CoolapkTauriAPI.uploadImage(new Uint8Array(await file.arrayBuffer()), file.name, file.type, 'album'); form.value.cover = String(res?.data?.url || res?.data || ''); }
  catch (err: any) { error.value = err?.message || '封面上传失败'; }
}

async function saveAlbum() {
  actionLoading.value = true;
  try { if (editingId.value) await CoolapkTauriAPI.editAlbum(editingId.value, form.value.title, form.value.intro, form.value.cover); else await CoolapkTauriAPI.createAlbum(form.value.title, form.value.intro, form.value.cover); editorOpen.value = false; await loadAlbums(); }
  catch (err: any) { error.value = err?.message || '保存专辑失败'; }
  finally { actionLoading.value = false; }
}

async function addApk() {
  if (!selectedAlbum.value) return;
  actionLoading.value = true;
  try { await CoolapkTauriAPI.addAlbumApk(albumId(selectedAlbum.value), apkForm.value.packageName, apkForm.value.title, apkForm.value.url); addApkOpen.value = false; apkForm.value = { packageName: '', title: '', url: '' }; await selectAlbum(selectedAlbum.value); }
  catch (err: any) { error.value = err?.message || '添加应用失败'; }
  finally { actionLoading.value = false; }
}

async function removeApk(item: any) {
  if (!selectedAlbum.value) return;
  const packageName = String(item?.packageName || item?.package_name || ''); if (!packageName) return;
  actionLoading.value = true;
  try { await CoolapkTauriAPI.deleteAlbumApk(albumId(selectedAlbum.value), packageName); await selectAlbum(selectedAlbum.value); }
  catch (err: any) { error.value = err?.message || '移除应用失败'; }
  finally { actionLoading.value = false; }
}

watch(() => authStore.user?.uid, () => { if (authStore.isLoggedIn) void loadAlbums(); });
onMounted(() => { if (authStore.isLoggedIn) void loadAlbums(); });
</script>

<style scoped>
.page-container { width: 100%; height: 100%; overflow-y: auto; padding: var(--space-5); box-sizing: border-box; }
.page-container.is-embedded { height: auto; overflow: visible; padding: 0; }
.page-header { margin-bottom: var(--space-5); }
.embedded-actions { display: flex; justify-content: flex-end; padding: var(--space-3) var(--space-4) 0; }
.header-main, .header-actions, .detail-header, .dialog-actions { display: flex; align-items: center; gap: var(--space-3); }
.header-main, .detail-header { justify-content: space-between; }
.header-titles { display: flex; flex-direction: column; gap: 4px; }
.page-title { margin: 0; display: flex; align-items: center; gap: var(--space-3); color: var(--text-primary); font-size: var(--font-size-title-lg); }
.page-title .icon { color: var(--brand-primary); }
.page-subtitle, .detail-header p, .album-info span, .album-info small, .form-hint { color: var(--text-tertiary); font-size: var(--font-size-caption); }
.album-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-4); }
.album-card { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-card); background: var(--surface); cursor: pointer; }
.album-card.active, .album-card:hover { border-color: var(--brand-primary); }
.album-cover { width: 100%; height: 130px; object-fit: cover; background: var(--background); }
.album-cover-fallback { display: flex; align-items: center; justify-content: center; color: var(--brand-primary); font-size: 32px; }
.album-info { display: flex; flex-direction: column; gap: 6px; padding: var(--space-3); }
.album-info strong { color: var(--text-primary); }
.album-info span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.edit-button, .remove-button { border: 0; background: transparent; color: var(--text-tertiary); cursor: pointer; }
.edit-button { position: absolute; top: 10px; right: 10px; }
.edit-button:hover, .remove-button:hover { color: var(--danger); }
.detail-panel { margin-top: var(--space-5); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-card); background: var(--surface); }
.detail-header h3, .detail-header p { margin: 0; }
.detail-header p { margin-top: 4px; }
.apk-list { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-4); }
.apk-row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-control); background: var(--background); color: var(--text-primary); }
.apk-logo { width: 32px; height: 32px; }
.apk-row span { flex: 1; }
.album-form { display: flex; flex-direction: column; gap: var(--space-4); }
.album-form label { display: flex; flex-direction: column; gap: var(--space-2); color: var(--text-secondary); font-size: var(--font-size-sub); }
.album-form input, .album-form textarea { padding: 9px 10px; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--background); color: var(--text-primary); font: inherit; }
.dialog-actions { justify-content: flex-end; }
.empty-wrapper { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); padding: var(--space-10) 0; }
</style>
