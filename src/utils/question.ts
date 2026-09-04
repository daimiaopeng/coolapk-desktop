import type { FeedItem } from '../types/feed';
import { extractFeedImageInputs, type FeedImageInput } from './livePhoto';
import { getUserUid } from './userRoute';

export type QuestionSort = 'reply' | 'like' | 'dateline';

const QUESTION_PAGE_SIZE = 20;

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
}

function firstText(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = textValue(record[key]);
    if (value) return value;
  }
  return '';
}

function firstNumber(record: Record<string, any>, keys: string[]): number {
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return 0;
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const normalized = textValue(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function extractList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  for (const key of ['answerList', 'answer_list', 'answers', 'entities', 'entityList', 'list', 'items', 'rows', 'data']) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [];
}

/** 从问答详情响应中取得可供 FeedCard/正文组件使用的问题实体。 */
export function normalizeQuestionDetail(value: unknown, fallbackId: string): FeedItem | null {
  const root = asRecord(value);
  const candidates = [root.question, root.feedInfo, root.targetFeed, root.feed, value];
  const source = candidates.map(asRecord).find((item) => Object.keys(item).length > 0);
  if (!source) return null;

  const id = firstText(source, ['id', 'entityId', 'entity_id', 'feedId', 'feed_id']) || fallbackId;
  const userInfo = asRecord(source.userInfo || source.user || source.authorInfo || source.author);
  const message = firstText(source, ['message', 'message_raw_output', 'content', 'text', 'note']);
  const title = firstText(source, ['title', 'message_title', 'messageTitle', 'questionTitle']);
  const uid = getUserUid(source) || getUserUid(userInfo);
  const normalized: FeedItem = {
    ...source,
    id,
    entityId: source.entityId || source.entity_id || id,
    entityType: source.entityType || source.entity_type || 'question',
    title,
    message,
    uid: uid || source.uid,
    username: firstText(source, ['username', 'user_name', 'userName']) || firstText(userInfo, ['username', 'user_name', 'userName', 'name']),
    userAvatar: firstText(source, ['userAvatar', 'user_avatar', 'avatar']) || firstText(userInfo, ['userAvatar', 'user_avatar', 'avatar']),
    userInfo: Object.keys(userInfo).length ? userInfo : source.userInfo,
  };
  return normalized;
}

/** 兼容酷安问答接口不同版本的列表包装结构。 */
export function extractQuestionAnswers(response: unknown): FeedItem[] {
  return extractList(asRecord(response).data ?? response)
    .map((item, index) => normalizeQuestionAnswer(item, index))
    .filter((item): item is FeedItem => Boolean(item));
}

/** 将回答实体补齐为统一的动态/评论显示字段，同时保留原始字段。 */
export function normalizeQuestionAnswer(value: unknown, index: number): FeedItem | null {
  const source = asRecord(value);
  if (!Object.keys(source).length) return null;
  const userInfo = asRecord(source.userInfo || source.user || source.authorInfo || source.author);
  const uid = getUserUid(source) || getUserUid(userInfo);
  const id = firstText(source, ['id', 'entityId', 'entity_id', 'replyId', 'reply_id', 'answerId', 'answer_id']) || `question-answer-${index}`;
  const message = firstText(source, ['message', 'message_raw_output', 'content', 'text', 'description', 'note']);
  return {
    ...source,
    id,
    entityId: source.entityId || source.entity_id || id,
    entityType: source.entityType || source.entity_type || 'reply',
    feedType: source.feedType || source.feed_type || 'answer',
    message,
    uid: uid || source.uid,
    username: firstText(source, ['username', 'user_name', 'userName', 'replyUserName', 'reply_user_name']) || firstText(userInfo, ['username', 'user_name', 'userName', 'name']),
    userAvatar: firstText(source, ['userAvatar', 'user_avatar', 'avatar', 'replyUserAvatar', 'reply_user_avatar']) || firstText(userInfo, ['userAvatar', 'user_avatar', 'avatar']),
    userInfo: Object.keys(userInfo).length ? userInfo : source.userInfo,
  };
}

export function getQuestionTitle(question: unknown): string {
  const source = asRecord(question);
  return firstText(source, ['title', 'message_title', 'messageTitle', 'questionTitle']) || '未命名问题';
}

export function getQuestionAnswerCount(question: unknown): number {
  return firstNumber(asRecord(question), ['question_answer_num', 'questionAnswerNum', 'answer_num', 'answerNum', 'replynum', 'replyNum']);
}

export function getQuestionFollowCount(question: unknown): number {
  return firstNumber(asRecord(question), ['question_follow_num', 'questionFollowNum', 'follow_num', 'followNum', 'follownum', 'follower_num']);
}

export function isQuestionFollowed(question: unknown): boolean {
  const source = asRecord(question);
  const userAction = asRecord(source.userAction || source.user_action);
  const actionValue = userAction.follow ?? userAction.isFollow ?? userAction.is_follow;
  if (actionValue !== undefined) return isTruthyFlag(actionValue);
  return isTruthyFlag(source.isFollow ?? source.is_follow ?? source.followed);
}

export function getQuestionAnswerLikeCount(answer: unknown): number {
  const source = asRecord(answer);
  const userAction = asRecord(source.userAction || source.user_action);
  return firstNumber(source, ['likenum', 'likeNum', 'like_num', 'likeCount']) || firstNumber(userAction, ['likeNum', 'like_num']);
}

export function getQuestionAnswerImages(answer: unknown): FeedImageInput[] {
  return extractFeedImageInputs(answer);
}

/** APK 邀请回答接口接受逗号分隔的 UID 字符串，这里只保留数字 UID。 */
export function normalizeInviteUids(value: string): string[] {
  return [...new Set(value.split(/[\s,，、;；]+/).map((item) => item.trim()).filter((item) => /^\d+$/.test(item) && !/^0+$/.test(item)))];
}

export function getQuestionHasMore(response: unknown, rowCount: number): boolean {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const pagination = asRecord(root.pagination || root.pageInfo || root.page_info || data.pagination || data.pageInfo || data.page_info);
  const explicit = root.hasMore ?? root.has_more ?? data.hasMore ?? data.has_more ?? pagination.hasMore ?? pagination.has_more;
  if (explicit !== undefined) return isTruthyFlag(explicit);
  return rowCount >= QUESTION_PAGE_SIZE;
}

export const QUESTION_ANSWER_PAGE_SIZE = QUESTION_PAGE_SIZE;
