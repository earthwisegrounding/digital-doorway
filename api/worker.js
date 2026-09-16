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


/* ---- Square webhook: payment.completed → admin alert + client thank-you ---- */
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function squareSignatureOk(env, request, rawBody) {
  const sig = request.headers.get('x-square-hmacsha256-signature') || '';
  if (!sig || !env.SQUARE_WEBHOOK_SIGNATURE_KEY) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SQUARE_WEBHOOK_SIGNATURE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(env.SQUARE_NOTIFICATION_URL + rawBody));
  return b64(mac) === sig;
}
const money = m => m && typeof m.amount === 'number' ? `$${(m.amount / 100).toFixed(2)}${m.currency && m.currency !== 'USD' ? ' ' + m.currency : ''}` : '—';

async function handleSquare(request, env, headers) {
  const raw = await request.text();
  if (!(await squareSignatureOk(env, request, raw))) return json(401, { error: 'bad signature' }, headers);
  let evt; try { evt = JSON.parse(raw); } catch { return json(400, { error: 'bad json' }, headers); }
  const p = evt && evt.data && evt.data.object && evt.data.object.payment;
  if (evt.type !== 'payment.completed' && evt.type !== 'payment.updated') return json(200, { ok: true, handled: 'ignored:' + evt.type }, headers);
  if (!p || p.status !== 'COMPLETED') return json(200, { ok: true, handled: 'ignored:status' }, headers);
  if (env.SQUARE_LOCATION_ID && p.location_id && p.location_id !== env.SQUARE_LOCATION_ID) return json(200, { ok: true, handled: 'ignored:location' }, headers);

  if (env.SEEN) { if (await env.SEEN.get(p.id)) return json(200, { ok: true, handled: 'ignored:duplicate' }, headers); await env.SEEN.put(p.id, '1', { expirationTtl: 60 * 60 * 24 * 60 }); }
  const amount = money(p.amount_money), buyer = (p.buyer_email_address || '').trim();
  const when = new Date(p.created_at || Date.now()).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' });
  const receipt = p.receipt_url || '';
  const admins = (env.NOTIFY_TO || '').split(',').map(s => s.trim()).filter(Boolean);
  const results = {};
  try {
    await send(env, { from: env.MAIL_FROM, to: admins, reply_to: buyer || undefined,
      subject: `New sale: ${amount} from ${buyer || 'a customer'}`,
      text: `A payment just came in through the Square link.\n\nAmount: ${amount}\nCustomer: ${buyer || '(no email on the payment)'}\nWhen: ${when} (Pacific)\nReceipt: ${p.receipt_number || '—'}${receipt ? ' ' + receipt : ''}\nSquare payment ID: ${p.id}\n\nNext step: reach out within one business day to book the first call.`,
      html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#1F1A14;max-width:560px"><h2 style="margin:0 0 12px;font-size:20px">New sale: ${esc(amount)}</h2>
        <table style="border-collapse:collapse">${[['Customer', buyer || '(no email on the payment)'], ['When', when + ' (Pacific)'], ['Receipt', p.receipt_number || '—'], ['Payment ID', p.id]].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6B5D4D">${k}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join('')}</table>
        ${receipt ? `<p><a href="${esc(receipt)}">View the Square receipt</a></p>` : ''}<p style="margin-top:20px">Next step: reach out within one business day to book the first call.</p></div>` });
    results.admins = 'sent';
  } catch (err) { results.admins = 'failed: ' + err.message; }
  if (buyer) {
    try {
      await send(env, { from: env.MAIL_FROM, to: [buyer], reply_to: admins[admins.length - 1],
        subject: 'Thank you — your website build is booked',
        text: `Thank you for your payment of ${amount} to Digital Doorway Marketing.\n\nHere's what happens next: Marv will email or call you within one business day to set up a short conversation about your business. From there we build the first version, you tell us what to change, and we launch.\n\nSquare has sent a separate receipt for your records${p.receipt_number ? ' (receipt #' + p.receipt_number + ')' : ''}.\n\nQuestions in the meantime? Reply to this email or call (877) 853-1920.\n\n— Marv Reeves\nDigital Doorway Marketing\nhttps://digitaldoorwaymarketing.com`,
        html: `<div style="font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#1F1A14;max-width:560px"><h2 style="margin:0 0 12px;font-size:22px">Thank you. The light's on.</h2>
          <p>Your payment of <b>${esc(amount)}</b> to Digital Doorway Marketing went through.</p>
          <p><b>What happens next:</b> Marv will email or call you within one business day to set up a short conversation about your business. From there we build the first version, you tell us what to change, and we launch.</p>
          <p>Square has sent a separate receipt for your records${p.receipt_number ? ' (receipt #' + esc(p.receipt_number) + ')' : ''}.</p>
          <p>Questions in the meantime? Reply to this email or call <a href="tel:+18778531920">(877) 853-1920</a>.</p>
          <p style="margin-top:24px">— Marv Reeves<br>Digital Doorway Marketing<br><a href="https://digitaldoorwaymarketing.com">digitaldoorwaymarketing.com</a></p></div>` });
      results.client = 'sent';
    } catch (err) { results.client = 'failed: ' + err.message; }
  } else results.client = 'skipped: no buyer email';
  return json(200, { ok: true, handled: 'sale', results }, headers);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(env, origin);
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/health') return json(200, { ok: true }, headers);
    if (request.method === 'POST' && url.pathname === '/square-webhook') return handleSquare(request, env, headers);
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
