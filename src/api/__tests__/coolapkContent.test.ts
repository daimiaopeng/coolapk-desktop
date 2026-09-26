import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { CoolapkTauriAPI } from '../coolapk';

function okResponse(data: unknown) {
  return { code: 200, data };
}

describe('CoolapkTauriAPI 内容新页接口封装', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(okResponse([]));
  });

  it('后台正文读取使用独立的游客详情命令', async () => {
    await CoolapkTauriAPI.getPublicFeedDetail('123');
    expect(invoke).toHaveBeenCalledWith('get_public_feed_detail', { feedId: '123' });
  });

  it('酷友圈活动列表调用 get_event_list', async () => {
    await CoolapkTauriAPI.getEventList(3);
    expect(invoke).toHaveBeenCalledWith('get_event_list', { page: 3 });
  });

  it('酷友圈活动详情调用 get_event_detail', async () => {
    await CoolapkTauriAPI.getEventDetail('1082');
    expect(invoke).toHaveBeenCalledWith('get_event_detail', { eventId: '1082' });
  });

  it('我关注的动态号调用 get_dyh_follow_list', async () => {
    await CoolapkTauriAPI.getMyDyhFollowList(2);
    expect(invoke).toHaveBeenCalledWith('get_dyh_follow_list', { page: 2 });
  });

  it('我订阅的动态号调用 get_dyh_subscribe_list', async () => {
    await CoolapkTauriAPI.getMyDyhSubscribeList(1);
    expect(invoke).toHaveBeenCalledWith('get_dyh_subscribe_list', { page: 1 });
  });

  it('我管理的动态号调用 get_dyh_editor_list', async () => {
    await CoolapkTauriAPI.getMyDyhEditorList(1);
    expect(invoke).toHaveBeenCalledWith('get_dyh_editor_list', { page: 1 });
  });

  it('用户万物清单调用 get_user_product_albums', async () => {
    await CoolapkTauriAPI.getUserProductAlbums('2014', 1);
    expect(invoke).toHaveBeenCalledWith('get_user_product_albums', { uid: '2014', page: 1 });
  });

  it('好物清单条目调用 get_goods_list_items', async () => {
    await CoolapkTauriAPI.getGoodsListItems('2014', '5', 1);
    expect(invoke).toHaveBeenCalledWith('get_goods_list_items', { uid: '2014', goodsId: '5', page: 1 });
  });

  it('创建万物清单把 productItems 序列化后调用 create_product_album', async () => {
    await CoolapkTauriAPI.createProductAlbum({
      title: '我的清单',
      description: '说明',
      albumType: 0,
      productItems: [{ item_name: '测试商品' }],
    });
    expect(invoke).toHaveBeenCalledWith(
      'create_product_album',
      expect.objectContaining({
        title: '我的清单',
        description: '说明',
        albumType: 0,
        productItems: JSON.stringify([{ item_name: '测试商品' }]),
      }),
    );
  });

  it('节点动态调用 get_node_feeds', async () => {
    await CoolapkTauriAPI.getNodeFeeds('topic', '数码', 1);
    expect(invoke).toHaveBeenCalledWith('get_node_feeds', { nodeType: 'topic', nodeId: '数码', page: 1 });
  });

  it('产品动态把排序参数传入 get_product_feeds', async () => {
    await CoolapkTauriAPI.getProductFeeds('5573', 'feed', 2, 'rank_score');
    expect(invoke).toHaveBeenCalledWith('get_product_feeds', {
      productId: '5573',
      feedType: 'feed',
      listType: 'rank_score',
      page: 2,
    });
  });

  it('动态搜索把 APK 的精确筛选参数传入原生命令', async () => {
    await CoolapkTauriAPI.searchByType({
      searchType: 'feed',
      query: '小米',
      page: 1,
      pageType: 'product_phone',
      pageParam: '5573',
      feedType: 'comment',
      sort: '',
      isStrict: 1,
    });
    expect(invoke).toHaveBeenCalledWith('search_by_type', expect.objectContaining({
      searchType: 'feed',
      query: '小米',
      pageType: 'product_phone',
      pageParam: '5573',
      feedType: 'comment',
      sort: '',
      isStrict: 1,
    }));
  });

  it('数码分类产品列表保留服务端下发的页面上下文', async () => {
    await CoolapkTauriAPI.getProductList('#/product/categoryList?type=tablet', '平板', '平板电脑', 2);
    expect(invoke).toHaveBeenCalledWith('get_product_list', {
      url: '#/product/categoryList?type=tablet',
      title: '平板',
      subTitle: '平板电脑',
      page: 2,
    });
  });

  it('数码服务端栏目把动态请求参数和分页游标传入 dataList', async () => {
    await CoolapkTauriAPI.getDiscoveryPageData({
      url: 'V10_DIGITAL_PHONE',
      title: '手机',
      subTitle: '手机产品',
      page: 2,
      firstItem: '101',
      lastItem: '120',
      pageContext: '{"source":"desktop-digital"}',
      requestArgs: { type: 'phone', sort: 'hot' },
    });
    expect(invoke).toHaveBeenCalledWith('get_discovery_page_data', {
      url: 'V10_DIGITAL_PHONE',
      title: '手机',
      subTitle: '手机产品',
      page: 2,
      firstItem: '101',
      lastItem: '120',
      pageContext: '{"source":"desktop-digital"}',
      requestArgsJson: JSON.stringify({ type: 'phone', sort: 'hot' }),
    });
  });

  it('品牌产品列表沿用 APK 的品牌 ID 与类型参数', async () => {
    await CoolapkTauriAPI.getProductBrandProducts('1016', 'recommend', 2);
    expect(invoke).toHaveBeenCalledWith('get_product_brand_products', {
      brandId: '1016',
      brandType: 'recommend',
      page: 2,
    });
  });

  it('收藏单创建、编辑和删除调用对应原生命令', async () => {
    await CoolapkTauriAPI.createCollection({ title: '旅行收藏', description: '路线', cover: 'https://image.coolapk.com/cover.jpg', isOpen: 1, sourceId: '' });
    expect(invoke).toHaveBeenCalledWith('create_collection', {
      title: '旅行收藏',
      description: '路线',
      cover: 'https://image.coolapk.com/cover.jpg',
      isOpen: 1,
      sourceId: '',
    });
    await CoolapkTauriAPI.updateCollection('42', '新标题', '新描述', '', 0);
    expect(invoke).toHaveBeenCalledWith('update_collection', { id: '42', title: '新标题', description: '新描述', cover: '', isOpen: 0 });
    await CoolapkTauriAPI.deleteCollection('42');
    expect(invoke).toHaveBeenCalledWith('delete_collection', { id: '42' });
  });

  it('收藏单条目管理调用移除和清理失效命令', async () => {
    await CoolapkTauriAPI.removeCollectionItem('item-42');
    expect(invoke).toHaveBeenCalledWith('remove_collection_item', { itemId: 'item-42' });
    await CoolapkTauriAPI.clearCollectionInvalidItems('collection-42');
    expect(invoke).toHaveBeenCalledWith('clear_collection_invalid_items', { collectionId: 'collection-42' });
  });

  it('我的关注的收藏单、问题和数码吧沿用 APK 页面路由', async () => {
    await CoolapkTauriAPI.getFollowedCollections(2);
    expect(invoke).toHaveBeenCalledWith('get_discovery_page_data', expect.objectContaining({ url: '#/collection/followList?&title=我关注的收藏单', title: '我关注的收藏单', page: 2 }));
    await CoolapkTauriAPI.getFollowedQuestions(3);
    expect(invoke).toHaveBeenCalledWith('get_discovery_page_data', expect.objectContaining({ url: '#/feed/questionFollowList?&title=我关注的问题', title: '我关注的问题', page: 3 }));
    await CoolapkTauriAPI.getFollowedProducts(4);
    expect(invoke).toHaveBeenCalledWith('get_discovery_page_data', expect.objectContaining({ url: '#/product/followProductList?&title=我关注的数码吧', title: '我关注的数码吧', page: 4 }));
  });

  it('闲置品牌列表调用 APK 对应命令', async () => {
    await CoolapkTauriAPI.getSecondHandBrandList();
    expect(invoke).toHaveBeenCalledWith('get_secondhand_brand_list', {});
  });

  it('闲置型号列表传入 APK 的品牌、类型和游标参数', async () => {
    await CoolapkTauriAPI.getSecondHandProductList('1016', 'recommend', 2, { firstItem: 'first', lastItem: 'last' });
    expect(invoke).toHaveBeenCalledWith('get_secondhand_product_list', {
      brandId: '1016',
      listType: 'recommend',
      page: 2,
      firstItem: 'first',
      lastItem: 'last',
    });
  });

  it('个人资料读取调用 get_user_profile', async () => {
    await CoolapkTauriAPI.getUserProfile('2014');
    expect(invoke).toHaveBeenCalledWith('get_user_profile', { uid: '2014' });
  });

  it('后台用户资料读取使用游客命令', async () => {
    await CoolapkTauriAPI.getPublicUserSpace('2014');
    await CoolapkTauriAPI.getPublicUserProfile('2014');
    expect(invoke).toHaveBeenCalledWith('get_public_user_space', { uid: '2014' });
    expect(invoke).toHaveBeenCalledWith('get_public_user_profile', { uid: '2014' });
  });

  it('个人资料字段修改调用 update_user_profile', async () => {
    await CoolapkTauriAPI.updateUserProfile('gender', '1');
    expect(invoke).toHaveBeenCalledWith('update_user_profile', { key: 'gender', value: '1' });
  });

  it('保存生成的分享图调用 save_image_data_url', async () => {
    await CoolapkTauriAPI.saveImageDataUrl('data:image/png;base64,YWJj', 'coolapk-feed-42.png', 'D:/Downloads');
    expect(invoke).toHaveBeenCalledWith('save_image_data_url', {
      dataUrl: 'data:image/png;base64,YWJj',
      fileName: 'coolapk-feed-42.png',
      dir: 'D:/Downloads',
    });
  });

  it('头像和背景图修改分别调用对应 Tauri 命令', async () => {
    const imageBytes = new Uint8Array([1, 2, 3]);
    await CoolapkTauriAPI.changeAvatar(imageBytes, 'avatar.png', 'image/png');
    expect(invoke).toHaveBeenCalledWith('change_avatar', { imageBytes, fileName: 'avatar.png', contentType: 'image/png' });
    await CoolapkTauriAPI.updateUserCover('https://image.coolapk.com/cover.jpg');
    expect(invoke).toHaveBeenCalledWith('update_user_cover', { url: 'https://image.coolapk.com/cover.jpg' });
  });
});
