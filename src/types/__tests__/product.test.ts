import { describe, expect, it } from 'vitest';
import {
  extractRatingChartSeries,
  parseProductConfigData,
} from '../product';

describe('product config data parsing', () => {
  it('parses grouped config_data JSON string', () => {
    const groups = parseProductConfigData(JSON.stringify({
      '基础参数': { 型号: '小米 15', 上市时间: '2024年10月' },
      '屏幕': { 尺寸: '6.36英寸', 刷新率: '120Hz' },
    }));
    expect(groups['基础参数']).toEqual({ 型号: '小米 15', 上市时间: '2024年10月' });
    expect(groups['屏幕']['刷新率']).toBe('120Hz');
  });

  it('rejects invalid or non-object inputs', () => {
    expect(parseProductConfigData('')).toEqual({});
    expect(parseProductConfigData('not-json')).toEqual({});
    expect(parseProductConfigData('[]')).toEqual({});
    expect(parseProductConfigData(JSON.stringify(['a', 'b']))).toEqual({});
  });

  it('drops empty groups and non-string values', () => {
    const groups = parseProductConfigData(JSON.stringify({
      '空组': {},
      '正常': { 价格: 3999 },
    }));
    expect(groups['空组']).toBeUndefined();
    expect(groups['正常']['价格']).toBe('3999');
  });

  it('formats nested objects and arrays instead of rendering object references', () => {
    const groups = parseProductConfigData(JSON.stringify({
      影像: {
        摄像头数量: 4,
        后置主摄参数: { 像素: '50MP', 光圈: 'f/1.8' },
        镜头: ['广角', '长焦'],
      },
    }));
    expect(groups['影像']['后置主摄参数']).toBe('像素: 50MP；光圈: f/1.8');
    expect(groups['影像']['镜头']).toBe('广角，长焦');
    expect(groups['影像']['后置主摄参数']).not.toContain('[object Object]');
  });
});

describe('rating chart series extraction', () => {
  it('extracts x-axis points from rating chart', () => {
    const series = extractRatingChartSeries({
      ratingChart: {
        x: [
          { datelineStr: '2025-08-01', score: 8.5, count: 3 },
          { datelineStr: '2025-08-02', score: 9.0, count: 5 },
        ],
        y: [{ min: 0, max: 10 }],
      },
    });
    expect(series).toHaveLength(2);
    expect(series[0].label).toBe('2025-08-01');
    expect(series[0].score).toBe(8.5);
    expect(series[1].count).toBe(5);
  });

  it('prefers owner chart and handles missing data', () => {
    const series = extractRatingChartSeries({
      ownerRatingChart: {
        x: [{ datelineStr: '2025-08-01', score: 9.2 }],
      },
    });
    expect(series[0].score).toBe(9.2);

    expect(extractRatingChartSeries(null)).toEqual([]);
    expect(extractRatingChartSeries({ ratingChart: { x: [] } })).toEqual([]);
  });

  it('filters out non-numeric scores', () => {
    const series = extractRatingChartSeries({
      ratingChart: {
        x: [
          { datelineStr: 'a', score: 8 },
          { datelineStr: 'b' },
        ],
      },
    });
    expect(series).toHaveLength(1);
  });
});
