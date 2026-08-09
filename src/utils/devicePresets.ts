/**
 * 设备机型预设：UA 机型（model/build/android）与常用设备显示名映射。
 * 注意：这里只控制 UA 机型外观，设备码（X-App-Device）由账号绑定，不在此列。
 */

export interface DevicePreset {
  /** 预设展示名 */
  label: string;
  /** 匹配 UserPage 动态 deviceTitle 的别名（常用设备一键应用） */
  aliases: string[];
  /** UA 内嵌机型代码，如 23113RKC6C（小米 14） */
  model: string;
  androidVersion: string;
  build: string;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    label: '小米 14',
    aliases: ['小米14', '小米 14', 'Xiaomi 14', '小米14 Pro', '小米 14 Pro', '23113RKC6C'],
    model: '23113RKC6C',
    androidVersion: '16',
    build: 'AQ3A.250226.002',
  },
  {
    label: '小米 13 Pro',
    aliases: ['小米13 Pro', '小米 13 Pro', 'Xiaomi 13 Pro', '2211133C'],
    model: '2211133C',
    androidVersion: '15',
    build: 'AQ3A.250226.002',
  },
  {
    label: '小米 15 Pro',
    aliases: ['小米15 Pro', '小米 15 Pro', 'Xiaomi 15 Pro', '25019PN48C'],
    model: '25019PN48C',
    androidVersion: '16',
    build: 'AQ3A.250226.002',
  },
  {
    label: 'Redmi K50 电竞版',
    aliases: ['Redmi K50 电竞版', '红米K50电竞版', 'Redmi K50 Gaming', '22041211AC'],
    model: '22041211AC',
    androidVersion: '15',
    build: 'AQ3A.250226.002',
  },
  {
    label: 'Redmi K80 Pro',
    aliases: ['Redmi K80 Pro', '红米K80 Pro', '24122RKC7C'],
    model: '24122RKC7C',
    androidVersion: '15',
    build: 'AQ3A.250226.002',
  },
  {
    label: 'Redmi K80',
    aliases: ['Redmi K80', '红米K80', '24117RK2CC'],
    model: '24117RK2CC',
    androidVersion: '15',
    build: 'AQ3A.250226.002',
  },
  {
    label: '三星 Galaxy S24 Ultra',
    aliases: ['三星Galaxy S24 Ultra', '三星 Galaxy S24 Ultra', 'Galaxy S24 Ultra', 'SM-S9280'],
    model: 'SM-S9280',
    androidVersion: '15',
    build: 'AQ3A.250226.002',
  },
  {
    label: '三星 Galaxy S25 Ultra',
    aliases: ['三星Galaxy S25 Ultra', '三星 Galaxy S25 Ultra', 'Galaxy S25 Ultra', 'SM-S9380'],
    model: 'SM-S9380',
    androidVersion: '16',
    build: 'AQ3A.250226.002',
  },
  {
    label: '一加 13',
    aliases: ['一加13', '一加 13', 'OnePlus 13', 'PJZ110'],
    model: 'PJZ110',
    androidVersion: '16',
    build: 'AQ3A.250226.002',
  },
  {
    label: 'OPPO Find X8',
    aliases: ['OPPO Find X8', 'OPPO Find X8 Pro', 'Find X8', 'PKB110'],
    model: 'PKB110',
    androidVersion: '15',
    build: 'AQ3A.250226.002',
  },
  {
    label: 'vivo X200 Pro',
    aliases: ['vivo X200 Pro', 'vivoX200 Pro', 'X200 Pro', 'V2405A'],
    model: 'V2405A',
    androidVersion: '16',
    build: 'AQ3A.250226.002',
  },
  {
    label: '华为 Mate 70 Pro',
    aliases: ['华为Mate 70 Pro', '华为 Mate 70 Pro', 'Mate 70 Pro', 'HBP-AL00'],
    model: 'HBP-AL00',
    androidVersion: '14',
    build: 'AQ3A.250226.002',
  },
  {
    label: 'Google Pixel 9 Pro',
    aliases: ['Pixel 9 Pro', 'Google Pixel 9 Pro', 'Pixel 9', 'comet'],
    model: 'comet',
    androidVersion: '16',
    build: 'AQ3A.250226.002',
  },
];

/** 用常用设备显示名（动态 deviceTitle）匹配预设，匹配不到返回 undefined */
export function findPresetByDeviceTitle(title: string): DevicePreset | undefined {
  const t = (title || '').trim();
  if (!t) return undefined;
  return DEVICE_PRESETS.find((p) =>
    p.aliases.some((a) => a.toLowerCase() === t.toLowerCase() || t.toLowerCase().includes(a.toLowerCase()))
  );
}
