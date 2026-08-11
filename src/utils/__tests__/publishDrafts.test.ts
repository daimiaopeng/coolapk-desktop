import { beforeEach, describe, expect, it } from 'vitest';
import { clearPublishDraft, loadPublishDraft, savePublishDraft } from '../publishDrafts';

describe('publishDrafts', () => {
  beforeEach(async () => {
    await clearPublishDraft('100');
    await clearPublishDraft('200');
  });

  it('按账号保存和读取动态草稿', async () => {
    await savePublishDraft('100', '动态草稿');
    await savePublishDraft('200', '另一个账号的草稿');
    expect(await loadPublishDraft('100')).toBe('动态草稿');
    expect(await loadPublishDraft('200')).toBe('另一个账号的草稿');
  });

  it('空内容会清除动态草稿', async () => {
    await savePublishDraft('100', '待清除');
    await savePublishDraft('100', '   ');
    expect(await loadPublishDraft('100')).toBe('');
  });
});
