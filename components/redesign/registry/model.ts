export const pageSize = 12;
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
export function safeUrl(v: unknown) { try { const u = new URL(text(v)); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
export type Tool = { id: string; name: string; description: string; external: boolean; provider: { id: string; name: string }; price: number | null; status: string; token: string; symbol: string; remote: string; command: string; website: string; source: string; auth: boolean | null; schema: Record<string, unknown> | null; updated: string };
export function readDirectory(value: unknown) {
  const d = record(value);
  if (!Array.isArray(d.tools) || typeof d.limited !== 'boolean') throw Error('Invalid tool directory.');
  const seen = new Set<string>();
  const tools: Tool[] = d.tools.map(v => {
    const t = record(v), p = record(t.provider), external = t.catalogOnly === true;
    const name = text(t.name), providerId = text(p.id), id = JSON.stringify([external ? 'external' : 'hive', providerId, name]);
    if (!name || !text(p.name) || !providerId || !external && !/^[a-f0-9]{24}$/i.test(providerId) || text(t.id) !== id || seen.has(id)) throw Error('Invalid tool identity.');
    seen.add(id);
    return { id, name, description: text(t.description), external, provider: { id: providerId, name: text(p.name) }, price: !external && t.currency === 'USDC' && typeof t.costPerCall === 'number' && Number.isFinite(t.costPerCall) && t.costPerCall >= 0 ? t.costPerCall : null,
      status: text(t.status), token: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text(t.tokenMint)) ? text(t.tokenMint) : '', symbol: text(t.tokenSymbol), remote: safeUrl(t.remoteUrl), command: external && text(t.installCommand).length <= 2000 && !/[\r\n\x00]/.test(text(t.installCommand)) ? text(t.installCommand) : '', website: safeUrl(t.websiteUrl), source: safeUrl(t.sourceUrl), auth: typeof t.authRequired === 'boolean' ? t.authRequired : null,
      schema: !external && t.inputSchema && typeof t.inputSchema === 'object' && !Array.isArray(t.inputSchema) ? record(t.inputSchema) : null, updated: typeof t.updatedAt === 'string' && Number.isFinite(Date.parse(t.updatedAt)) ? new Date(t.updatedAt).toISOString() : '' };
  });
  return { tools, limited: d.limited };
}
export type Filters = { search: string; source: 'all' | 'hive' | 'external'; token: boolean; sort: 'name' | 'price'; page: number };
export function readFilters(p: URLSearchParams): Filters { const n = Number(p.get('page') || 1); return { search: (p.get('search') || '').trim().slice(0, 160), source: p.get('source') === 'hive' ? 'hive' : p.get('source') === 'external' ? 'external' : 'all', token: p.get('token') === '1', sort: p.get('sort') === 'price' ? 'price' : 'name', page: Number.isSafeInteger(n) && n > 0 && n <= 100000 ? n : 1 }; }
export function pageUrl(f: Filters) { const p = new URLSearchParams(); if (f.search) p.set('search', f.search); if (f.source !== 'all') p.set('source', f.source); if (f.token) p.set('token', '1'); if (f.sort !== 'name') p.set('sort', f.sort); if (f.page !== 1) p.set('page', String(f.page)); return '/registry' + (p.size ? '?' + p : ''); }
export function filterTools(tools: Tool[], f: Filters) { return tools.filter(t => (f.source === 'all' || t.external === (f.source === 'external')) && (!f.token || !!t.token) && (!f.search || [t.name, t.description, t.provider.name, t.symbol].join(' ').toLowerCase().includes(f.search.toLowerCase()))).sort((a, b) => (f.sort === 'price' ? (a.price ?? Infinity) - (b.price ?? Infinity) : 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)); }
export function priceLabel(t: Tool) { if (t.external) return 'See provider'; if (t.price === null) return 'Not listed'; if (t.price > 0 && t.price < .000001) return '<0.000001 USDC'; return t.price.toLocaleString('en', { maximumFractionDigits: 6 }) + ' USDC'; }
