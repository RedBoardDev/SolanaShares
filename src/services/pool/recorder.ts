import type { DBRepository } from '@repositories/database-repository';
import type { Event } from '@domain/event';

export function recordEvent(repo: DBRepository, event: Event): void {
  const db = repo.getDB();
  db.history.push(event);
  repo.save();
}
