/** 万物清单（productAlbum）实体，字段以 APK ProductAlbum/ProductAlbumItem 与 /v6/* 接口为准。 */
export interface AnyListItem {
  id?: string;
  album_id?: string;
  level?: string;
  item_id?: string;
  item_logo?: string;
  item_name?: string;
  item_description?: string;
  item_images?: string;
  display_order?: number;
  dateline?: number | string;
  lastupdate?: number | string;
  [key: string]: any;
}

export interface AnyListAlbum {
  id?: string | number;
  title?: string;
  description?: string;
  album_type?: number;
  create_time?: number | string;
  update_time?: number | string;
  productItems?: AnyListItem[];
  cover?: string;
  pic?: string;
  logo?: string;
  url?: string;
  entityId?: string | number;
  entityType?: string;
  [key: string]: any;
}

/** 创建万物清单的请求体。 */
export interface CreateAnyListPayload {
  title: string;
  description?: string;
  albumType?: number;
  targetType?: string;
  targetId?: string;
  productItems: AnyListItem[];
}