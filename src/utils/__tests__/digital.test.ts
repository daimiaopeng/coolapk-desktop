import { describe, expect, it } from 'vitest';
import { getDigitalProductHot, getDigitalProductPrice, isDigitalProduct, isDigitalProductWished, isDigitalSeriesMore, isDigitalSeriesTitle } from '../digitalProduct';
import { parseDigitalConfig, parseDigitalTabs, removeRedundantFirstDigitalTab, resolveDefaultDigitalTabKey } from '../digitalTabs';

describe('数码服务端配置和产品字段', () => {
  it('从数码 ConfigCard 的子栏目中保留普通页和分类页', () => {
    const tabs = parseDigitalTabs({
      data: [{
        entityTemplate: 'configCard',
        title: '数码',
        entities: [
          { entityType: 'ConfigPage', title: '手机', pageName: 'V10_PRODUCT_HOME', url: 'V10_PRODUCT_HOME', order: 2 },
          { entityType: 'ConfigPage', title: '品牌分类', url: '/product/categoryList', order: 1 },
        ],
      }],
    });
    expect(tabs.map((tab) => tab.title)).toEqual(['品牌分类', '手机']);
    expect(tabs[0]?.category).toBe(true);
    expect(tabs[1]?.url).toBe('V10_PRODUCT_HOME');
  });

  it('识别 APK 产品组模板和产品展示字段', () => {
    expect(isDigitalSeriesTitle({ entityTemplate: 'productGroupTitle', title: '旗舰手机' })).toBe(true);
    expect(isDigitalSeriesMore({ entityTemplate: 'productGroupMore', title: '查看更多' })).toBe(true);
    expect(isDigitalProduct({ entityTemplate: 'vertical_product', id: 1, title: '设备' })).toBe(true);
    expect(isDigitalProduct({ product_id: 2, title: '兼容产品卡' })).toBe(true);
    expect(getDigitalProductPrice({ price_currency: '¥', price_min: 1999, price_max: 2999 })).toBe('¥1999-2999');
    expect(getDigitalProductHot({ hot_num: 12000 })).toBe('1.2万');
    expect(isDigitalProductWished({ userAction: { follow: 1 } })).toBe(true);
  });

  it('保留服务端选中页、可见性、网页地址和子栏目实体', () => {
    const config = parseDigitalConfig({
      data: {
        extraData: JSON.stringify({ selectedHomeTab: 'V10_DIGITAL_HOME' }),
        configPages: [
          { entityType: 'ConfigPage', title: '隐藏栏目', pageName: 'V10_DIGITAL_HIDDEN', url: 'V10_DIGITAL_HIDDEN', visibility: 'hidden' },
          { entityType: 'ConfigPage', title: '数码首页', pageName: 'V10_DIGITAL_HOME', url: 'V10_DIGITAL_HOME', entities: JSON.stringify([{ title: '手机', pageName: 'V10_DIGITAL_PHONE', requestParams: { type: 'phone' } }]) },
          { entityType: 'ConfigPage', title: '网页栏目', pageName: 'V10_DIGITAL_WEB', webUrl: 'https://www.coolapk.com/digital', url: 'V10_DIGITAL_WEB' },
        ],
      },
    });
    expect(config.tabs.map((tab) => tab.title)).toEqual(['数码首页', '网页栏目']);
    expect(config.selectedKey).toBe('V10_DIGITAL_HOME');
    expect(config.tabs[0]?.rawEntities[0]?.title).toBe('手机');
    expect(config.tabs[0]?.rawEntities[0]?.pageName).toBe('V10_DIGITAL_PHONE');
    expect(config.tabs[1]?.webUrl).toBe('https://www.coolapk.com/digital');
  });

  it('重复数码栏目时只移除第一个导航项并保留后面的服务端栏目', () => {
    const tabs = parseDigitalTabs({
      data: [
        { entityType: 'ConfigPage', title: '数码', pageName: 'V10_DIGITAL_CONTAINER', url: 'V10_DIGITAL_CONTAINER', order: 0 },
        { entityType: 'ConfigPage', title: '数码库', pageName: 'V10_PRODUCT_LIBRARY', url: 'V10_PRODUCT_LIBRARY', order: 1 },
        { entityType: 'ConfigPage', title: '数码', pageName: 'V10_DIGITAL_HOME', url: 'V10_DIGITAL_HOME', order: 2 },
      ],
    });
    const normalized = removeRedundantFirstDigitalTab(tabs);
    expect(normalized.tabs.map((tab) => tab.title)).toEqual(['数码库', '数码']);
    expect(normalized.removedKey).toBe('V10_DIGITAL_CONTAINER');
    expect(resolveDefaultDigitalTabKey(normalized.tabs, normalized.removedKey, normalized.removedKey)).toBe('V10_DIGITAL_HOME');
  });
});
