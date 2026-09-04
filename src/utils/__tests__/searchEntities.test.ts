import { describe, expect, it } from 'vitest';
import {
  extractHotSearchKeywords,
  extractSearchEntities,
  extractSearchTabs,
  getSearchEntityKind,
  getSearchEntityRoute,
  getSearchEntitySearchTarget,
  isNavigableSearchEntity,
  isQuestionTitleSearchEntity,
  normalizeSearchEntityForTab,
} from '../searchEntities';

describe('搜索实体归一化', () => {
  it('递归移除 sponsorForSearch，不影响其它实体', () => {
    const response = {
      data: [{
        entities: [
          { entityType: 'user', uid: '10086', username: '普通用户' },
          { entityTemplate: 'sponsorForSearch', sponsorType: 'apk', title: '广告应用' },
          { entityType: 'feed', id: '200', message: '正常动态' },
        ],
      }],
    };
    const rows = extractSearchEntities(response);
    expect(rows).toHaveLength(2);
    expect(rows.some((item) => item.title === '广告应用')).toBe(false);
    expect(rows.map((item) => getSearchEntityKind(item))).toEqual(['user', 'feed']);
  });

  it('从热搜 EntityCard 中提取动态词，并过滤 sponsor', () => {
    const values = extractHotSearchKeywords({
      data: [{
        entityTemplate: 'searchHotCard',
        entities: [
          { title: '服务端热词' },
          { entityType: 'sponsorForSearch', title: '广告热词' },
        ],
      }],
    });
    expect(values).toEqual(['服务端热词']);
  });

  it('按实体类型生成站内路由', () => {
    const entities = [
      { entityType: 'user', uid: '1' },
      { entityType: 'feedTopic', tag: '桌面改造' },
      { entityType: 'apk', packageName: 'com.example.app' },
      { entityType: 'feed', id: '2', message: '动态' },
      { entityType: 'question', id: '3', title: '如何选择显示器' },
    ];
    expect(entities.map(getSearchEntityRoute)).toEqual(['/user/1', '/topic/%E6%A1%8C%E9%9D%A2%E6%94%B9%E9%80%A0', '/app/com.example.app', '/feed/2', '/question/3']);
    expect(isNavigableSearchEntity({ entityTemplate: 'sponsorForSearch', id: '3' })).toBe(false);
  });

  it('解析 searchTab 联想动作，使用原始关键词和目标页签', () => {
    const entity = {
      entityType: 'searchWord',
      title: '搜索用户：小米',
      url: 'searchTab://user?keyword=%E5%B0%8F%E7%B1%B3',
    };

    expect(getSearchEntitySearchTarget(entity)).toEqual({ keyword: '小米', searchType: 'user' });
    expect(getSearchEntityRoute(entity)).toBe('/search?q=%E5%B0%8F%E7%B1%B3&tab=user');
  });

  it('将 ask 页签返回的普通 feed 实体识别为问答并使用问题 ID', () => {
    const entity = normalizeSearchEntityForTab({
      entityType: 'feed',
      feedType: 'feed',
      id: 'answer-4',
      questionId: '4',
      message: '问答内容',
    }, 'ask');

    expect(getSearchEntityKind(entity)).toBe('question');
    expect(getSearchEntityRoute(entity)).toBe('/question/4');
  });

  it('将没有问题专用字段的 ask 结果也识别为问题', () => {
    const entity = normalizeSearchEntityForTab({
      entityType: 'feed',
      id: 'question-7',
      message: '这个设备值得买吗？',
    }, 'ask');

    expect(getSearchEntityKind(entity)).toBe('question');
    expect(getSearchEntityRoute(entity)).toBe('/question/question-7');
  });

  it('把 APK 的回答实体和提问分开，并路由到回答动态详情', () => {
    const entity = {
      entityType: 'feed',
      feedType: 'answer',
      id: 'answer-5',
      questionId: 'question-4',
      message_title: '回答标题',
      message: '回答正文',
    };

    expect(getSearchEntityKind(entity)).toBe('answer');
    expect(getSearchEntityRoute(entity)).toBe('/feed/answer-5');
  });

  it('普通动态即使带有默认问答统计字段，也不应被识别为提问', () => {
    const entity = {
      entityType: 'feed',
      feedType: 'feed',
      id: 'normal-feed',
      message: '普通动态内容',
      question_answer_num: 0,
      question_follow_num: 0,
    };

    expect(getSearchEntityKind(entity)).toBe('feed');
    expect(getSearchEntityRoute(entity)).toBe('/feed/normal-feed');
  });

  it('识别 APK 的 feedQuestion 标题卡', () => {
    const entity = {
      entityType: 'feedQuestion',
      id: 'question-6',
      message_title: '如何选择显示器',
      question_answer_num: 12,
      question_follow_num: 8,
    };

    expect(getSearchEntityKind(entity)).toBe('question');
    expect(isQuestionTitleSearchEntity(entity)).toBe(true);
    expect(getSearchEntityRoute(entity)).toBe('/question/question-6');
  });

  it('兼容只有标题或 APK 查询式 URL 的话题结果', () => {
    const entities = [
      { entityType: 'feedTopic', title: '小米' },
      { entityType: 'feedTopic', url: '#/topic?tag=%E5%B0%8F%E7%B1%B3' },
      { entityType: 'feedTopic', url: '/t/%E5%B0%8F%E7%B1%B3' },
    ];
    expect(entities.map(getSearchEntityRoute)).toEqual(['/topic/%E5%B0%8F%E7%B1%B3', '/topic/%E5%B0%8F%E7%B1%B3', '/topic/%E5%B0%8F%E7%B1%B3']);
    expect(entities.every(isNavigableSearchEntity)).toBe(true);
  });

  it('优先使用服务端搜索页签配置，没有配置时使用协议默认页签', () => {
    const configured = extractSearchTabs({ data: { searchTabs: [{ key: 'apk', title: '软件' }] } });
    expect(configured).toEqual([{ key: 'apk', searchType: 'apk', label: '软件', icon: undefined }]);
    expect(extractSearchTabs({ data: [] }).map((tab) => tab.searchType)).toContain('feedTopic');
  });
});
