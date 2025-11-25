// Presence Indicator Components
export {
  PresenceIndicator,
  PresenceBadge,
  statusColors,
  statusLabels,
} from './presence-indicator';
export type {
  PresenceStatus,
  PresenceIndicatorProps,
  PresenceBadgeProps,
} from './presence-indicator';

// Status Selector
export { StatusSelector } from './status-selector';

// Online Users List
export { OnlineUsersList } from './online-users-list';
export type { OnlineUser } from './online-users-list';

// VP Status Card
export {
  VPStatusCard,
  VPStatusCardSkeleton,
} from './vp-status-card';
export type {
  DaemonHealthStatus,
  VPHealthMetrics,
  VPStatusData,
} from './vp-status-card';

// User Avatar with Presence
export {
  UserAvatarWithPresence,
  ConnectedUserAvatar,
} from './user-avatar-with-presence';
