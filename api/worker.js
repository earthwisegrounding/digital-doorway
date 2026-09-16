/* Contact-form mailer. POST /contact with JSON {name, business, email, phone, type, message}
   → one notification email to NOTIFY_TO via Resend, reply-to set to the visitor. */
const cors = (env, origin) => {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
};
const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => String(s || '').trim().slice(0, n);

async function send(env, msg) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`resend ${r.status}: ${body.message || body.name || 'unknown'}`);
  return body;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(env, origin);
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/health') return json(200, { ok: true }, headers);
    if (request.method !== 'POST' || url.pathname !== '/contact') return json(404, { error: 'not found' }, headers);
    if (!env.RESEND_API_KEY) return json(500, { error: 'mailer not configured' }, headers);

    let data;
    try { data = await request.json(); } catch { return json(400, { error: 'bad json' }, headers); }
    if (data.website) return json(200, { ok: true }, headers);            // honeypot: bots fill hidden fields
    const name = clip(data.name, 120), business = clip(data.business, 160), email = clip(data.email, 200);
    const phone = clip(data.phone, 40), type = clip(data.type, 80), message = clip(data.message, 4000);
    if (!name || !business || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'missing fields' }, headers);

    const to = (env.NOTIFY_TO || '').split(',').map(s => s.trim()).filter(Boolean);
    const lines = [['Name', name], ['Business', business], ['Email', email], ['Phone', phone || '—'], ['Type of business', type || '—']];
    const text = lines.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nMessage:\n${message || '(none)'}\n\n— Sent from the contact form at digitaldoorwaymarketing.com`;
    const html = `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#1F1A14;max-width:560px">
      <h2 style="margin:0 0 12px;font-size:20px">New website inquiry: ${esc(business)}</h2>
      <table style="border-collapse:collapse">${lines.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6B5D4D">${k}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join('')}</table>
      <p style="margin:16px 0 4px;color:#6B5D4D">Message</p><p style="white-space:pre-wrap;margin:0">${esc(message) || '(none)'}</p>
      <p style="margin-top:24px;font-size:13px;color:#6B5D4D">Reply to this email to answer ${esc(name)} directly. Sent from the contact form at digitaldoorwaymarketing.com.</p></div>`;

    try {
      await send(env, { from: env.MAIL_FROM, to, reply_to: email, subject: `New inquiry: ${business} (${name})`, text, html });
      if ((env.AUTO_REPLY || 'no').toLowerCase() === 'yes') {
        await send(env, { from: env.MAIL_FROM, to: [email], subject: 'Got it — Digital Doorway Marketing',
          text: `Hi ${name},\n\nThanks for reaching out about ${business}. We'll get back to you within one business day.\n\nIn the meantime, questions? Reply to this email or call (877) 853-1920.\n\n— Marv Reeves\nDigital Doorway Marketing\nhttps://digitaldoorwaymarketing.com` });
      }
    } catch (err) {
      return json(502, { error: 'send failed', detail: String(err.message || err) }, headers);
    }
    return json(200, { ok: true }, headers);
  },
};
