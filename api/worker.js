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


/* ---- Checkout: $499 build + optional add-ons → a Square payment link for exactly that order ----
   Prices live here (server side) so the browser can't change what gets charged. */
const CATALOG = {
  build:   { name: 'Website design and build, including first 2 years of hosting and domain registration (one-time)', cents: 49900, required: true },
  bundle:  { name: 'Small Business Bundle: SSL, 5 email accounts, hosting from year 3 (first month)', cents: 3499, renews: 'month', renewCents: 3499 },
  hosting: { name: 'Website Hosting (first month)', cents: 1499, renews: 'month', renewCents: 1499 },
  ssl:     { name: 'SSL Website Security (first month)', cents: 599, renews: 'month', renewCents: 599 },
  email1:  { name: 'Professional Business Email: 1 account (first year)', cents: 5900, renews: 'year', renewCents: 5900 },
  email3:  { name: 'Professional Business Email: 3 accounts (first year)', cents: 12900, renews: 'year', renewCents: 12900 },
  email5:  { name: 'Professional Business Email: 5 accounts (first year)', cents: 19900, renews: 'year', renewCents: 19900 },
  domain:  { name: 'Domain name registration (priced after we check availability)', cents: 0 },
};
function resolveItems(raw) {
  const want = new Set((Array.isArray(raw) ? raw : []).map(String).filter(k => CATALOG[k]));
  want.add('build');
  if (want.has('bundle')) ['hosting', 'ssl', 'email1', 'email3', 'email5'].forEach(k => want.delete(k));
  const emails = ['email5', 'email3', 'email1'].filter(k => want.has(k));
  emails.slice(1).forEach(k => want.delete(k));                       // at most one email plan (keep the largest)
  return ['build', 'bundle', 'hosting', 'ssl', 'email1', 'email3', 'email5', 'domain'].filter(k => want.has(k));
}
async function squareApi(env, method, path, body) {
  const r = await fetch('https://connect.squareup.com' + path, { method, headers: { 'Authorization': `Bearer ${env.SQUARE_ACCESS_TOKEN}`, 'Square-Version': '2025-08-20', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.errors && data.errors[0] && (data.errors[0].detail || data.errors[0].code)) || ('square ' + r.status));
  return data;
}
async function handleCheckout(request, env, headers) {
  if (!env.SQUARE_ACCESS_TOKEN) return json(500, { error: 'checkout not configured' }, headers);
  let data; try { data = await request.json(); } catch { return json(400, { error: 'bad json' }, headers); }
  const keys = resolveItems(data.items);
  const email = clip(data.email, 200);
  const monthly = keys.reduce((s, k) => s + (CATALOG[k].renews === 'month' ? CATALOG[k].renewCents : 0), 0);
  const yearly = keys.reduce((s, k) => s + (CATALOG[k].renews === 'year' ? CATALOG[k].renewCents : 0), 0);
  const lineItems = keys.filter(k => CATALOG[k].cents > 0).map(k => ({ name: CATALOG[k].name, quantity: '1', base_price_money: { amount: CATALOG[k].cents, currency: 'USD' } }));
  const selected = keys.filter(k => k !== 'build');
  const noteParts = [];
  if (selected.length) noteParts.push('Add-ons: ' + selected.map(k => CATALOG[k].name).join('; '));
  if (monthly) noteParts.push(`Renews: $${(monthly / 100).toFixed(2)}/month`);
  if (yearly) noteParts.push(`Email renews: $${(yearly / 100).toFixed(2)}/year`);
  const body = {
    idempotency_key: crypto.randomUUID(),
    description: 'Digital Doorway Marketing: website build' + (selected.length ? ' and add-ons' : ''),
    order: {
      location_id: env.SQUARE_LOCATION_ID,
      line_items: lineItems,
      metadata: { items: keys.join(','), monthly_cents: String(monthly), yearly_cents: String(yearly), domain_requested: keys.includes('domain') ? 'yes' : 'no' },
    },
    checkout_options: { allow_tipping: false, ask_for_shipping_address: false, redirect_url: 'https://digitaldoorwaymarketing.com/thank-you.html', merchant_support_email: 'info@digitaldoorwaymarketing.com' },
    payment_note: clip(noteParts.join(' | '), 500) || undefined,
  };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) body.pre_populated_data = { buyer_email: email };
  try {
    const r = await squareApi(env, 'POST', '/v2/online-checkout/payment-links', body);
    return json(200, { ok: true, url: r.payment_link.url }, headers);
  } catch (err) {
    return json(502, { error: 'checkout failed', detail: String(err.message || err) }, headers);
  }
}
/* ---- Order request: the customer picks the build + add-ons; we email the order so an invoice can be sent ---- */
async function handleOrderRequest(request, env, headers) {
  let data; try { data = await request.json(); } catch { return json(400, { error: 'bad json' }, headers); }
  if (data.website) return json(200, { ok: true }, headers);                    // honeypot
  const name = clip(data.name, 120), business = clip(data.business, 160), email = clip(data.email, 200);
  if (!name || !business || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'missing fields' }, headers);
  const keys = resolveItems(data.items).filter(k => k !== 'hosting' && k !== 'domain');   // both included for 2 years
  const first = keys.reduce((s, k) => s + CATALOG[k].cents, 0);
  const monthly = keys.reduce((s, k) => s + (CATALOG[k].renews === 'month' ? CATALOG[k].renewCents : 0), 0);
  const yearly = keys.reduce((s, k) => s + (CATALOG[k].renews === 'year' ? CATALOG[k].renewCents : 0), 0);
  const usd = c => `$${(c / 100).toFixed(2)}`;
  const items = keys.map(k => ({ name: CATALOG[k].name, amount: usd(CATALOG[k].cents) }));
  const renew = ['Hosting and domain: included for the first 2 years, then hosting $14.99/month and the domain renews yearly'];
  if (monthly) renew.push(`${usd(monthly)}/month starting next month`);
  if (yearly) renew.push(`${usd(yearly)}/year for business email`);
  const rowsHtml = items.map(i => `<tr><td style="padding:4px 16px 4px 0">${esc(i.name)}</td><td style="padding:4px 0;text-align:right"><b>${esc(i.amount)}</b></td></tr>`).join('');
  const orderText = items.map(i => `- ${i.name}: ${i.amount}`).join('\n') + `\nFirst invoice total: ${usd(first)}\n` + renew.map(r => '* ' + r).join('\n');
  const admins = (env.NOTIFY_TO || '').split(',').map(s => s.trim()).filter(Boolean);
  try {
    await send(env, { from: env.MAIL_FROM, to: admins, reply_to: email,
      subject: `Order to invoice: ${business} (${usd(first)})`,
      text: `New order request from the website. Send an invoice.\n\nName: ${name}\nBusiness: ${business}\nEmail: ${email}\n\nOrder:\n${orderText}\n\nReply to this email to reach ${name} directly.`,
      html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#1F1A14;max-width:600px"><h2 style="margin:0 0 6px;font-size:20px">Order to invoice: ${esc(business)}</h2>
        <p style="margin:0 0 14px;color:#6B5D4D">${esc(name)} &middot; <a href="mailto:${esc(email)}">${esc(email)}</a></p>
        <table style="border-collapse:collapse">${rowsHtml}<tr><td style="padding:10px 16px 4px 0;border-top:1px solid #D9CBB3"><b>First invoice total</b></td><td style="padding:10px 0 4px;border-top:1px solid #D9CBB3;text-align:right"><b>${usd(first)}</b></td></tr></table>
        <ul style="color:#6B5D4D;padding-left:18px">${renew.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <p style="margin-top:18px">Next step: send ${esc(name)} an invoice for ${usd(first)}. Reply to this email to reach them directly.</p></div>` });
  } catch (err) { return json(502, { error: 'send failed', detail: String(err.message || err) }, headers); }
  try {
    await send(env, { from: env.MAIL_FROM, to: [email], reply_to: admins[admins.length - 1],
      subject: 'We got your order — Digital Doorway Marketing',
      text: `Hi ${name},\n\nThanks for your order for ${business}. Here's what you picked:\n\n${orderText}\n\nWe'll email your invoice within one business day, then set up a short call to get started.\n\nQuestions? Reply to this email or call (877) 853-1920.\n\n— Marv Reeves\nDigital Doorway Marketing\nhttps://digitaldoorwaymarketing.com`,
      html: `<div style="font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#1F1A14;max-width:600px"><h2 style="margin:0 0 12px;font-size:22px">We got your order. The light's on.</h2>
        <p>Hi ${esc(name)}, thanks for your order for <b>${esc(business)}</b>. Here's what you picked:</p>
        <table style="border-collapse:collapse">${rowsHtml}<tr><td style="padding:10px 16px 4px 0;border-top:1px solid #D9CBB3"><b>First invoice</b></td><td style="padding:10px 0 4px;border-top:1px solid #D9CBB3;text-align:right"><b>${usd(first)}</b></td></tr></table>
        <ul style="color:#6B5D4D;padding-left:18px">${renew.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <p>We'll email your invoice within one business day, then set up a short call to get started.</p>
        <p>Questions? Reply to this email or call <a href="tel:+18778531920">(877) 853-1920</a>.</p>
        <p style="margin-top:24px">— Marv Reeves<br>Digital Doorway Marketing<br><a href="https://digitaldoorwaymarketing.com">digitaldoorwaymarketing.com</a></p></div>` });
  } catch (err) { /* the order reached the admins; a failed confirmation shouldn't fail the request */ }
  return json(200, { ok: true }, headers);
}

async function orderSummary(env, orderId) {
  if (!orderId || !env.SQUARE_ACCESS_TOKEN) return null;
  try {
    const o = (await squareApi(env, 'GET', '/v2/orders/' + orderId)).order;
    const md = o.metadata || {};
    const items = (o.line_items || []).map(li => ({ name: li.name, amount: money(li.total_money || li.base_price_money) }));
    const keys = (md.items || '').split(',').filter(Boolean);
    if (keys.includes('domain')) items.push({ name: CATALOG.domain.name, amount: 'to be quoted' });
    const renew = [];
    if (+md.monthly_cents) renew.push(`$${(md.monthly_cents / 100).toFixed(2)}/month for hosting and security`);
    if (+md.yearly_cents) renew.push(`$${(md.yearly_cents / 100).toFixed(2)}/year for business email`);
    return { items, renew };
  } catch (err) { return null; }
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
  const sum = await orderSummary(env, p.order_id);
  const itemsText = sum && sum.items.length ? '\n\nOrder:\n' + sum.items.map(i => `- ${i.name}: ${i.amount}`).join('\n') + (sum.renew.length ? '\nRenews: ' + sum.renew.join('; ') : '') : '';
  const itemsHtml = sum && sum.items.length ? `<table style="border-collapse:collapse;margin:12px 0">${sum.items.map(i => `<tr><td style="padding:4px 16px 4px 0">${esc(i.name)}</td><td style="padding:4px 0;text-align:right"><b>${esc(i.amount)}</b></td></tr>`).join('')}</table>${sum.renew.length ? `<p style="margin:0 0 8px;color:#6B5D4D">Renews: ${esc(sum.renew.join('; '))}</p>` : ''}` : '';
  try {
    await send(env, { from: env.MAIL_FROM, to: admins, reply_to: buyer || undefined,
      subject: `New sale: ${amount} from ${buyer || 'a customer'}`,
      text: `A payment just came in through the Square link.\n\nAmount: ${amount}\nCustomer: ${buyer || '(no email on the payment)'}\nWhen: ${when} (Pacific)\nReceipt: ${p.receipt_number || '—'}${receipt ? ' ' + receipt : ''}\nSquare payment ID: ${p.id}${itemsText}\n\nNext step: reach out within one business day to book the first call.`,
      html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#1F1A14;max-width:560px"><h2 style="margin:0 0 12px;font-size:20px">New sale: ${esc(amount)}</h2>
        <table style="border-collapse:collapse">${[['Customer', buyer || '(no email on the payment)'], ['When', when + ' (Pacific)'], ['Receipt', p.receipt_number || '—'], ['Payment ID', p.id]].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6B5D4D">${k}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join('')}</table>${itemsHtml}
        ${receipt ? `<p><a href="${esc(receipt)}">View the Square receipt</a></p>` : ''}<p style="margin-top:20px">Next step: reach out within one business day to book the first call.</p></div>` });
    results.admins = 'sent';
  } catch (err) { results.admins = 'failed: ' + err.message; }
  if (buyer) {
    try {
      await send(env, { from: env.MAIL_FROM, to: [buyer], reply_to: admins[admins.length - 1],
        subject: 'Thank you — your website build is booked',
        text: `Thank you for your payment of ${amount} to Digital Doorway Marketing.${itemsText}\n\nHere's what happens next: Marv will email or call you within one business day to set up a short conversation about your business. From there we build the first version, you tell us what to change, and we launch.\n\nSquare has sent a separate receipt for your records${p.receipt_number ? ' (receipt #' + p.receipt_number + ')' : ''}.\n\nQuestions in the meantime? Reply to this email or call (877) 853-1920.\n\n— Marv Reeves\nDigital Doorway Marketing\nhttps://digitaldoorwaymarketing.com`,
        html: `<div style="font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#1F1A14;max-width:560px"><h2 style="margin:0 0 12px;font-size:22px">Thank you. The light's on.</h2>
          <p>Your payment of <b>${esc(amount)}</b> to Digital Doorway Marketing went through.</p>${itemsHtml}${sum && sum.renew.length ? '<p>Your add-ons renew as shown above. We\'ll send each renewal as a Square invoice before it\'s due.</p>' : ''}
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
    if (request.method === 'POST' && url.pathname === '/checkout') return (env.CHECKOUT_ENABLED || 'no') === 'yes' ? handleCheckout(request, env, headers) : json(403, { error: 'online checkout is turned off' }, headers);
    if (request.method === 'POST' && url.pathname === '/order-request') return handleOrderRequest(request, env, headers);
    if (request.method !== 'POST' || url.pathname !== '/contact') return json(404, { error: 'not found' }, headers);
    if (!env.RESEND_API_KEY) return json(500, { error: 'mailer not configured' }, headers);

    let data;
    try { data = await request.json(); } catch { return json(400, { error: 'bad json' }, headers); }
    if (data.website) return json(200, { ok: true }, headers);            // honeypot: bots fill hidden fields
    const name = clip(data.name, 120), business = clip(data.business, 160), email = clip(data.email, 200);
    const phone = clip(data.phone, 40), type = clip(data.type, 80), message = clip(data.message, 4000);
    const addons = clip(data.addons, 300);
    if (!name || !business || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'missing fields' }, headers);

    const to = (env.NOTIFY_TO || '').split(',').map(s => s.trim()).filter(Boolean);
    const lines = [['Name', name], ['Business', business], ['Email', email], ['Phone', phone || '—'], ['Type of business', type || '—'], ['Add-ons', addons || 'none']];
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
