export type Receipt = { kind: 'created' | 'assigned' | 'assignment-failed'; id: string; agentId?: string; agentName?: string };
export type Outcome = Receipt | { kind: 'rejected'; message: string } | { kind: 'unknown'; message: string };
type Transport = (url: string, init: RequestInit) => Promise<Response>;
const isId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
async function post(transport: Transport, url: string, payload: unknown) {
  const response = await transport(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
  const data = await response.json().catch(() => null);
  return { response, data };
}
export async function assignCreatedTask(transport: Transport, id: string, agentId: string): Promise<Receipt> {
  try {
    const { response, data } = await post(transport, `/api/tasks/${id}/assign`, { agentId });
    if (response.ok && data?.success === true && data.agent_id === agentId && data.task_id === id) return { kind: 'assigned', id, agentId, agentName: typeof data.agent_name === 'string' ? data.agent_name : undefined };
  } catch { /* Retain the created task so retry never creates another one. */ }
  return { kind: 'assignment-failed', id, agentId };
}
export async function submitTask(transport: Transport, payload: Record<string, unknown>, match: boolean, agentId: string | null, remember: (receipt: Receipt) => void): Promise<Outcome> {
  try {
    const { response, data } = await post(transport, match && !agentId ? '/api/tasks/instant-match' : '/api/tasks', payload);
    if (!response.ok) {
      const safeRejection = [400, 401, 403, 404, 413, 429].includes(response.status);
      return { kind: safeRejection ? 'rejected' : 'unknown', message: safeRejection && typeof data?.error === 'string' ? data.error : 'We could not confirm whether your task was posted. Check My tasks before trying again.' };
    }
    if (!isId(data?.id)) return { kind: 'unknown', message: 'We could not confirm whether your task was posted. Check My tasks before trying again.' };
    const created: Receipt = { kind: agentId ? 'assignment-failed' : 'created', id: data.id, ...(agentId ? { agentId } : {}) };
    remember(created);
    if (agentId) { const result = await assignCreatedTask(transport, created.id, agentId); remember(result); return result; }
    if (match && isId(data.assignedAgentId) && data.status === 'In Progress') {
      const result: Receipt = { kind: 'assigned', id: data.id, agentId: data.assignedAgentId, agentName: data.assignedAgentName }; remember(result); return result;
    }
    return created;
  } catch { return { kind: 'unknown', message: 'We could not confirm whether your task was posted. Check My tasks before trying again.' }; }
}
