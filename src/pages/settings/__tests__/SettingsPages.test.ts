import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCacheInfo: vi.fn().mockResolvedValue({ bytes: 52.8 * 1024 * 1024, imageBytes: 48.4 * 1024 * 1024, webviewBytes: 0, updateBytes: 4.4 * 1024 * 1024, path: 'C:\\Cache' }),
  clearAppCache: vi.fn().mockResolvedValue({ bytes: 0 }),
  cleanExpiredCache: vi.fn().mockResolvedValue(undefined),
  openCacheDirectory: vi.fn().mockResolvedValue('C:\\Cache'),
  getHitHistory: vi.fn().mockResolvedValue({ data: [] }),
  getFavoriteList: vi.fn().mockResolvedValue({ data: [] }),
  exportJsonFile: vi.fn().mockResolvedValue('C:\\Downloads\\export.json'),
  openUrl: vi.fn().mockResolvedValue(undefined),
  listAccounts: vi.fn().mockResolvedValue({ data: [] }),
  getUserCookie: vi.fn().mockResolvedValue(''),
  open: vi.fn().mockResolvedValue(null),
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));
vi.mock('../../../utils/resourceCache', () => ({
  clearResourceCache: vi.fn().mockResolvedValue(undefined),
  clearResourceMemoryCache: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/plugin-autostart', () => ({ enable: mocks.enable, disable: mocks.disable, isEnabled: mocks.isEnabled }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));

import AppearanceSettingsPage from '../AppearanceSettingsPage.vue';
import AccountSettingsPage from '../AccountSettingsPage.vue';
import AboutSettingsPage from '../AboutSettingsPage.vue';
import ContentSettingsPage from '../ContentSettingsPage.vue';
import DeviceSettingsPage from '../DeviceSettingsPage.vue';
import DownloadSettingsPage from '../DownloadSettingsPage.vue';
import NotificationSettingsPage from '../NotificationSettingsPage.vue';
import PrivacySettingsPage from '../PrivacySettingsPage.vue';
import StartupSettingsPage from '../StartupSettingsPage.vue';
import SettingsLayout from '../SettingsLayout.vue';
import ShortcutSettingsPage from '../ShortcutSettingsPage.vue';
import { useSettingsStore } from '../../../stores/settings';

function mountPage(component: Parameters<typeof mount>[0]) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(component, { global: { plugins: [pinia] } });
  return { wrapper, settings: useSettingsStore(pinia) };
}

describe('设置页面交互', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('外观页覆盖主题、强调色、字号、密度和栏目显隐', async () => {
    const { wrapper, settings } = mountPage(AppearanceSettingsPage);
    await wrapper.findAll('.theme-card')[1].trigger('click');
    await wrapper.findAll('.accent-swatch')[1].trigger('click');
    await wrapper.findAll('.density-card')[2].trigger('click');
    await wrapper.findAll('.zoom-btn')[3].trigger('click');
    await wrapper.find('.nav-toggle-card input').setValue(false);
    expect(settings.settings.theme).toBe('dark');
    expect(settings.settings.accentColor).toBe('blue');
    expect(settings.settings.density).toBe('compact');
    expect(settings.settings.fontSize).toBe(16);
    expect(settings.settings.navVisibility?.home).toBe(false);
  });

  it('内容页覆盖正文、评论、链接和关键词设置', async () => {
    const { wrapper, settings } = mountPage(ContentSettingsPage);
    const selects = wrapper.findAll('select');
    await selects[0].setValue('18');
    await wrapper.get('.pill-btn:last-child').trigger('click');
    await wrapper.get('.text-input').setValue('广告');
    await wrapper.get('.keyword-input-row button').trigger('click');
    await wrapper.get('.text-input').setValue('广告');
    await wrapper.get('.keyword-input-row button').trigger('click');
    expect(settings.settings.collapseLines).toBe(18);
    expect(settings.settings.commentSort).toBe('latest');
    expect(settings.settings.blockedKeywords).toEqual(['广告']);
    await wrapper.get('.chip-remove').trigger('click');
    expect(settings.settings.blockedKeywords).toEqual([]);
  });

  it('通知页覆盖通知开关和轮询间隔', async () => {
    const { wrapper, settings } = mountPage(NotificationSettingsPage);
    const switches = wrapper.findAll('.switch-input');
    await switches[3].setValue(true);
    await wrapper.find('select').setValue('30');
    expect(settings.settings.desktopNotifications).toBe(true);
    expect(settings.settings.notificationPollInterval).toBe(30);
  });

  it('隐私页同步设备签名', async () => {
    const { wrapper, settings } = mountPage(PrivacySettingsPage);
    await wrapper.get('.text-input').setValue('测试设备');
    expect(settings.settings.deviceSignature).toBe('测试设备');
  });

  it('启动页覆盖首页、关闭行为、更新渠道和窗口行为', async () => {
    const { wrapper, settings } = mountPage(StartupSettingsPage);
    const selects = wrapper.findAll('select');
    await selects[0].setValue('secondhand');
    await selects[2].setValue('tray');
    await wrapper.findAll('.switch-input')[3].setValue(true);
    await selects[1].setValue('beta');
    await wrapper.findAll('.switch-input')[4].setValue(true);
    expect(settings.settings.defaultHomeTab).toBe('secondhand');
    expect(settings.settings.closeToTray).toBe(true);
    expect(settings.settings.experimentalFeatures).toBe(true);
    expect(settings.settings.updateChannel).toBe('beta');
    expect(settings.settings.alwaysOnTop).toBe(true);
  });

  it('设备页覆盖设备指纹输入、预设、警告和恢复默认', async () => {
    const { wrapper, settings } = mountPage(DeviceSettingsPage);
    await flushPromises();
    await wrapper.find('.switch-input').setValue(true);
    const inputs = wrapper.findAll('input[type="text"]');
    await inputs[0].setValue('2211133C');
    await wrapper.get('select').setValue('2211133C');
    expect(settings.settings.deviceFingerprint.model).toBe('2211133C');
    expect(settings.settings.deviceFingerprint.androidVersion).toBe('15');
    await inputs[4].setValue('2600000');
    expect(wrapper.find('.version-warning').exists()).toBe(true);
    await wrapper.get('.reset-button').trigger('click');
    expect(settings.settings.deviceFingerprint.model).toBe('23113RKC6C');
    expect(settings.settings.deviceFingerprint.appCode).toBe('2604201');
  });

  it('下载页展示缓存总量与明细', async () => {
    const { wrapper } = mountPage(DownloadSettingsPage);
    await flushPromises();
    expect(wrapper.get('.cache-total-value').text()).toContain('52.8 MB');
    expect(wrapper.get('.cache-breakdown').text()).toContain('图片');
    expect(wrapper.get('.cache-breakdown').text()).toContain('48.4 MB');
    expect(mocks.getCacheInfo).toHaveBeenCalled();
  });

  it('设置布局展示全部设置分类', () => {
    const { wrapper } = mountPage(SettingsLayout);
    expect(wrapper.findAll('.settings-menu-item')).toHaveLength(10);
    expect(wrapper.text()).toContain('账号与安全');
    expect(wrapper.text()).toContain('设备信息');
  });

  it('快捷键页展示全部快捷键', () => {
    const { wrapper } = mountPage(ShortcutSettingsPage);
    expect(wrapper.findAll('.setting-row')).toHaveLength(7);
    expect(wrapper.text()).toContain('Ctrl + K');
    expect(wrapper.text()).toContain('Esc');
  });

  it('关于页展示版本信息并支持打开链接和检查更新', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ stargazers_count: 1200, forks_count: 12, open_issues_count: 3 }) }));
    const eventSpy = vi.spyOn(window, 'dispatchEvent');
    const { wrapper } = mountPage(AboutSettingsPage);
    await flushPromises();
    expect(wrapper.text()).toContain('1.6.0');
    expect(wrapper.text()).toContain('1.2k');
    await wrapper.get('.about-head button').trigger('click');
    expect(eventSpy).toHaveBeenCalled();
    await wrapper.find('[title="打开项目主页"]').trigger('click');
    expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/daimiaopeng/coolapk-desktop', 'system');
    vi.unstubAllGlobals();
  });

  it('账号页在没有本地账户时展示空状态', async () => {
    const { wrapper } = mountPage(AccountSettingsPage);
    await flushPromises();
    expect(wrapper.text()).toContain('暂无保存的账户');
    expect(mocks.listAccounts).toHaveBeenCalled();
  });
});
