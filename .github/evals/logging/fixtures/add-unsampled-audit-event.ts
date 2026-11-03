declare const logger: {
  isDebugEnabled(): boolean;
  shouldSample(): boolean;
  emit(event: Record<string, unknown>): void;
};

export function recordRoleChange(actorId: string, targetId: string, timestamp: string): void {
  if (logger.isDebugEnabled() && logger.shouldSample()) {
    logger.emit({
      category: 'audit',
      actorId,
      targetId,
      action: 'role_changed',
      result: 'success',
      timestamp,
    });
  }
}
