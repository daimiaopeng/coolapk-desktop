/** 动态号（看看号/DYH）实体，字段以 APK DyhModel 与 /v6/dyh/*、/v6/user/* 接口为准。 */
export interface DyhEntity {
  id?: string | number;
  entityId?: string | number;
  entityType?: string;
  uid?: string | number;
  title?: string;
  dyhName?: string;
  dyh_name?: string;
  description?: string;
  dyhDescription?: string;
  avatar?: string;
  userAvatar?: string;
  logo?: string;
  pic?: string;
  follownum?: number | string;
  likenum?: number | string;
  isFollow?: boolean | number;
  isFollowed?: boolean | number;
  is_follow?: boolean | number;
  follow?: boolean | number;
  editorInfo?: any;
  selectedTab?: string;
  [key: string]: any;
}

/** 节点（版块）实体，字段以 /v6/user/customNodeList 与 /v6/page/dataList 返回为准。 */
export interface NodeEntity {
  id?: string | number;
  entityId?: string | number;
  entityType?: string;
  entityTemplate?: string;
  title?: string;
  subTitle?: string;
  description?: string;
  url?: string;
  logo?: string;
  pic?: string;
  cover?: string;
  icon?: string;
  nodeType?: number | string;
  nodeId?: string | number;
  action?: string;
  [key: string]: any;
}