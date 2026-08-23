import type { MoreNavItem } from '../types/navigation';

export const moreNavs: MoreNavItem[] = [
  { key: 'my_likes', path: '/more?section=my_likes', label: '我的赞', icon: 'far fa-thumbs-up' },
  { key: 'followed_nodes', path: '/more?section=followed_nodes', label: '关注的论坛', icon: 'fas fa-comments' },
  { key: 'followed_topics', path: '/more?section=followed_topics', label: '关注的话题', icon: 'fas fa-hashtag' },
  { key: 'recent_contacts', path: '/more?section=recent_contacts', label: '最近联系人', icon: 'far fa-address-book' },
  { key: 'recycle_bin', path: '/more?section=recycle_bin', label: '内容回收站', icon: 'fas fa-trash-can' },
  { key: 'hidden_replies', path: '/more?section=hidden_replies', label: '隐藏的回复', icon: 'far fa-eye-slash' },
  { key: 'my_devices', path: '/more?section=my_devices', label: '我的设备', icon: 'fas fa-mobile-screen-button' },
  { key: 'my_albums', path: '/more?section=my_albums', label: '我的专辑', icon: 'fas fa-layer-group' },
  { key: 'my_votes', path: '/more?section=my_votes', label: '我的投票', icon: 'fas fa-square-poll-vertical' },
];
