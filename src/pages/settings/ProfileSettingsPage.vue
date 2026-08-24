<template>
  <div class="settings-section profile-settings">
    <div class="section-heading">
      <div>
        <h3 class="section-title">个人信息</h3>
        <p class="section-description">修改后会立即同步到酷安账号</p>
      </div>
      <span v-if="profile.uid" class="profile-uid">UID {{ profile.uid }}</span>
    </div>

    <div v-if="!authStore.isLoggedIn" class="login-card">
      <div class="login-card-icon"><i class="fas fa-user-circle"></i></div>
      <div class="login-card-info">
        <strong>登录后才能修改个人资料</strong>
        <span>头像、签名和其他资料会直接保存到酷安账号。</span>
      </div>
      <AppButton variant="primary" size="sm" @click="authStore.openLoginModal()">账号登录</AppButton>
    </div>

    <template v-else>
      <div v-if="loadingProfile" class="profile-loading">
        <i class="fas fa-circle-notch fa-spin"></i>
        正在读取个人资料...
      </div>

      <div v-else class="profile-content">
        <section class="profile-overview">
          <div class="profile-overview-main">
            <AppAvatar :src="profile.avatar || authStore.user?.userAvatar" size="xl" />
            <div class="profile-overview-text">
              <h4>{{ profile.username || '酷友' }}</h4>
              <p>{{ profile.bio || '还没有填写个性签名' }}</p>
            </div>
          </div>
          <span class="sync-hint"><i class="fas fa-bolt"></i> 即时保存</span>
        </section>

        <section class="profile-fields">
          <div class="profile-row profile-image-row">
            <div class="row-info">
              <span class="row-label">头像</span>
              <span class="row-sub">支持 JPG、PNG 等常见图片格式</span>
            </div>
            <div class="image-row-action">
              <AppAvatar :src="profile.avatar || authStore.user?.userAvatar" size="lg" />
              <AppButton variant="secondary" size="sm" :loading="savingField === 'avatar'" @click="selectAvatar">更换</AppButton>
              <input ref="avatarInput" class="hidden-file-input" type="file" accept="image/*" @change="handleAvatarSelected" />
            </div>
          </div>

          <div class="profile-row profile-cover-row">
            <div class="row-info">
              <span class="row-label">个人主页背景图</span>
              <span class="row-sub">用于个人主页顶部横幅</span>
            </div>
            <div class="cover-action">
              <div class="cover-preview">
                <AppImage v-if="profile.cover" :src="profile.cover" alt="个人主页背景图" image-class="cover-image" />
                <div v-else class="cover-placeholder"><i class="fas fa-image"></i><span>暂无背景图</span></div>
              </div>
              <AppButton variant="secondary" size="sm" :loading="savingField === 'cover'" @click="selectCover">更换</AppButton>
              <input ref="coverInput" class="hidden-file-input" type="file" accept="image/*" @change="handleCoverSelected" />
            </div>
          </div>

          <div class="profile-row">
            <div class="row-info">
              <span class="row-label">用户名</span>
              <span class="row-sub">用户名修改由酷安账号中心处理</span>
            </div>
            <div class="row-value-action">
              <span class="row-value">{{ profile.username || '未设置' }}</span>
              <AppButton variant="secondary" size="sm" @click="openUsernameChange">去修改</AppButton>
            </div>
          </div>

          <div class="profile-row">
            <div class="row-info">
              <span class="row-label">性别</span>
              <span class="row-sub">选择后立即保存</span>
            </div>
            <select v-model="profile.gender" class="field-select gender-select" :disabled="savingField === 'gender'" @change="saveGender">
              <option value="-1">未设置</option>
              <option value="0">女</option>
              <option value="1">男</option>
            </select>
          </div>

          <div class="profile-row">
            <div class="row-info">
              <span class="row-label">生日</span>
              <span class="row-sub">生日会自动用于计算星座</span>
            </div>
            <input v-model="profile.birthday" class="field-input date-input" type="date" :disabled="savingField === 'birthday'" @change="saveBirthday" />
          </div>

          <div class="profile-row">
            <div class="row-info">
              <span class="row-label">星座</span>
              <span class="row-sub">根据生日自动显示</span>
            </div>
            <span class="row-value muted-value">{{ displayAstro || '未设置' }}</span>
          </div>

          <div class="profile-row">
            <div class="row-info">
              <span class="row-label">城市</span>
              <span class="row-sub">展示在个人主页资料中</span>
            </div>
            <div class="row-value-action">
              <span class="row-value">{{ formatAddress(profile.province, profile.city) || '未设置' }}</span>
              <AppButton variant="secondary" size="sm" @click="openLocationDialog">编辑</AppButton>
            </div>
          </div>

          <div class="profile-row">
            <div class="row-info">
              <span class="row-label">签名</span>
              <span class="row-sub">最多 60 个字符</span>
            </div>
            <div class="row-value-action signature-action">
              <span class="row-value signature-value">{{ profile.bio || '还没有填写' }}</span>
              <AppButton variant="secondary" size="sm" @click="openSignatureDialog">编辑</AppButton>
            </div>
          </div>
        </section>
      </div>
    </template>

    <AppDialog :is-open="locationDialogOpen" title="修改城市" :width="440" @close="closeLocationDialog">
      <div class="dialog-form">
        <label class="dialog-field">
          <span>省份</span>
          <select v-model="locationDraft.province" class="field-select location-select" @change="handleProvinceChange">
            <option value="">请选择省份</option>
            <option v-for="province in provinceOptions" :key="province" :value="province">{{ province }}</option>
          </select>
        </label>
        <label class="dialog-field">
          <span>城市</span>
          <select v-model="locationDraft.city" class="field-select location-select" :disabled="!locationDraft.province || !cityOptions.length">
            <option value="">请选择城市</option>
            <option v-for="city in cityOptions" :key="city" :value="city">{{ city }}</option>
          </select>
        </label>
      </div>
      <template #footer>
        <AppButton variant="ghost" @click="closeLocationDialog">取消</AppButton>
        <AppButton variant="primary" :loading="savingField === 'location'" @click="saveLocation">保存</AppButton>
      </template>
    </AppDialog>

    <AppDialog :is-open="signatureDialogOpen" title="修改签名" :width="520" @close="closeSignatureDialog">
      <div class="dialog-form">
        <textarea v-model="signatureDraft" class="signature-input" maxlength="60" rows="4" placeholder="写一句介绍自己吧"></textarea>
        <div class="character-count">{{ signatureDraft.length }}/60</div>
      </div>
      <template #footer>
        <AppButton variant="ghost" @click="closeSignatureDialog">取消</AppButton>
        <AppButton variant="primary" :loading="savingField === 'bio'" @click="saveSignature">保存</AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import AppAvatar from '../../components/common/AppAvatar.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppDialog from '../../components/common/AppDialog.vue';
import AppImage from '../../components/common/AppImage.vue';
import { chinaRegions } from '../../data/chinaRegions';
import { useAuthStore } from '../../stores/auth';
import { getErrorMessage } from '../../utils/errors';
import { showToast } from '../../utils/toast';

interface EditableProfile {
  uid: string;
  username: string;
  avatar: string;
  cover: string;
  bio: string;
  gender: string;
  birthday: string;
  birthyear: number;
  birthmonth: number;
  birthdayDay: number;
  astro: string;
  province: string;
  city: string;
}

const authStore = useAuthStore();
const avatarInput = ref<HTMLInputElement | null>(null);
const coverInput = ref<HTMLInputElement | null>(null);
const loadingProfile = ref(false);
const savingField = ref('');
const profile = ref<EditableProfile>(createEmptyProfile());
const committedGender = ref('-1');
const committedBirthday = ref('');
const locationDialogOpen = ref(false);
const locationDraft = reactive({ province: '', city: '' });
const signatureDialogOpen = ref(false);
const signatureDraft = ref('');
const provinceOptions = Object.keys(chinaRegions);
const cityOptions = computed(() => chinaRegions[locationDraft.province] || []);
const displayAstro = computed(() => profile.value.astro || zodiacForBirthday(profile.value.birthmonth, profile.value.birthdayDay));

function createEmptyProfile(): EditableProfile {
  return { uid: '', username: '', avatar: '', cover: '', bio: '', gender: '-1', birthday: '', birthyear: 0, birthmonth: 0, birthdayDay: 0, astro: '', province: '', city: '' };
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function toInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeGender(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (raw === '男') return '1';
  if (raw === '女') return '0';
  if (raw === '-1' || raw === '0' || raw === '1') return raw;
  return '-1';
}

function formatBirthday(year: number, month: number, day: number): string {
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function zodiacForBirthday(month: number, day: number): string {
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const value = month * 100 + day;
  if (value >= 120 && value <= 218) return '水瓶座';
  if (value >= 219 && value <= 320) return '双鱼座';
  if (value >= 321 && value <= 419) return '白羊座';
  if (value >= 420 && value <= 520) return '金牛座';
  if (value >= 521 && value <= 621) return '双子座';
  if (value >= 622 && value <= 722) return '巨蟹座';
  if (value >= 723 && value <= 822) return '狮子座';
  if (value >= 823 && value <= 922) return '处女座';
  if (value >= 923 && value <= 1023) return '天秤座';
  if (value >= 1024 && value <= 1122) return '天蝎座';
  if (value >= 1123 && value <= 1221) return '射手座';
  if (value >= 1222 || value <= 119) return '摩羯座';
  return '';
}

function normalizeProfile(response: any): EditableProfile {
  const raw = response?.data && typeof response.data === 'object' ? response.data : response || {};
  const info = raw.userInfo && typeof raw.userInfo === 'object' ? raw.userInfo : {};
  const source = { ...info, ...raw };
  const birthyear = toInteger(source.birthyear ?? source.birthYear ?? source.birth_year);
  const birthmonth = toInteger(source.birthmonth ?? source.birthMonth ?? source.birth_month);
  const birthdayDay = toInteger(source.birthday ?? source.birthDay ?? source.birth_day);
  return {
    uid: firstString(source.uid, authStore.user?.uid),
    username: firstString(source.userName, source.username, source.displayUserName, source.displayUsername, authStore.user?.username),
    avatar: firstString(source.userAvatar, source.avatar, source.user_avatar, authStore.user?.userAvatar),
    cover: firstString(source.cover, source.coverUrl, source.userCover, source.background),
    bio: firstString(source.signature, source.bio, source.sign),
    gender: normalizeGender(source.gender),
    birthday: formatBirthday(birthyear, birthmonth, birthdayDay),
    birthyear,
    birthmonth,
    birthdayDay,
    astro: firstString(source.zodiacSign, source.zodiac, source.astro, source.constellation),
    province: firstString(source.province),
    city: firstString(source.city),
  };
}

function formatAddress(province: string, city: string): string {
  if (!province) return city;
  if (!city || province === city) return province;
  return `${province} ${city}`;
}

function stripProvinceSuffix(value: string): string {
  return value.replace(/(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省)$/u, '');
}

function stripCitySuffix(value: string): string {
  return value.replace(/(自治州|地区|盟|市|区|县)$/u, '');
}

function getLocationCandidates(province: string, city: string): Array<{ province: string; city: string }> {
  const normalizedProvince = stripProvinceSuffix(province);
  const normalizedCity = stripCitySuffix(city);
  const candidates = [
    { province, city },
    { province: normalizedProvince, city },
    { province: normalizedProvince, city: normalizedCity },
  ];
  return candidates.filter((candidate, index) => candidates.findIndex((item) => item.province === candidate.province && item.city === candidate.city) === index);
}

function isLocationValidationError(error: unknown): boolean {
  return /省份|城市|地址|地区|位置|正确/u.test(getErrorMessage(error, ''));
}

async function updateLocationProfile(province: string, city: string): Promise<void> {
  let lastError: unknown;
  for (const candidate of getLocationCandidates(province, city)) {
    try {
      await CoolapkTauriAPI.updateUserProfile('', JSON.stringify(candidate));
      return;
    } catch (error) {
      lastError = error;
      if (!isLocationValidationError(error)) throw error;
    }
  }
  throw lastError || new Error('城市更新失败');
}

function extractImageUrl(response: any): string {
  const data = response?.data ?? response;
  if (typeof data === 'string') return data.trim();
  if (!data || typeof data !== 'object') return '';
  return firstString(data.url, data.imageUrl, data.image_url, data.sourceUrl, data.source_url, data.path, data.userAvatar);
}

function authProfilePatch() {
  return {
    username: profile.value.username,
    userAvatar: profile.value.avatar,
    cover: profile.value.cover,
    bio: profile.value.bio,
    gender: Number(profile.value.gender),
    astro: displayAstro.value,
    zodiacSign: displayAstro.value,
    birthyear: profile.value.birthyear,
    birthmonth: profile.value.birthmonth,
    birthday: profile.value.birthdayDay,
    province: profile.value.province,
    city: profile.value.city,
  };
}

async function syncAuthProfile() {
  await authStore.updateCurrentUserProfile(authProfilePatch());
}

async function loadProfile() {
  const uid = String(authStore.user?.uid || '').trim();
  if (!uid) return;
  loadingProfile.value = true;
  try {
    const response = await CoolapkTauriAPI.getUserProfile(uid);
    profile.value = normalizeProfile(response);
    committedGender.value = profile.value.gender;
    committedBirthday.value = profile.value.birthday;
    void syncAuthProfile();
  } catch (error) {
    showToast(`读取个人资料失败：${getErrorMessage(error, '未知错误')}`, 'error');
  } finally {
    loadingProfile.value = false;
  }
}

function selectAvatar() {
  avatarInput.value?.click();
}

function selectCover() {
  coverInput.value?.click();
}

function validateImage(file: File): boolean {
  if (file.type && !file.type.startsWith('image/')) {
    showToast('请选择图片文件', 'error');
    return false;
  }
  if (file.size > 15 * 1024 * 1024) {
    showToast('图片不能超过 15 MB', 'error');
    return false;
  }
  return true;
}

async function handleAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !validateImage(file) || savingField.value) return;
  savingField.value = 'avatar';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const response = await CoolapkTauriAPI.changeAvatar(bytes, file.name, file.type || 'image/jpeg');
    const avatarUrl = extractImageUrl(response);
    if (avatarUrl) profile.value.avatar = avatarUrl;
    else await loadProfile();
    await syncAuthProfile();
    showToast('头像已更新');
  } catch (error) {
    showToast(`头像更新失败：${getErrorMessage(error, '未知错误')}`, 'error');
  } finally {
    savingField.value = '';
  }
}

async function handleCoverSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !validateImage(file) || savingField.value) return;
  savingField.value = 'cover';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploadResponse = await CoolapkTauriAPI.uploadImage(bytes, file.name, file.type || 'image/jpeg', 'cover');
    const coverUrl = extractImageUrl(uploadResponse);
    if (!coverUrl) throw new Error('图片上传接口未返回地址');
    await CoolapkTauriAPI.updateUserCover(coverUrl);
    profile.value.cover = coverUrl;
    await syncAuthProfile();
    showToast('个人主页背景图已更新');
  } catch (error) {
    showToast(`背景图更新失败：${getErrorMessage(error, '未知错误')}`, 'error');
  } finally {
    savingField.value = '';
  }
}

async function openUsernameChange() {
  try {
    await CoolapkTauriAPI.openUrl('https://account.coolapk.com/account/changeUsername', 'system');
  } catch (error) {
    showToast(`打开账号中心失败：${getErrorMessage(error, '未知错误')}`, 'error');
  }
}

async function saveGender() {
  const nextGender = profile.value.gender;
  const previousGender = committedGender.value;
  if (nextGender === previousGender || savingField.value) return;
  savingField.value = 'gender';
  try {
    await CoolapkTauriAPI.updateUserProfile('gender', nextGender);
    committedGender.value = nextGender;
    await syncAuthProfile();
    showToast('性别已更新');
  } catch (error) {
    profile.value.gender = previousGender;
    showToast(`性别更新失败：${getErrorMessage(error, '未知错误')}`, 'error');
  } finally {
    savingField.value = '';
  }
}

async function saveBirthday() {
  const nextBirthday = profile.value.birthday;
  const previousBirthday = committedBirthday.value;
  if (!nextBirthday || nextBirthday === previousBirthday || savingField.value) return;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nextBirthday);
  if (!match) return;
  const birthyear = Number(match[1]);
  const birthmonth = Number(match[2]);
  const birthdayDay = Number(match[3]);
  savingField.value = 'birthday';
  try {
    await CoolapkTauriAPI.updateUserProfile('', JSON.stringify({ birthyear, birthmonth, birthday: birthdayDay }));
    profile.value.birthyear = birthyear;
    profile.value.birthmonth = birthmonth;
    profile.value.birthdayDay = birthdayDay;
    profile.value.astro = zodiacForBirthday(birthmonth, birthdayDay);
    committedBirthday.value = nextBirthday;
    await syncAuthProfile();
    showToast('生日已更新');
  } catch (error) {
    profile.value.birthday = previousBirthday;
    showToast(`生日更新失败：${getErrorMessage(error, '未知错误')}`, 'error');
  } finally {
    savingField.value = '';
  }
}

const provinceAliases: Record<string, string> = { 香港特别行政区: '中国香港', 香港: '中国香港', 澳门特别行政区: '中国澳门', 澳门: '中国澳门', 台湾省: '中国台湾', 台湾: '中国台湾' };

function findProvinceOption(value: string): string {
  const candidate = provinceAliases[value] || value;
  return provinceOptions.find((option) => option === candidate || option === value || stripProvinceSuffix(option) === stripProvinceSuffix(candidate)) || '';
}

function findCityOption(province: string, value: string): string {
  return (chinaRegions[province] || []).find((option) => option === value || stripCitySuffix(option) === stripCitySuffix(value)) || '';
}

function openLocationDialog() {
  const province = findProvinceOption(profile.value.province);
  const city = province ? findCityOption(province, profile.value.city) : '';
  locationDraft.province = province;
  locationDraft.city = city;
  locationDialogOpen.value = true;
}

function handleProvinceChange() {
  locationDraft.city = cityOptions.value[0] || '';
}

function closeLocationDialog() {
  if (savingField.value !== 'location') locationDialogOpen.value = false;
}

async function saveLocation() {
  if (savingField.value === 'location') return;
  const province = locationDraft.province.trim();
  const city = locationDraft.city.trim();
  if (!province || !city) {
    showToast('请选择省份和城市', 'error');
    return;
  }
  const previousProvince = profile.value.province;
  const previousCity = profile.value.city;
  if (province === previousProvince && city === previousCity) {
    locationDialogOpen.value = false;
    return;
  }
  savingField.value = 'location';
  try {
    await updateLocationProfile(province, city);
    profile.value.province = province;
    profile.value.city = city;
    await syncAuthProfile();
    locationDialogOpen.value = false;
    showToast('城市已更新');
  } catch (error) {
    showToast(`城市更新失败：${getErrorMessage(error, '未知错误')}`, 'error');
  } finally {
    savingField.value = '';
  }
}

function openSignatureDialog() {
  signatureDraft.value = profile.value.bio;
  signatureDialogOpen.value = true;
}

function closeSignatureDialog() {
  if (savingField.value !== 'bio') signatureDialogOpen.value = false;
}

async function saveSignature() {
  if (savingField.value === 'bio') return;
  const bio = signatureDraft.value.trim();
  if (bio === profile.value.bio) {
    signatureDialogOpen.value = false;
    return;
  }
  savingField.value = 'bio';
  try {
    await CoolapkTauriAPI.updateUserProfile('bio', bio);
    profile.value.bio = bio;
    await syncAuthProfile();
    signatureDialogOpen.value = false;
    showToast('签名已更新');
  } catch (error) {
    showToast(`签名更新失败：${getErrorMessage(error, '未知错误')}`, 'error');
  } finally {
    savingField.value = '';
  }
}

onMounted(() => {
  void loadProfile();
});
</script>

<style scoped>
.profile-settings { gap: var(--space-5); }

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  border-bottom: 1px solid var(--border);
  padding-bottom: var(--space-3);
}

.section-title { margin: 0; border: 0; padding: 0; }
.section-description { margin: 5px 0 0; color: var(--text-tertiary); font-size: var(--font-size-caption); }
.profile-uid { color: var(--text-tertiary); font-size: var(--font-size-caption); padding-top: 4px; }

.login-card,
.profile-overview,
.profile-fields {
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
}

.login-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5);
}

.login-card-icon { color: var(--brand-primary); font-size: 28px; }
.login-card-info { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px; }
.login-card-info strong { color: var(--text-primary); font-size: var(--font-size-sub); }
.login-card-info span { color: var(--text-tertiary); font-size: var(--font-size-caption); }

.profile-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 220px;
  color: var(--text-secondary);
  font-size: var(--font-size-sub);
}

.profile-content { display: flex; flex-direction: column; gap: var(--space-4); }
.profile-overview { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-5); }
.profile-overview-main { display: flex; align-items: center; gap: var(--space-4); min-width: 0; }
.profile-overview-text { min-width: 0; }
.profile-overview-text h4 { margin: 0; color: var(--text-primary); font-size: var(--font-size-title-sm); }
.profile-overview-text p { margin: 6px 0 0; overflow: hidden; color: var(--text-secondary); font-size: var(--font-size-sub); text-overflow: ellipsis; white-space: nowrap; }
.sync-hint { flex-shrink: 0; color: var(--brand-primary); font-size: var(--font-size-caption); }
.sync-hint i { margin-right: 4px; }

.profile-fields { overflow: hidden; }
.profile-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); min-height: 72px; padding: var(--space-3) var(--space-5); border-bottom: 1px solid var(--border-light); }
.profile-row:last-child { border-bottom: 0; }
.row-info { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.row-label { color: var(--text-primary); font-size: var(--font-size-sub); font-weight: var(--font-weight-medium); }
.row-sub { color: var(--text-tertiary); font-size: var(--font-size-caption); }
.row-value { max-width: 260px; overflow: hidden; color: var(--text-secondary); font-size: var(--font-size-sub); text-overflow: ellipsis; white-space: nowrap; }
.muted-value { color: var(--text-tertiary); }
.row-value-action,
.image-row-action,
.cover-action { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); min-width: 0; }
.profile-image-row { min-height: 88px; }
.profile-cover-row { min-height: 104px; }
.hidden-file-input { display: none; }

.cover-preview { width: 156px; height: 68px; overflow: hidden; border: 1px solid var(--border-light); border-radius: var(--radius-control); background: var(--background); }
.cover-placeholder { display: flex; height: 100%; align-items: center; justify-content: center; gap: 6px; color: var(--text-tertiary); font-size: var(--font-size-caption); }
.cover-preview :deep(.cover-image) { width: 100%; height: 100%; }
.field-input,
.field-select,
.signature-input { box-sizing: border-box; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--surface); color: var(--text-primary); font: inherit; outline: none; transition: border-color var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default); }
.field-input:focus,
.field-select:focus,
.signature-input:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 3px var(--brand-soft); }
.field-input { width: 190px; height: 36px; padding: 0 10px; }
.field-select { width: 136px; height: 34px; padding: 0 8px; }
.gender-select { width: 72px; height: 30px; padding: 0 6px; font-size: 14px; }
.date-input { width: 142px; height: 30px; padding: 0 8px; font-size: 14px; }
.field-input:disabled,
.field-select:disabled { opacity: .6; }
.signature-action { max-width: 55%; }
.signature-value { max-width: 360px; }

.dialog-form { display: flex; flex-direction: column; gap: var(--space-4); }
.dialog-field { display: flex; flex-direction: column; gap: 7px; color: var(--text-secondary); font-size: var(--font-size-sub); }
.dialog-field .field-input,
.dialog-field .field-select { width: 100%; }
.location-select { height: 40px; }
.signature-input { width: 100%; min-height: 108px; padding: 10px 12px; resize: vertical; }
.character-count { align-self: flex-end; margin-top: -10px; color: var(--text-tertiary); font-size: var(--font-size-caption); }

@media (max-width: 720px) {
  .login-card,
  .profile-overview { align-items: flex-start; flex-wrap: wrap; }
  .profile-row { align-items: flex-start; flex-direction: column; gap: var(--space-2); }
  .row-value-action,
  .image-row-action,
  .cover-action { width: 100%; justify-content: flex-start; }
  .row-value { max-width: 100%; }
  .signature-action { max-width: 100%; }
  .cover-preview { width: min(100%, 260px); }
}
</style>
