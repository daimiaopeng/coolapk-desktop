/** 酷友圈活动（Event）实体，字段以 APK Event model 与 /v6/event/* 接口为准。 */
export interface CoolEvent {
  id: string | number;
  uid?: string | number;
  username?: string;
  userAvatar?: string;
  title?: string;
  subTitle?: string;
  description?: string;
  content?: string;
  type?: string;
  pic?: string;
  picArr?: string[];
  url?: string;
  actionUrl?: string;
  action_url?: string;
  regNum?: string;
  reg_num?: string;
  stageStatus?: number;
  stage_status?: number;
  isJoinStatus?: number;
  is_join_status?: number;
  isPrize?: number;
  is_get_prize?: number;
  noticeRule?: string;
  notice_rule?: string;
  prizeUser?: string;
  prize_user?: string;
  prizeUserUrl?: string;
  timeRegStart?: number | string;
  time_reg_start?: number | string;
  timeRegEnd?: number | string;
  time_reg_end?: number | string;
  timeEnd?: number | string;
  time_end?: number | string;
  dateline?: number | string;
  lastupdate?: number | string;
  logo?: string;
  sponsorUser?: any[];
  sponsorGoods?: any[];
  sponsorPrize?: any[];
  tabList?: any[];
  tabApiList?: any[];
  list?: any[];
  [key: string]: any;
}

export interface CoolEventTab {
  url: string;
  title?: string;
  subTitle?: string;
  pageName?: string;
  entityType?: string;
  raw?: any;
  [key: string]: any;
}