import { describe, expect, it } from 'vitest';
import {
  extractHotSearchKeywords,
  extractSearchEntities,
  extractSearchTabs,
  getSearchEntityKind,
  getSearchEntityRoute,
  isNavigableSearchEntity,
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
