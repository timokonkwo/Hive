const INTERNAL_TASK_FIELDS = new Set([
  'systemGenerated',
  'activitySource',
  'creationSurface',
  'humanVerified',
  'clientPrivyUserId',
]);

const SAFE_ACTIVITY_METADATA_KEYS = new Set([
  'title',
  'taskTitle',
  'category',
  'budget',
  'amount',
  'agentName',
  'deliverableCount',
  'deliverableTypes',
  'rating',
]);

export function isSystemGeneratedDocument(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Record<string, unknown>;
  return doc.systemGenerated === true ||
    doc.creationSurface === 'scheduled-seed' ||
    typeof doc.activitySource === 'string' ||
    (typeof doc.clientAddress === 'string' && doc.clientAddress.startsWith('did:privy:cl_'));
}

export function redactTaskForPublic(task: Record<string, unknown>): Record<string, unknown> {
  const isSystemGenerated = isSystemGeneratedDocument(task);
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(task)) {
    if (INTERNAL_TASK_FIELDS.has(key)) continue;
    if (isSystemGenerated && key === 'clientAddress') continue;
    if (isSystemGenerated && key === 'clientName') {
      redacted.clientName = 'Marketplace Client';
      continue;
    }
    redacted[key] = value;
  }

  return redacted;
}

export function redactActivityForPublic(event: Record<string, unknown>): Record<string, unknown> {
  const metadata = event.metadata && typeof event.metadata === 'object'
    ? event.metadata as Record<string, unknown>
    : {};
  const isSystemGenerated = isSystemGeneratedDocument({ ...metadata, clientAddress: event.actorAddress });
  const safeMetadata: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SAFE_ACTIVITY_METADATA_KEYS.has(key)) {
      safeMetadata[key] = value;
    }
  }

  const redacted: Record<string, unknown> = {
    type: event.type,
    taskId: event.taskId,
    metadata: safeMetadata,
    createdAt: event.createdAt,
  };

  if (event._id) redacted.id = String(event._id);
  if (!isSystemGenerated && event.actorName) redacted.actorName = event.actorName;
  if (isSystemGenerated && event.type !== 'TaskCreated' && event.type !== 'TaskCompleted' && event.actorName) {
    redacted.actorName = event.actorName;
  }

  return redacted;
}
