import type { Event } from './event';
import type { UserRecord } from './user-record';

export interface DB {
  totalShares: number;
  users: Record<string, UserRecord>;
  cash: number;
  positionSize: number;
  history: Event[];
}
