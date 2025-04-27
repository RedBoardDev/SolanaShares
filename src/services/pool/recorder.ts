import type { DBRepository } from '@repositories/database-repository';
import type { Event } from '@domain/event';

export function recordEvent(repo: DBRepository, event: Event): void {
  repo.pushEvent(event);
}