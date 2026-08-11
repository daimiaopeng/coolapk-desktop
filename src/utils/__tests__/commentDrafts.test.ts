import { beforeEach, describe, expect, it } from 'vitest';
import { clearCommentDraft, loadCommentDraft, saveCommentDraft } from '../commentDrafts';

describe('commentDrafts', () => {
  beforeEach(async () => {
    await clearCommentDraft('100', 'feed-a');
    await clearCommentDraft('100', 'feed-a', 'reply-a');
    await clearCommentDraft('200', 'feed-a');
  });

  it('按账号、动态和回复目标隔离评论草稿', async () => {
    await saveCommentDraft('100', 'feed-a', null, '动态评论');
    await saveCommentDraft('100', 'feed-a', 'reply-a', '回复评论');
    await saveCommentDraft('200', 'feed-a', null, '另一个账号的评论');
    expect(await loadCommentDraft('100', 'feed-a')).toBe('动态评论');
    expect(await loadCommentDraft('100', 'feed-a', 'reply-a')).toBe('回复评论');
    expect(await loadCommentDraft('200', 'feed-a')).toBe('另一个账号的评论');
  });

  it('空内容会清除评论草稿', async () => {
    await saveCommentDraft('100', 'feed-a', null, '待清除');
    await saveCommentDraft('100', 'feed-a', null, '   ');
    expect(await loadCommentDraft('100', 'feed-a')).toBe('');
  });
});
