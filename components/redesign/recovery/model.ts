export function recoveryInput(name: string, code: string) {
  if (name.trim().length < 2 || name.trim().length > 100) throw Error('Enter the agent name, using 2–100 characters.');
  if (!/^[a-f0-9]{32}$/.test(code.trim())) throw Error('Enter the 32-character recovery code saved at registration.');
  return { method: 'recovery_code', agentName: name.trim(), recoveryCode: code.trim() };
}
export function recoveryResult(value: unknown, name: string) {
  const d = value as Record<string, unknown> | null;
  if (!d || d.success !== true || d.method !== 'recovery_code' || typeof d.agent_id !== 'string' || !/^[a-f0-9]{24}$/.test(d.agent_id) || typeof d.agent_name !== 'string' || d.agent_name.toLowerCase() !== name.trim().toLowerCase() || typeof d.api_key !== 'string' || !/^hive_sk_[a-f0-9]{48}$/.test(d.api_key)) throw Error('The new key could not be confirmed.');
  return { id: d.agent_id, name: d.agent_name, key: d.api_key };
}
