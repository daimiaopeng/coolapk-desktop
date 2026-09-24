import { reactive } from 'vue';

export interface ShuzilmGuideOptions {
  reason?: 'missing_id' | 'risk_controlled' | 'manual';
  message?: string;
  onConfirmContinue?: () => void;
}

export interface ShuzilmGuideState {
  visible: boolean;
  reason: 'missing_id' | 'risk_controlled' | 'manual';
  message: string;
  onConfirmContinue: (() => void) | null;
}

export const shuzilmGuideState = reactive<ShuzilmGuideState>({
  visible: false,
  reason: 'missing_id',
  message: '',
  onConfirmContinue: null,
});

/**
 * 打开数盟设备 ID 配置指引弹窗
 */
export function openShuzilmGuide(options: ShuzilmGuideOptions = {}) {
  shuzilmGuideState.visible = true;
  shuzilmGuideState.reason = options.reason || 'missing_id';
  shuzilmGuideState.message = options.message || '';
  shuzilmGuideState.onConfirmContinue = options.onConfirmContinue || null;
}

/**
 * 关闭数盟设备 ID 指引弹窗
 */
export function closeShuzilmGuide() {
  shuzilmGuideState.visible = false;
  shuzilmGuideState.onConfirmContinue = null;
}

/**
 * 智能解析或提取用户输入的设备 ID（支持单行 ID 或从官方测试日志中复制的多行整段文本）
 *
 * 示例日志输入：
 * 设备ID: DU-MOCK-SAMPLE-DEVICE-ID-12345
 * ShuzlmID: DU-MOCK-SAMPLE-DEVICE-ID-12345
 * AndroidID: 0123456789abcdef
 * UUID: ca_00000000-0000-0000-0000-000000000000
 */
export function parseOrExtractDeviceId(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // 1. 尝试从文本中匹配 "设备ID:" 或 "ShuzlmID:"
  // 截止到空白、换行、或者后续常见字段标签 (ShuzlmID|AndroidID|UUID|设备ID)
  const match = trimmed.match(
    /(?:设备ID|ShuzlmID|DeviceId)\s*[:：]\s*([A-Za-z0-9_-]+?)(?=(?:ShuzlmID|AndroidID|UUID|设备ID|[:：]|\s|$))/i
  );
  if (match && match[1]) {
    return match[1].trim();
  }

  // 2. 如果只有单行且不含冒号，直接取其内容
  const firstLine = trimmed.split(/[\r\n]+/)[0].trim();
  if (firstLine && !firstLine.includes(':') && !firstLine.includes('：')) {
    // 移除非法字符，只保留合法 Base64 URL-safe 常见字符
    const sanitized = firstLine.replace(/[^A-Za-z0-9_-]/g, '');
    return sanitized;
  }

  return '';
}

/** 只提取明确标记的 ddid 或单独填写的会话值，不把“复制 OID”的设备日志当成 ddid。 */
export function parseDdidInput(text: string): string {
  const raw = text.trim();
  if (!raw) return '';
  const cookieValue = raw.match(/(?:^|[;\s,])ddid\s*=\s*([^;\s,]+)/i)?.[1];
  const labeledValue = raw.match(/(?:^|[\r\n])\s*[*•-]?\s*ddid\s*[:：]\s*([^\s;,]+)/im)?.[1];
  const standaloneValue = !/[\r\n;]/.test(raw) && !/^[-*•]?\s*(?:设备\s*ID|Device\s*ID|DeviceId|ShuzlmID|AndroidID|UUID|OAID|OID|DID)\s*[:=：]/i.test(raw) && !/^\S+\s*=/.test(raw) ? raw : '';
  const value = (cookieValue || labeledValue || standaloneValue).trim();
  return value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value) ? value : '';
}

/**
 * 校验设备 ID 是否具有合法特征（非空且字符合理，官方数盟 ID 通常形如 DU...，长度至少 10 位）
 */
export function isValidShuzlmDeviceId(id: string): boolean {
  if (!id) return false;
  const trimmed = id.trim();
  return /^[A-Za-z0-9_-]{10,128}$/.test(trimmed);
}

/**
 * 判断接口错误是否属于酷安服务端的设备/网络风控拦截
 */
export function isRiskControlError(err: unknown): boolean {
  if (!err) return false;
  let text = '';
  if (typeof err === 'string') {
    text = err;
  } else if (typeof err === 'object') {
    const record = err as Record<string, unknown>;
    text = `${record.message || ''} ${record.error || ''} ${record.messageStatus || ''} ${record.description || ''}`;
  }
  return (
    text.includes('网络环境可能异常') ||
    text.includes('err_request_need_upgrade_new_version') ||
    text.includes('need_upgrade_new_version') ||
    text.includes('设备安全校验') ||
    text.includes('设备环境异常') ||
    text.includes('请使用官方客户端')
  );
}
