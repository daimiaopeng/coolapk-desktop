import { describe, it, expect } from 'vitest';
import {
  parseOrExtractDeviceId,
  parseDdidInput,
  isValidShuzlmDeviceId,
  isRiskControlError,
} from '../shuzilmDeviceGuide';

describe('shuzilmDeviceGuide utility', () => {
  it('从官方日志格式中准确提取设备ID', () => {
    const rawLog = `设备ID: DU-MOCK-SAMPLE-DEVICE-ID-12345
ShuzlmID: DU-MOCK-SAMPLE-DEVICE-ID-12345
AndroidID: 0123456789abcdef
UUID: ca_00000000-0000-0000-0000-000000000000`;

    expect(parseOrExtractDeviceId(rawLog)).toBe('DU-MOCK-SAMPLE-DEVICE-ID-12345');
    expect(parseDdidInput(rawLog)).toBe('');
  });

  it('只接受明确的 ddid 会话值，不把设备 ID 日志当成 ddid', () => {
    expect(parseDdidInput('- ShuzlmID: DU-MOCK-SAMPLE-DEVICE-ID-12345')).toBe('');
    expect(parseDdidInput('Cookie: uid=123; ddid=SESSION-MOCK-123; sid=other')).toBe('SESSION-MOCK-123');
    expect(parseDdidInput('ddid: SESSION-MOCK-123')).toBe('SESSION-MOCK-123');
    expect(parseDdidInput('SESSION-MOCK-123')).toBe('SESSION-MOCK-123');
  });

  it('从仅包含 ShuzlmID 的日志中提取', () => {
    const log = `ShuzlmID：DUWX3-test123456789\nAndroidID: xxx`;
    expect(parseOrExtractDeviceId(log)).toBe('DUWX3-test123456789');
  });

  it('处理单行 ID 输入', () => {
    expect(parseOrExtractDeviceId('  DU-MOCK-SAMPLE-DEVICE-ID-12345  ')).toBe(
      'DU-MOCK-SAMPLE-DEVICE-ID-12345'
    );
  });

  it('校验合法与非法的设备ID', () => {
    expect(isValidShuzlmDeviceId('DU-MOCK-SAMPLE-DEVICE-ID-12345')).toBe(true);
    expect(isValidShuzlmDeviceId('DUWX3-abc123456789')).toBe(true);
    expect(isValidShuzlmDeviceId('')).toBe(false);
    expect(isValidShuzlmDeviceId('abc')).toBe(false); // 太短
    expect(isValidShuzlmDeviceId('invalid char @@@###')).toBe(false);
  });

  it('正确识别风控错误', () => {
    expect(isRiskControlError('网络环境可能异常，操作被拦截')).toBe(true);
    expect(isRiskControlError({ message: 'err_request_need_upgrade_new_version' })).toBe(true);
    expect(isRiskControlError({ message: '评论发布成功' })).toBe(false);
    expect(isRiskControlError('密码错误')).toBe(false);
  });
});
