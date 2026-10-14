/* CRM API for Digital Doorway Marketing's own leads and clients (Cloudflare D1, binding DB).
   The admin UI lives at digitaldoorwaymarketing.com/crm/.
   Sign-in: POST /crm/auth/request emails a 6-digit code to an address in CRM_ADMINS; POST /crm/auth/verify
   swaps it for a token (HMAC-signed with CRM_SESSION_SECRET, 30 days) sent as "Authorization: Bearer <token>".
   Website inquiries (/contact) and Square payments (/square-webhook) are recorded here automatically. */
import { json, esc, clip, send, EMAIL_RE } from './lib.js';

const TZ = 'America/Los_Angeles';
const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_TRIES = 3;
const CODES_PER_DAY = 10;
const CRM_MONTHLY_CENTS = 3495;        // CRM on its own, from month 13
const BUNDLE_MONTHLY_CENTS = 4995;     // Business Bundle (includes the CRM), from month 13
const BUNDLE_YEARLY_CENTS = 53946;     // the same bundle paid a year up front (10% off)

export const DEFAULT_STAGES = [
  { key: 'new', label: 'New lead', type: 'open' },
  { key: 'contacted', label: 'Contacted', type: 'open' },
  { key: 'demo', label: 'Demo built', type: 'open' },
  { key: 'offer', label: 'Offer sent', type: 'open' },
  { key: 'paid', label: 'Paid', type: 'won' },
  { key: 'live', label: 'Launched', type: 'live' },
  { key: 'lost', label: 'Lost', type: 'lost' },
];
const MANUAL_KINDS = ['note', 'call', 'email', 'meeting'];
const FIELDS = { name: 120, business: 160, email: 200, phone: 40, industry: 80, website: 300, city: 120, source: 80, tags: 300, notes: 4000 };
const DATE_FIELDS = ['launched_on', 'services_until', 'crm_free_until'];
const PLANS = { crm_plan: ['', 'free', 'paid', 'declined'], bundle_plan: ['', 'bundle', 'bundle_year', 'individual', 'declined'] };
const LIST_COLS = 'id, name, business, email, phone, industry, website, city, stage, value_cents, source, tags, launched_on, services_until, crm_free_until, crm_plan, bundle_plan, archived, created_at, updated_at, last_activity_at';

/* ---------- small utilities ---------- */
const enc = new TextEncoder();
const nowIso = () => new Date().toISOString();
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const dayOf = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}
const usd = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const sha256 = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const admins = env => (env.CRM_ADMINS || env.NOTIFY_TO || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const readJson = async request => { try { const b = await request.json(); return b && typeof b === 'object' ? b : null; } catch { return null; } };
const who = c => c.business || c.name || c.email || 'this contact';

/* ---------- sessions ---------- */
const hmacKey = secret => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
async function signToken(env, email) {
  const payload = b64u(enc.encode(JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(env.CRM_SESSION_SECRET), enc.encode(payload)));
  return payload + '.' + b64u(sig);
}
async function readToken(env, request) {
  const m = /^Bearer\s+([\w-]+)\.([\w-]+)$/.exec(request.headers.get('Authorization') || '');
  if (!m || !env.CRM_SESSION_SECRET) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(env.CRM_SESSION_SECRET), unb64u(m[2]), enc.encode(m[1])))) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(m[1])));
    return p.e && p.x > Date.now() / 1000 && admins(env).includes(p.e) ? p.e : null;   // removing an admin revokes access
  } catch { return null; }
}

async function authRequest(request, env, H) {
  const body = await readJson(request);
  const email = clip(body && body.email, 200).toLowerCase();
  const generic = json(200, { ok: true, message: 'If that address is on the admin list, a sign-in code is on its way.' }, H);
  if (!EMAIL_RE.test(email) || !admins(env).includes(email)) return generic;
  const now = Date.now(), day = today();
  const row = await env.DB.prepare('SELECT sent_at, day, day_count FROM login_codes WHERE email = ?').bind(email).first();
  if (row && now - row.sent_at < 30000) return generic;                 // one code per 30 seconds
  const count = row && row.day === day ? row.day_count : 0;
  if (count >= CODES_PER_DAY) return generic;                           // daily cap per address
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  await env.DB.prepare(`INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_at, day, day_count) VALUES (?, ?, ?, 0, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at, day = excluded.day, day_count = excluded.day_count`)
    .bind(email, await sha256(`${email}:${code}:${env.CRM_SESSION_SECRET}`), now + CODE_TTL_MS, now, day, count + 1).run();
  await send(env, {
    from: env.MAIL_FROM, to: [email],
    subject: `Your CRM sign-in code: ${code}`,
    headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },               // keeps Gmail from threading the codes together
    text: `Your Digital Doorway Marketing CRM sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<div style="font:16px/1.5 -apple-system,Segoe UI,sans-serif;color:#1F1A14;max-width:480px"><p style="margin:0 0 12px">Your Digital Doorway Marketing CRM sign-in code:</p>
      <p style="margin:0 0 16px;font:700 34px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;color:#10213F">${code}</p>
      <p style="margin:0;color:#6B5D4D;font-size:14px">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p></div>`,
  }).catch(err => { console.log('crm code email', err.message); throw Object.assign(new Error('mail'), { mailFailed: true }); });
  return generic;
}

async function authVerify(request, env, H) {
  const body = await readJson(request);
  const email = clip(body && body.email, 200).toLowerCase(), code = clip(body && body.code, 12).replace(/\D/g, '');
  const fail = msg => json(401, { error: msg }, H);
  if (!admins(env).includes(email)) return fail('That code is not valid.');
  const row = await env.DB.prepare('SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?').bind(email).first();
  if (!row || !row.code_hash || Date.now() > row.expires_at || row.attempts >= CODE_TRIES) return fail('That code has expired. Request a new one.');
  if ((await sha256(`${email}:${code}:${env.CRM_SESSION_SECRET}`)) !== row.code_hash) {
    await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
    return fail(row.attempts + 1 >= CODE_TRIES ? 'Too many tries. Request a new code.' : 'That code is not right. Check the email and try again.');
  }
  await env.DB.prepare("UPDATE login_codes SET code_hash = '' WHERE email = ?").bind(email).run();
  return json(200, { ok: true, token: await signToken(env, email), email }, H);
}

/* ---------- stages and contacts ---------- */
async function getStages(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'stages'").first();
  try { const s = row && JSON.parse(row.value); if (Array.isArray(s) && s.length) return s; } catch { /* fall through */ }
  return DEFAULT_STAGES;
}
const firstOpen = stages => (stages.find(s => s.type === 'open') || stages[0]).key;
const stageOf = (stages, key) => stages.find(s => s.key === key) || { key, label: key, type: 'open' };

function pickContact(body, stages) {
  const out = {};
  for (const [k, n] of Object.entries(FIELDS)) if (k in body) out[k] = clip(body[k], n);
  if ('email' in out) out.email = out.email.toLowerCase();
  if ('value_cents' in body) { const v = Math.round(Number(body.value_cents)); if (Number.isFinite(v) && v >= 0 && v <= 1e9) out.value_cents = v; }
  if ('stage' in body && stages.some(s => s.key === body.stage)) out.stage = body.stage;
  for (const k of DATE_FIELDS) if (k in body) out[k] = isDate(body[k]) ? body[k] : null;
  for (const [k, ok] of Object.entries(PLANS)) if (k in body && ok.includes(body[k])) out[k] = body[k];
  if ('archived' in body) out.archived = body.archived ? 1 : 0;
  return out;
}

/* Paid or launched → start the clocks: 12 months of included services and CRM (from the day it happens). */
function stageEffects(cur, stageKey, stages, on = today()) {
  const t = stageOf(stages, stageKey).type, set = {};
  if (t === 'won' || t === 'live') {
    if (!cur.services_until) set.services_until = addMonths(on, 12);
    if (!cur.crm_free_until) set.crm_free_until = addMonths(on, 12);
    if (!cur.crm_plan) set.crm_plan = 'free';
  }
  if (t === 'live' && !cur.launched_on) set.launched_on = on;
  return set;
}

async function updateContact(env, id, set) {
  const keys = Object.keys(set);                                         // keys come from the whitelists above
  if (!keys.length) return;
  await env.DB.prepare(`UPDATE contacts SET ${keys.map(k => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).bind(...keys.map(k => set[k]), nowIso(), id).run();
}
async function insertContact(env, c) {
  const at = nowIso(), keys = Object.keys(c);
  return env.DB.prepare(`INSERT INTO contacts (${keys.join(', ')}, created_at, updated_at) VALUES (${keys.map(() => '?').join(', ')}, ?, ?) RETURNING *`).bind(...keys.map(k => c[k]), at, at).first();
}
async function logActivity(env, contactId, kind, body, by, meta) {
  const at = nowIso();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO activities (contact_id, kind, body, meta, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(contactId, kind, clip(body, 4000), meta ? JSON.stringify(meta) : null, by || '', at),
    env.DB.prepare('UPDATE contacts SET last_activity_at = ? WHERE id = ?').bind(at, contactId),
  ]);
}
const addTask = (env, contactId, title, dueOn, by) =>
  env.DB.prepare('INSERT INTO tasks (contact_id, title, due_on, created_by, created_at) VALUES (?, ?, ?, ?, ?)').bind(contactId, clip(title, 200), dueOn, by || '', nowIso()).run();

/* ---------- hooks used by worker.js ---------- */
export async function crmCaptureLead(env, d) {
  if (!env.DB) return;
  const stages = await getStages(env);
  const email = d.email.toLowerCase();
  let c = await env.DB.prepare('SELECT * FROM contacts WHERE email = ?').bind(email).first();
  if (!c) {
    c = await insertContact(env, { name: d.name, business: d.business, email, phone: d.phone || '', industry: d.type || '', source: 'Website form', stage: firstOpen(stages) });
  } else {
    const fill = {};
    for (const [k, v] of [['name', d.name], ['business', d.business], ['phone', d.phone], ['industry', d.type]]) if (!c[k] && v) fill[k] = v;
    if (c.archived) fill.archived = 0;
    await updateContact(env, c.id, fill);
  }
  const body = [d.message || '(No message)', d.addons ? 'Add-ons: ' + d.addons : ''].filter(Boolean).join('\n\n');
  await logActivity(env, c.id, 'form', body, 'Website form');
  await addTask(env, c.id, `Reply to ${who(c)}'s inquiry`, today(), 'Website form');
}

export async function crmRecordPayment(env, p, sum) {
  if (!env.DB) return;
  const stages = await getStages(env);
  const email = (p.buyer_email_address || '').trim().toLowerCase();
  const paidOn = dayOf(p.created_at || Date.now());
  const amount = (p.amount_money && p.amount_money.amount) || 0;
  const items = sum && sum.items ? sum.items.map(i => `${i.name}: ${i.amount}`).join('\n') : '';
  let c = email ? await env.DB.prepare('SELECT * FROM contacts WHERE email = ?').bind(email).first() : null;
  if (email && !c) {
    const a = p.billing_address || p.shipping_address || {};
    c = await insertContact(env, { name: [a.first_name, a.last_name].filter(Boolean).join(' '), email, source: 'Square checkout', stage: firstOpen(stages) });
  }
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO payments (id, contact_id, amount_cents, currency, receipt_number, receipt_url, order_id, items, paid_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(p.id, c ? c.id : null, amount, (p.amount_money && p.amount_money.currency) || 'USD', p.receipt_number || null, p.receipt_url || null, p.order_id || null, items || null, paidOn, nowIso()).run();
  if (!ins.meta || !ins.meta.changes) return;                            // already recorded
  if (!c) { await addTask(env, null, `Match a Square payment of ${usd(amount)} (${p.id}) to a contact`, today(), 'Square'); return; }
  const set = {}, curType = stageOf(stages, c.stage).type, won = stages.find(s => s.type === 'won');
  if (curType !== 'won' && curType !== 'live' && won) set.stage = won.key;
  Object.assign(set, stageEffects(c, set.stage || c.stage, stages, paidOn));
  if (c.archived) set.archived = 0;
  await updateContact(env, c.id, set);
  await logActivity(env, c.id, 'payment', `Paid ${usd(amount)} through Square${p.receipt_number ? ` (receipt #${p.receipt_number})` : ''}.${items ? '\n\n' + items : ''}`, 'Square', { payment_id: p.id });
  if (set.stage) await logActivity(env, c.id, 'stage', `Moved from ${stageOf(stages, c.stage).label} to ${stageOf(stages, set.stage).label}`, 'Square');
  await addTask(env, c.id, `Book the first call with ${who(c)}`, today(), 'Square');
}

/* ---------- API routes ---------- */
async function summary(env) {
  const stages = await getStages(env);
  const d = today(), monthStart = d.slice(0, 8) + '01', week = addDays(d, 7), soon = addDays(d, 60);
  const [byStage, won, plans, due, upcoming, dated, recent] = (await env.DB.batch([
    env.DB.prepare('SELECT stage, COUNT(*) AS n, COALESCE(SUM(value_cents), 0) AS v FROM contacts WHERE archived = 0 GROUP BY stage'),
    env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents), 0) AS v FROM payments WHERE paid_on >= ?').bind(monthStart),
    env.DB.prepare("SELECT COALESCE(SUM(crm_plan = 'paid'), 0) AS crm, COALESCE(SUM(crm_plan = 'paid' AND bundle_plan NOT IN ('bundle', 'bundle_year')), 0) AS crmOnly, COALESCE(SUM(bundle_plan = 'bundle'), 0) AS bundle, COALESCE(SUM(bundle_plan = 'bundle_year'), 0) AS bundleYear FROM contacts WHERE archived = 0"),
    env.DB.prepare('SELECT COALESCE(SUM(due_on < ?), 0) AS overdue, COALESCE(SUM(due_on = ?), 0) AS today FROM tasks WHERE done = 0').bind(d, d),
    env.DB.prepare('SELECT t.id, t.title, t.due_on, t.contact_id, c.business, c.name, c.email FROM tasks t LEFT JOIN contacts c ON c.id = t.contact_id WHERE t.done = 0 AND (t.due_on IS NULL OR t.due_on <= ?) ORDER BY t.due_on IS NULL, t.due_on, t.id LIMIT 8').bind(week),
    env.DB.prepare("SELECT id, name, business, email, crm_free_until, crm_plan, services_until, bundle_plan FROM contacts WHERE archived = 0 AND ((crm_free_until IS NOT NULL AND crm_plan IN ('', 'free')) OR (services_until IS NOT NULL AND bundle_plan = ''))"),
    env.DB.prepare('SELECT a.id, a.kind, a.body, a.created_at, a.created_by, a.contact_id, c.business, c.name, c.email FROM activities a JOIN contacts c ON c.id = a.contact_id ORDER BY a.created_at DESC, a.id DESC LIMIT 12'),
  ])).map(r => r.results || []);
  const counts = Object.fromEntries(byStage.map(r => [r.stage, r]));
  const open = stages.filter(s => s.type === 'open').map(s => counts[s.key] || { n: 0, v: 0 });
  const renewals = [];
  for (const c of dated) {
    if (c.crm_free_until && ['', 'free'].includes(c.crm_plan) && c.crm_free_until <= soon) renewals.push({ kind: 'crm', date: c.crm_free_until, ...c });
    if (c.services_until && !c.bundle_plan && c.services_until <= soon) renewals.push({ kind: 'services', date: c.services_until, ...c });
  }
  renewals.sort((a, b) => a.date.localeCompare(b.date));
  return {
    today: d,
    stages: stages.map(s => ({ ...s, n: (counts[s.key] || {}).n || 0, v: (counts[s.key] || {}).v || 0 })),
    openCount: open.reduce((a, r) => a + r.n, 0),
    openValue: open.reduce((a, r) => a + r.v, 0),
    wonMonth: { n: won[0].n, v: won[0].v },
    crmPaid: plans[0].crm, bundles: plans[0].bundle + plans[0].bundleYear,
    mrrCents: plans[0].crmOnly * CRM_MONTHLY_CENTS + plans[0].bundle * BUNDLE_MONTHLY_CENTS + Math.round(plans[0].bundleYear * BUNDLE_YEARLY_CENTS / 12),
    tasksOverdue: due[0].overdue, tasksToday: due[0].today,
    upcoming, renewals: renewals.slice(0, 8), recent,
  };
}

function cleanStages(raw) {
  if (!Array.isArray(raw) || raw.length < 4 || raw.length > 15) return null;
  const out = [], seen = new Set();
  for (const s of raw) {
    const label = clip(s && s.label, 40);
    if (!label) return null;
    const type = ['open', 'won', 'live', 'lost'].includes(s.type) ? s.type : 'open';
    let key = clip(s.key, 32).toLowerCase().replace(/[^a-z0-9-]/g, '') || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || 'stage';
    if (seen.has(key)) { let i = 2; while (seen.has(`${key}-${i}`)) i++; key = `${key}-${i}`; }
    seen.add(key);
    out.push({ key, label, type });
  }
  for (const t of ['won', 'live', 'lost']) if (out.filter(s => s.type === t).length !== 1) return null;
  return out.some(s => s.type === 'open') ? out : null;
}

const csvCell = v => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;                               // keep spreadsheets from running formulas
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export async function handleCrm(request, env, cors, url) {
  const H = { ...cors, 'Cache-Control': 'no-store' };
  if (!env.DB || !env.CRM_SESSION_SECRET) return json(500, { error: 'The CRM is not configured.' }, H);
  const path = url.pathname.replace(/\/+$/, ''), method = request.method;
  try {
    if (method === 'POST' && path === '/crm/auth/request') {
      try { return await authRequest(request, env, H); }
      catch (err) { if (err.mailFailed) return json(502, { error: 'The code email didn’t go out. Try again in a minute.' }, H); throw err; }
    }
    if (method === 'POST' && path === '/crm/auth/verify') return await authVerify(request, env, H);
    const me = await readToken(env, request);
    if (!me) return json(401, { error: 'Please sign in again.' }, H);
    const DB = env.DB;
    let m;

    if (method === 'GET' && path === '/crm/me') return json(200, { email: me }, H);
    if (method === 'GET' && path === '/crm/summary') return json(200, await summary(env), H);

    if (path === '/crm/settings') {
      if (method === 'GET') return json(200, { stages: await getStages(env), defaults: DEFAULT_STAGES, admins: admins(env) }, H);
      if (method === 'PUT') {
        const body = await readJson(request), stages = body && cleanStages(body.stages);
        if (!stages) return json(400, { error: 'Stages need names, at least one open stage, and exactly one Paid, Launched, and Lost stage.' }, H);
        const keys = stages.map(s => s.key);
        await DB.batch([
          DB.prepare("INSERT INTO settings (key, value) VALUES ('stages', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(stages)),
          DB.prepare(`UPDATE contacts SET stage = ?, updated_at = ? WHERE stage NOT IN (${keys.map(() => '?').join(', ')})`).bind(firstOpen(stages), nowIso(), ...keys),
        ]);
        return json(200, { stages }, H);
      }
    }

    if (path === '/crm/contacts') {
      if (method === 'GET') return json(200, { contacts: (await DB.prepare(`SELECT ${LIST_COLS} FROM contacts ORDER BY COALESCE(last_activity_at, updated_at) DESC LIMIT 5000`).all()).results }, H);
      if (method === 'POST') {
        const body = await readJson(request); if (!body) return json(400, { error: 'Bad request.' }, H);
        const stages = await getStages(env), c = pickContact(body, stages);
        if (!c.name && !c.business && !c.email) return json(400, { error: 'Add at least a name, a business, or an email.' }, H);
        if (c.email && !EMAIL_RE.test(c.email)) return json(400, { error: 'That email address doesn’t look right.' }, H);
        if (c.email) { const ex = await DB.prepare('SELECT id FROM contacts WHERE email = ?').bind(c.email).first(); if (ex) return json(409, { error: 'A contact with that email already exists.', id: ex.id }, H); }
        if (!c.stage) c.stage = firstOpen(stages);
        Object.assign(c, stageEffects(c, c.stage, stages));
        const row = await insertContact(env, c);
        await logActivity(env, row.id, 'system', `Added by ${me}`, me);
        return json(201, { contact: row }, H);
      }
    }

    if ((m = /^\/crm\/contacts\/(\d+)$/.exec(path))) {
      const id = +m[1];
      const cur = await DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();
      if (!cur) return json(404, { error: 'That contact no longer exists.' }, H);
      if (method === 'GET') {
        const [acts, tasks, pays] = (await DB.batch([
          DB.prepare('SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC, id DESC LIMIT 300').bind(id),
          DB.prepare('SELECT * FROM tasks WHERE contact_id = ? ORDER BY done, due_on IS NULL, due_on, id').bind(id),
          DB.prepare('SELECT * FROM payments WHERE contact_id = ? ORDER BY paid_on DESC').bind(id),
        ])).map(r => r.results || []);
        return json(200, { contact: cur, activities: acts, tasks, payments: pays }, H);
      }
      if (method === 'PATCH') {
        const body = await readJson(request); if (!body) return json(400, { error: 'Bad request.' }, H);
        const stages = await getStages(env), set = pickContact(body, stages);
        if (set.email && !EMAIL_RE.test(set.email)) return json(400, { error: 'That email address doesn’t look right.' }, H);
        if (set.email && set.email !== cur.email) { const ex = await DB.prepare('SELECT id FROM contacts WHERE email = ? AND id <> ?').bind(set.email, id).first(); if (ex) return json(409, { error: 'Another contact already uses that email.', id: ex.id }, H); }
        const moved = set.stage && set.stage !== cur.stage;
        if (moved) for (const [k, v] of Object.entries(stageEffects(cur, set.stage, stages))) if (!(k in set)) set[k] = v;
        await updateContact(env, id, set);
        if (moved) await logActivity(env, id, 'stage', `Moved from ${stageOf(stages, cur.stage).label} to ${stageOf(stages, set.stage).label}`, me);
        if ('archived' in set && set.archived !== cur.archived) await logActivity(env, id, 'system', set.archived ? `Archived by ${me}` : `Restored by ${me}`, me);
        return json(200, { contact: await DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first() }, H);
      }
      if (method === 'DELETE') { await DB.prepare('DELETE FROM contacts WHERE id = ?').bind(id).run(); return json(200, { ok: true }, H); }
    }

    if ((m = /^\/crm\/contacts\/(\d+)\/activities$/.exec(path)) && method === 'POST') {
      const id = +m[1], body = await readJson(request);
      const kind = body && MANUAL_KINDS.includes(body.kind) ? body.kind : null, text = clip(body && body.body, 4000);
      if (!kind || !text) return json(400, { error: 'Write something first.' }, H);
      if (!(await DB.prepare('SELECT id FROM contacts WHERE id = ?').bind(id).first())) return json(404, { error: 'That contact no longer exists.' }, H);
      await logActivity(env, id, kind, text, me);
      return json(201, { activity: await DB.prepare('SELECT * FROM activities WHERE contact_id = ? ORDER BY id DESC LIMIT 1').bind(id).first() }, H);
    }
    if ((m = /^\/crm\/activities\/(\d+)$/.exec(path)) && method === 'DELETE') {
      const r = await DB.prepare(`DELETE FROM activities WHERE id = ? AND kind IN (${MANUAL_KINDS.map(() => '?').join(', ')})`).bind(+m[1], ...MANUAL_KINDS).run();
      return r.meta.changes ? json(200, { ok: true }, H) : json(400, { error: 'Only notes, calls, emails, and meetings can be deleted.' }, H);
    }

    if (path === '/crm/tasks') {
      if (method === 'GET') {
        const done = url.searchParams.get('done') === '1';
        const sql = `SELECT t.*, c.business, c.name, c.email FROM tasks t LEFT JOIN contacts c ON c.id = t.contact_id WHERE t.done = ? ORDER BY ${done ? 't.done_at DESC LIMIT 50' : 't.due_on IS NULL, t.due_on, t.id LIMIT 1000'}`;
        return json(200, { tasks: (await DB.prepare(sql).bind(done ? 1 : 0).all()).results }, H);
      }
      if (method === 'POST') {
        const body = await readJson(request), title = clip(body && body.title, 200);
        if (!title) return json(400, { error: 'Give the task a name.' }, H);
        const cid = body.contact_id ? +body.contact_id : null;
        if (cid && !(await DB.prepare('SELECT id FROM contacts WHERE id = ?').bind(cid).first())) return json(404, { error: 'That contact no longer exists.' }, H);
        const r = await DB.prepare('INSERT INTO tasks (contact_id, title, due_on, created_by, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *').bind(cid, title, isDate(body.due_on) ? body.due_on : null, me, nowIso()).first();
        return json(201, { task: r }, H);
      }
    }
    if ((m = /^\/crm\/tasks\/(\d+)$/.exec(path))) {
      const id = +m[1], cur = await DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
      if (!cur) return json(404, { error: 'That task no longer exists.' }, H);
      if (method === 'DELETE') { await DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run(); return json(200, { ok: true }, H); }
      if (method === 'PATCH') {
        const body = (await readJson(request)) || {}, set = {};
        if ('title' in body && clip(body.title, 200)) set.title = clip(body.title, 200);
        if ('due_on' in body) set.due_on = isDate(body.due_on) ? body.due_on : null;
        if ('done' in body) { set.done = body.done ? 1 : 0; set.done_at = body.done ? nowIso() : null; }
        const keys = Object.keys(set);
        if (keys.length) await DB.prepare(`UPDATE tasks SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).bind(...keys.map(k => set[k]), id).run();
        if (set.done && !cur.done && cur.contact_id) await logActivity(env, cur.contact_id, 'task', `Done: ${cur.title}`, me);
        return json(200, { task: await DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first() }, H);
      }
    }

    if (method === 'GET' && path === '/crm/renewals') {
      const rows = (await DB.prepare('SELECT id, name, business, email, phone, launched_on, crm_free_until, crm_plan, services_until, bundle_plan FROM contacts WHERE archived = 0 AND (crm_free_until IS NOT NULL OR services_until IS NOT NULL)').all()).results;
      return json(200, { today: today(), contacts: rows }, H);
    }

    if (method === 'GET' && path === '/crm/export.csv') {
      const stages = await getStages(env);
      const rows = (await DB.prepare('SELECT * FROM contacts ORDER BY id').all()).results;
      const cols = ['id', 'business', 'name', 'email', 'phone', 'industry', 'city', 'website', 'stage', 'value', 'source', 'tags', 'launched_on', 'services_until', 'crm_free_until', 'crm_plan', 'bundle_plan', 'archived', 'created_at', 'last_activity_at', 'notes'];
      const lines = [cols.join(',')].concat(rows.map(r => cols.map(k => csvCell(k === 'stage' ? stageOf(stages, r.stage).label : k === 'value' ? (r.value_cents / 100).toFixed(2) : r[k])).join(',')));
      return new Response(lines.join('\r\n') + '\r\n', { status: 200, headers: { ...H, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ddm-crm-contacts-${today()}.csv"` } });
    }

    return json(404, { error: 'Not found.' }, H);
  } catch (err) {
    console.log('crm error', path, err && err.stack || err);
    return json(500, { error: 'Something went wrong in the CRM.', detail: String(err && err.message || err) }, H);
  }
}
