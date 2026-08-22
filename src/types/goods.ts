/** 好物/购物生态相关类型定义 */

/** 好物搜索商品实体（pear_goods） */
export interface PearGoods {
  id: string | number;
  entityType?: string;
  entityId?: string | number;
  goods_title?: string;
  goods_pic?: string;
  goods_price?: string;
  goods_promo_price?: string;
  goods_promo_title?: string;
  goods_url?: string;
  goods_tags?: string;
  goods_buy_text?: string;
  goods_buy_url?: string;
  goods_is_direct?: number;
  mall_title?: string;
  mallInfo?: { mall_title?: string };
  category_title?: string;
  categoryInfo?: { cat_title?: string };
  coupon?: number;
  couponPrice?: string;
  volume?: number;
  sellCount?: string;
}

/** 好物搜索热词 */
export interface GoodsHotWord {
  id: string | number;
  title?: string;
  word?: string;
  num?: number;
}

/** 好物清单分类（list_type） */
export interface GoodsListType {
  id: string | number;
  title?: string;
  description?: string;
  dateline?: number;
  lastupdate?: number;
  entityType?: string;
  logo?: string;
  pic?: string;
}

/** 好物清单（FunThings / goodsList，通常内嵌在 Feed.goodsListInfo） */
export interface GoodsListInfo {
  id?: string | number;
  title?: string;
  cover?: string;
  coverPic?: string;
  logo?: string;
  pic?: string;
  message?: string;
  description?: string;
  list_type?: string;
  top_limit?: number;
  is_open_vote?: number;
  isVote?: number;
  is_vote?: number;
  vote_num?: number;
  vote_person_num?: number;
  item_num?: number;
  item_id?: string;
  like_num?: number;
  follow_num?: number;
  reply_num?: number;
  copy_num?: number;
  fav_num?: number;
  uid?: string | number;
  userInfo?: {
    uid?: string | number;
    username?: string;
    userAvatar?: string;
    level?: number;
    verify_title?: string;
  };
  sort_message?: string;
  vote_message?: string;
  is_allow_recommend_goods?: number;
  is_open?: number;
  recommend?: number;
  createdate?: number;
  dateline?: number;
  extraData?: Record<string, any>;
}

/** 好物清单/好物榜中的商品条目（GoodsListItem） */
export interface GoodsListItem {
  id?: string | number;
  entityId?: string | number;
  feed_id?: string;
  product_goods_id?: string;
  product_goods_title?: string;
  product_goods_cover?: string;
  product_goods_logo?: string;
  product_goods_url?: string;
  price?: string;
  mall_name?: string;
  note?: string;
  pic?: string;
  logo?: string;
  title?: string;
  url?: string;
  goods_url?: string;
  vote_num?: number;
  isVote?: number;
  is_vote?: number;
  sort?: number;
  is_show_top_list?: number;
  dateline?: number;
  userInfo?: {
    uid?: string | number;
    username?: string;
    userAvatar?: string;
    level?: number;
  };
}

/** 用户产品专辑 */
export interface ProductAlbum {
  id?: string | number;
  entityId?: string | number;
  title?: string;
  description?: string;
  cover?: string;
  logo?: string;
  pic?: string;
  uid?: string | number;
  username?: string;
  dateline?: number;
  lastupdate?: number;
  item_num?: number;
  follower_num?: number;
  feed_num?: number;
  entityType?: string;
}