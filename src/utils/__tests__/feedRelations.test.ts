import { describe, expect, it } from 'vitest';
import {
  getFeedRelationImage,
  getFeedRelationRows,
  getFeedRelationSubtitle,
  getFeedRelationTitle,
  getFeedRelationType,
} from '../feedRelations';

describe('动态多关联标的解析', () => {
  it('合并 relationRows、extraRows 和 productRows，并按实体去重', () => {
    const rows = getFeedRelationRows({
      relationRows: [{ id: 1, title: '黑神话：悟空', entityType: 'game' }, { id: 2, title: '小米 13 Pro' }],
      extraRows: [{ id: 1, title: '黑神话：悟空', entityType: 'game' }, { id: 3, title: '耳机' }],
      productRows: { data: [{ id: 4, title: '显示器' }] },
    });

    expect(rows.map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });

  it('兼容标的常见标题、图片、副标题和类型字段', () => {
    const row = {
      entity_type: 'product',
      entity_title: '小米 13 Pro',
      target_pic: 'https://image.coolapk.com/product.png',
      target_subtitle: '手机',
    };

    expect(getFeedRelationType(row)).toBe('product');
    expect(getFeedRelationTitle(row)).toBe('小米 13 Pro');
    expect(getFeedRelationImage(row)).toBe('https://image.coolapk.com/product.png');
    expect(getFeedRelationSubtitle(row)).toBe('手机');
  });
});
