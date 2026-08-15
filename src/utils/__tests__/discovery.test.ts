import { describe, expect, it } from 'vitest';
import {
  decodeDiscoveryRouteSegment,
  getEntityImage,
  getEntityKey,
  isGoodsEntity,
  isFeedEntity,
  parseDiscoveryPage,
  parseDiscoverySelectedKey,
  parseDiscoveryTabs,
  resolveDiscoveryRoute,
} from '../discovery';

describe('discovery dynamic configuration', () => {
  it('parses visible ConfigPage entities from the discovery config card', () => {
    const tabs = parseDiscoveryTabs({
      data: [{
        id: 6390,
        entityTemplate: 'configCard',
        title: '首页',
        entities: [{ entityType: 'ConfigPage', title: '首页话题', url: '/page?url=V11_HOME' }],
      }, {
        id: 20131,
        entityTemplate: 'configCard',
        title: '发现',
        extraDataArr: { selectedHomeTab: 'V11_FIND_LIFE' },
        entities: [
          { entityType: 'ConfigPage', title: '生活', page_name: 'V11_FIND_LIFE', url: 'V11_FIND_LIFE', page_visibility: 1, order: 2 },
          { entityType: 'ConfigPage', title: '隐藏', url: 'V11_FIND_HIDDEN', page_visibility: 0, order: 1 },
          { entityType: 'ConfigPage', title: '酷图', url: 'V11_FIND_COOLPIC', page_visibility: 1, order: 1 },
        ],
      }],
    });

    expect(tabs.map((tab) => tab.title)).toEqual(['酷图', '生活']);
    expect(tabs[1].key).toBe('V11_FIND_LIFE');
    expect(parseDiscoverySelectedKey({ data: [
      { id: 6390, title: '首页', entities: [{ title: '首页话题', url: '/page?url=V11_HOME' }] },
      { id: 20131, title: '发现', extraDataArr: { selectedHomeTab: 'V11_FIND_LIFE' } },
    ] }, tabs)).toBe('V11_FIND_LIFE');
  });

  it('parses page data and keeps cursors and raw entities', () => {
    const result = parseDiscoveryPage({
      data: [{ id: 1, entityType: 'feed', entityTemplate: 'feed', title: '第一条' }],
      firstItem: '1',
      lastItem: '1',
      hasMore: true,
    }, 2);

    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.firstItem).toBe('1');
    expect(result.lastItem).toBe('1');
    expect(result.hasMore).toBe(true);
  });

  it('resolves web, native and data-list routes', () => {
    expect(resolveDiscoveryRoute({ url: 'https://www.coolapk.com/page' })?.kind).toBe('web');
    expect(resolveDiscoveryRoute({ url: '/user/123' })?.kind).toBe('native');
    expect(resolveDiscoveryRoute({ url: 'V11_FIND_DYH' })?.kind).toBe('native');
    expect(resolveDiscoveryRoute({ url: 'V11_FIND_COOLPIC' })?.kind).toBe('data-list');
    expect(resolveDiscoveryRoute({ url: '#/feed/digestList' })?.kind).toBe('data-list');
    expect(resolveDiscoveryRoute({ url: '/apk/detail?packageName=com.example.app' })?.target).toBe('/apk/com.example.app');
  });

  it('decodes discovery route segments only once', () => {
    expect(decodeDiscoveryRouteSegment('%E5%85%BB%E9%B1%BC')).toBe('养鱼');
    expect(decodeDiscoveryRouteSegment('养鱼')).toBe('养鱼');
    expect(decodeDiscoveryRouteSegment('%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('identifies feeds and produces stable entity keys', () => {
    expect(isFeedEntity({ entityTemplate: 'feedCard' })).toBe(true);
    expect(getEntityKey({ entityId: 42 }, 0)).toBe('42');
    expect(getEntityKey({ entityTemplate: 'imageCard' }, 3)).toBe('imageCard-3');
  });

  it('normalizes APK goods cover fields for image cards', () => {
    expect(getEntityImage({ entityType: 'goodsListItem', product_goods_cover: 'https://img.example/goods.jpg', pic: 'a,b' })).toBe('https://img.example/goods.jpg');
    expect(isGoodsEntity({ entityType: 'goodsListItem' })).toBe(true);
    expect(isGoodsEntity({ entityTemplate: 'merchantGoodsCard' })).toBe(true);
  });

  it('does not render config cards as page content', () => {
    const result = parseDiscoveryPage({
      data: [
        { entityType: 'configCard', entityTemplate: 'configCard', title: 'runtime metadata' },
        { entityType: 'feed', entityTemplate: 'feed', title: 'content' },
      ],
    }, 1);
    expect(result.items.map((item) => item.entityType)).toEqual(['feed']);
  });
});
