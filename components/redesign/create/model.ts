export const categories = ['Development', 'Analysis', 'Security', 'Token Launch', 'Research', 'Content', 'Design', 'Social', 'Legal', 'Translation', 'Other'] as const;
export const draftKey = 'hive_create_task_draft';
export type Draft = {
  title: string; description: string; category: string; requirements: string; tags: string;
  checklist: string; budget: string; price: 'fixed' | 'negotiable'; method: 'proposals' | 'match';
  tokenName: string; tokenSymbol: string; tokenDescription: string;
};
export const emptyDraft: Draft = { title: '', description: '', category: '', requirements: '', tags: '', checklist: '', budget: '', price: 'fixed', method: 'proposals', tokenName: '', tokenSymbol: '', tokenDescription: '' };
export type Errors = Partial<Record<keyof Draft, string>>;
export const lines = (value: string) => value.split('\n').map(s => s.trim()).filter(Boolean);
export const tagList = (value: string) => value.split(',').map(s => s.trim()).filter(Boolean);
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
export function validateDraft(d: Draft): Errors {
  const e: Errors = {};
  if (d.title.trim().length < 8 || d.title.trim().length > 120) e.title = 'Use 8–120 characters for the task title.';
  if (!(categories as readonly string[]).includes(d.category)) e.category = 'Choose a category.';
  if (d.description.trim().length < 40 || d.description.trim().length > 5000) e.description = 'Describe the task in 40–5,000 characters.';
  if (d.requirements.length > 4000) e.requirements = 'Keep requirements within 4,000 characters.';
  if (lines(d.checklist).length > 8 || lines(d.checklist).some(s => s.length > 180)) e.checklist = 'Use up to 8 lines, with at most 180 characters per line.';
  const tags = tagList(d.tags);
  if (tags.length > 8 || tags.some(s => !/^[a-z0-9][a-z0-9 +#._-]{0,31}$/i.test(s))) e.tags = 'Use up to 8 tags of 32 characters. Use letters, numbers, spaces, +, #, ., _ or -.';
  if (d.price === 'fixed' && (!/^\d+(\.\d{1,2})?$/.test(d.budget) || Number(d.budget) <= 0 || Number(d.budget) > 100000)) e.budget = 'Enter an amount from 0.01 to 100,000 USDC, with up to 2 decimal places.';
  if (d.category === 'Token Launch' && [d.tokenName, d.tokenSymbol, d.tokenDescription].some(s => s.trim())) {
    if (!d.tokenName.trim() || d.tokenName.length > 32) e.tokenName = 'Enter a token name of up to 32 characters.';
    if (!d.tokenSymbol.trim() || d.tokenSymbol.length > 10) e.tokenSymbol = 'Enter a symbol of up to 10 characters.';
    if (!d.tokenDescription.trim() || d.tokenDescription.length > 500) e.tokenDescription = 'Describe the token in up to 500 characters.';
  }
  return e;
}
export function budgetLabel(d: Draft) { return d.price === 'negotiable' ? 'Negotiable' : d.budget && Number.isFinite(Number(d.budget)) ? `${Number(d.budget).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC` : 'Not set'; }
export function taskPayload(d: Draft, agentId: string | null, token: string) {
  return { title: d.title.trim(), description: d.description.trim(), category: d.category, requirements: d.requirements.trim(), tags: tagList(d.tags), budget: d.price === 'negotiable' ? 'Negotiable' : `$${Number(d.budget).toFixed(2)} USDC`, acceptanceRubric: lines(d.checklist), humanVerificationToken: token,
    assignmentMode: agentId ? 'direct' : 'proposals', ...(agentId ? { requestedAgentId: agentId } : {}),
    ...(d.category === 'Token Launch' && d.tokenName.trim() ? { tokenConfig: { name: d.tokenName.trim(), symbol: d.tokenSymbol.trim(), description: d.tokenDescription.trim() } } : {}),
  };
}
export function restoreDraft(raw: string | null): { draft: Draft; agentId: string | null } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw); const source = parsed.version === 2 ? parsed.draft : parsed.formData;
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    const d = { ...emptyDraft };
    for (const key of Object.keys(d) as (keyof Draft)[]) if (typeof source[key] === 'string') (d as Record<string, string>)[key] = source[key].slice(0, 12000);
    if (Array.isArray(source.tags)) d.tags = source.tags.filter((s: unknown) => typeof s === 'string').join(', ');
    if (Array.isArray(source.acceptanceRubric)) d.checklist = source.acceptanceRubric.filter((s: unknown) => typeof s === 'string').join('\n');
    d.price = source.price === 'negotiable' ? 'negotiable' : 'fixed'; d.method = source.method === 'match' ? 'match' : 'proposals';
    return { draft: d, agentId: validId(parsed.agentId) ? parsed.agentId : null };
  } catch { return null; }
}
export type SelectedAgent = { id: string; name: string; avatarSeed?: string; bio: string; available: boolean };
export function readSelectedAgent(value: unknown, expected: string): SelectedAgent {
  const a = (value as { agent?: Record<string, unknown> } | null)?.agent;
  if (!a || a.id !== expected || typeof a.name !== 'string' || !a.name.trim()) throw Error('Agent could not be loaded.');
  return { id: expected, name: a.name, ...(typeof a.avatarSeed === 'string' && a.avatarSeed ? { avatarSeed: a.avatarSeed } : {}), bio: typeof a.bio === 'string' ? a.bio : '', available: a.status == null || a.status === 'active' };
}
export function applySuggestedDraft(value: unknown, current: Draft): Draft {
  const s = value as Record<string, unknown>;
  if (!s || typeof s.title !== 'string' || typeof s.description !== 'string') throw Error('The draft could not be read.');
  const d = { ...current };
  for (const key of ['title', 'description', 'category', 'requirements'] as const) if (typeof s[key] === 'string') d[key] = s[key];
  if (Array.isArray(s.tags)) d.tags = s.tags.filter((v: unknown) => typeof v === 'string').join(', ');
  if (Array.isArray(s.acceptanceRubric)) d.checklist = s.acceptanceRubric.filter((v: unknown) => typeof v === 'string').join('\n');
  if (Array.isArray(s.deliverableSpecs)) {
    const requested = s.deliverableSpecs.filter(v => v && typeof v === 'object').map(v => {
      const spec = v as Record<string, unknown>;
      return [spec.label, spec.description].filter(part => typeof part === 'string' && part.trim()).join(': ');
    }).filter(Boolean);
    if (requested.length) d.requirements = [d.requirements, 'Requested output:', ...requested].filter(Boolean).join('\n');
  }
  // Budget and selected agent are deliberate client decisions; never replace them with a suggestion.
  return d;
}
