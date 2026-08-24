import { describe, expect, it } from 'vitest';
import { getUserUid, normalizeUserUid } from '../userRoute';

describe('动态作者用户路由', () => {
  it('只接受非零数字 UID', () => {
    expect(normalizeUserUid('123456')).toBe('123456');
    expect(normalizeUserUid(' 123456 ')).toBe('123456');
    expect(normalizeUserUid('0')).toBe('');
    expect(normalizeUserUid('酷安头条')).toBe('');
  });

  it('跳过占位 UID 并从作者嵌套对象提取有效 UID', () => {
    expect(getUserUid({ uid: '0', username: '酷安头条' })).toBe('');
    expect(getUserUid({ uid: '0', userInfo: { uid: '13579', username: '普通用户' } })).toBe('13579');
    expect(getUserUid({ author: { id: 24680, name: '普通用户' } })).toBe('24680');
  });
});
