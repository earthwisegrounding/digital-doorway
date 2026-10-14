/* Digital Doorway Marketing CRM: the admin app for the Worker's /crm/* API.
   Data is always rendered as text (no innerHTML), and the page's CSP only allows same-origin scripts and styles. */
(() => {
  'use strict';

  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8787' : 'https://digital-doorway-mail.angie-tatum-api.workers.dev';
  const SITE = 'https://digitaldoorwaymarketing.com';
  const KEY_TOKEN = 'ddm.crm.token', KEY_EMAIL = 'ddm.crm.email';
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  };

  let token = store.get(KEY_TOKEN);
  let me = store.get(KEY_EMAIL) || '';
  let stages = [];
  let admins = [];
  let shell = null;
  let viewCtl = null;
  let searchQ = '';
  const app = document.getElementById('app');

  /* ---------- constants ---------- */
  const MANUAL = ['note', 'call', 'email', 'meeting'];
  const KINDS = {
    note: ['Note', 'note'], call: ['Call', 'phone'], email: ['Email', 'mail'], meeting: ['Meeting', 'calendar'],
    form: ['Website inquiry', 'inbox'], payment: ['Payment', 'card'], stage: ['Stage change', 'arrow'], task: ['Task done', 'done'], system: ['Update', 'info'],
  };
  const KIND_HINTS = { note: 'Add a note about this contact…', call: 'How did the call go?', email: 'What did you send, or what came back?', meeting: 'What did you cover?' };
  const TYPE_NAMES = { open: 'Open', won: 'Paid', live: 'Launched', lost: 'Lost' };
  const OPEN_COLORS = ['#8AA6DA', '#5C88D2', '#2F6CC4', '#1553A8', '#0E3F86', '#0B3574'];
  const TYPE_COLORS = { won: '#12805A', live: '#14B4C4', lost: '#9C8870' };
  const CRM_PLANS = [['', 'Not decided'], ['free', 'In free year'], ['paid', 'Kept it · $34.95/mo or in bundle'], ['declined', 'Declined']];
  const BUNDLE_PLANS = [['', 'Not decided'], ['bundle', 'Business Bundle · $49.95/mo'], ['bundle_year', 'Business Bundle · $539.46/yr'], ['individual', 'Individual services'], ['declined', 'Declined']];
  const INDUSTRIES = ['Restaurant', 'Bakery or café', 'Catering', 'Salon or barber', 'Spa', 'Plumbing', 'HVAC', 'Electrical', 'Landscaping', 'Cleaning', 'Construction', 'Auto repair', 'Dental', 'Medical clinic', 'Chiropractic', 'Fitness', 'Real estate', 'Legal', 'Retail shop', 'Pet services', 'Photography', 'Other'];
  const SOURCES = ['Website form', 'Square checkout', 'Referral', 'Outreach', 'Phone call', 'Walk-in', 'Social media', 'Event'];
  const NAV = [['#/', 'Dashboard', 'dash'], ['#/pipeline', 'Pipeline', 'pipeline'], ['#/contacts', 'Contacts', 'users'], ['#/tasks', 'Tasks', 'check'], ['#/renewals', 'Renewals', 'repeat'], ['#/settings', 'Settings', 'sliders']];
  const ICONS = {
    dash: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    pipeline: 'M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    repeat: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    plus: 'M12 5v14M5 12h14',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
    note: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z',
    card: 'M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM1 10h22',
    arrow: 'M5 12h14M12 5l7 7-7 7',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
    done: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
    archive: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    up: 'M18 15l-6-6-6 6', down: 'M6 9l6 6 6-6', x: 'M18 6 6 18M6 6l12 12', back: 'M19 12H5M12 19l-7-7 7-7',
  };

  /* ---------- DOM helpers ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    let value;
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'value') value = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    if (value !== undefined) el.value = value;
    return el;
  }
  function icon(name) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ic');
    p.setAttribute('d', ICONS[name] || ICONS.info); s.append(p);
    return s;
  }
  const cssVar = (el, ...pairs) => { for (let i = 0; i < pairs.length; i += 2) el.style.setProperty(pairs[i], pairs[i + 1]); return el; };
  const iconBtn = (name, label, onclick) => h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onclick }, icon(name));
  const panel = (title, aside, ...body) => h('section', { class: 'panel' }, h('h2', null, h('span', null, title), aside), ...body);
  const empty = (title, text) => h('div', { class: 'empty' }, h('b', null, title), text || null);
  const loadingBlock = () => h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner' }), 'Loading…');

  /* ---------- formatting ---------- */
  const pad = n => String(n).padStart(2, '0');
  const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => isoLocal(new Date());
  const addDaysISO = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysFromToday = s => Math.round((parseISO(s) - parseISO(todayISO())) / 86400000);
  function fmtDate(s, long) {
    const d = parseISO(s), year = d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {};
    return d.toLocaleDateString('en-US', long ? { weekday: 'long', month: 'long', day: 'numeric', ...year } : { month: 'short', day: 'numeric', ...year });
  }
  const fmtDateTime = iso => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  function ago(iso) {
    if (!iso) return '—';
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 7 * 86400) return Math.floor(s / 86400) + 'd ago';
    return fmtDate(isoLocal(new Date(iso)));
  }
  const money = c => { const v = (c || 0) / 100; return '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const who = c => (c && (c.business || c.name || c.email)) || 'Unnamed contact';
  const firstLine = s => String(s || '').split('\n')[0].slice(0, 160);
  const stageOf = key => stages.find(s => s.key === key);
  const stageLabel = key => (stageOf(key) || { label: key }).label;
  function colorFor(s, list = stages) {
    if (!s) return '#9C8870';
    if (s.type !== 'open') return TYPE_COLORS[s.type];
    return OPEN_COLORS[Math.min(list.filter(x => x.type === 'open').indexOf(s), OPEN_COLORS.length - 1)];
  }
  const stageColor = key => colorFor(stageOf(key));
  const stagePill = key => cssVar(h('span', { class: 'pill' }, stageLabel(key)), '--c', stageColor(key));
  function safeHttp(u) {
    const s = String(u || '').trim();
    if (!s) return '';
    try { const x = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; }
  }
  function dueBadge(due, done) {
    if (!due) return h('span', { class: 'due' }, 'No date');
    const d = daysFromToday(due);
    const cls = done ? '' : d < 0 ? ' is-over' : d === 0 ? ' is-today' : '';
    const label = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d < 0 ? `${-d} days late` : d < 7 ? parseISO(due).toLocaleDateString('en-US', { weekday: 'short' }) : fmtDate(due);
    return h('span', { class: 'due' + cls, title: fmtDate(due, true) }, label);
  }
  function countdown(date) {
    const d = daysFromToday(date);
    return h('span', { class: 'due' + (d < 0 ? ' is-over' : d <= 30 ? ' is-today' : '') }, d < 0 ? `ended ${-d}d ago` : d === 0 ? 'today' : `in ${d}d`);
  }

  /* ---------- toasts ---------- */
  const toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  document.body.append(toasts);
  function toast(msg, isError) {
    const t = h('div', { class: 'toast' + (isError ? ' is-error' : ''), role: isError ? 'alert' : 'status' }, msg);
    toasts.append(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 320); }, isError ? 6000 : 2800);
  }

  /* ---------- datalists for industry and source inputs ---------- */
  document.body.append(
    h('datalist', { id: 'dl-industries' }, INDUSTRIES.map(v => h('option', { value: v }))),
    h('datalist', { id: 'dl-sources' }, SOURCES.map(v => h('option', { value: v }))));

  /* ---------- API ---------- */
  async function api(method, path, body, opts = {}) {
    const headers = {};
    if (token && !opts.anon) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let r;
    try { r = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
    catch { throw new Error('Can’t reach the CRM right now. Check your connection and try again.'); }
    if (r.status === 401 && !opts.anon) { signOut('Your session ended. Sign in again.'); throw new Error('signed out'); }
    const data = (r.headers.get('Content-Type') || '').includes('json') ? await r.json().catch(() => ({})) : await r.text();
    if (!r.ok) { const e = new Error((data && data.error) || `Something went wrong (${r.status}).`); e.status = r.status; e.data = data; throw e; }
    return data;
  }
  function signOut(msg) {
    token = null; store.set(KEY_TOKEN, null); shell = null;
    if (viewCtl) viewCtl.abort();
    viewLogin(msg);
  }
  function setBadge(n) {
    const b = document.getElementById('task-badge');
    if (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n); }
  }

  /* ---------- sign in ---------- */
  function viewLogin(msg) {
    document.title = 'Sign in | CRM | Digital Doorway Marketing';
    let step = 'email', busy = false, email = me;
    const status = h('p', { class: 'login-status', role: 'status' }, msg || '');
    const emailIn = h('input', { id: 'l-email', type: 'email', autocomplete: 'username', spellcheck: 'false', placeholder: 'you@digitaldoorwaymarketing.com', value: email });
    const codeIn = h('input', { id: 'l-code', class: 'code-input', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '000000' });
    const emailField = h('div', { class: 'field' }, h('label', { for: 'l-email' }, 'Admin email'), emailIn);
    const codeField = h('div', { class: 'field', hidden: true }, h('label', { for: 'l-code' }, 'Six-digit code from your email'), codeIn);
    const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Email me a sign-in code');
    const other = h('button', { class: 'linkish', type: 'button', hidden: true }, 'Use a different email');
    const form = h('form', { class: 'login-card', novalidate: true },
      h('img', { src: '../assets/logo-106.png', alt: '', width: '106', height: '80' }),
      h('div', null, h('p', { class: 'eyebrow' }, 'Digital Doorway Marketing'), h('h1', null, 'Sign in to the CRM')),
      h('p', { class: 'login-help' }, 'We’ll email a six-digit code to your admin address. No password to remember.'),
      emailField, codeField, submit, other, status);
    const setStep = s => {
      step = s; emailField.hidden = s !== 'email'; codeField.hidden = s !== 'code'; other.hidden = s !== 'code';
      submit.textContent = s === 'email' ? 'Email me a sign-in code' : 'Sign in';
      (s === 'email' ? emailIn : codeIn).focus();
    };
    other.addEventListener('click', () => { status.textContent = ''; codeIn.value = ''; setStep('email'); });
    codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.replace(/\D/g, '').slice(0, 6); if (codeIn.value.length === 6) form.requestSubmit(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      busy = true; submit.disabled = true; status.classList.remove('is-error');
      try {
        if (step === 'email') {
          email = emailIn.value.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter your admin email address.');
          status.textContent = 'Sending…';
          await api('POST', '/crm/auth/request', { email }, { anon: true });
          status.textContent = `If ${email} is an admin address, a code is on its way. It works for 10 minutes.`;
          setStep('code');
        } else {
          const code = codeIn.value.trim();
          if (code.length !== 6) throw new Error('Enter the six digits from the email.');
          const r = await api('POST', '/crm/auth/verify', { email, code }, { anon: true });
          token = r.token; me = r.email; store.set(KEY_TOKEN, token); store.set(KEY_EMAIL, me);
          busy = false;
          boot();
          return;
        }
      } catch (err) {
        status.textContent = err.message; status.classList.add('is-error');
        if (step === 'code') codeIn.select();
      }
      busy = false; submit.disabled = false;
    });
    app.replaceChildren(h('main', { class: 'login' }, form));
    emailIn.focus();
  }

  /* ---------- shell and routing ---------- */
  function ensureShell() {
    if (shell) return;
    const search = h('input', { type: 'search', placeholder: 'Search contacts', 'aria-label': 'Search contacts', value: searchQ });
    search.addEventListener('input', () => {
      searchQ = search.value;
      if (location.hash !== '#/contacts') location.hash = '#/contacts';
      else document.dispatchEvent(new CustomEvent('crm:search'));
    });
    const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
    shell = { main, search };
    app.replaceChildren(h('div', { class: 'shell' },
      h('aside', { class: 'side' },
        h('a', { class: 'brand', href: '#/' }, h('img', { src: '../assets/logo-106.png', alt: 'Digital Doorway Marketing CRM', width: '46', height: '35' }), h('span', null, h('b', null, 'Digital Doorway'), h('small', null, 'CRM'))),
        h('nav', { class: 'side-nav', 'aria-label': 'CRM sections' }, NAV.map(([href, label, ic]) =>
          h('a', { href, 'data-nav': href, title: label }, icon(ic), h('span', { class: 'nav-label' }, label), href === '#/tasks' ? h('b', { class: 'nav-badge', id: 'task-badge', hidden: true }) : null))),
        h('div', { class: 'side-foot' },
          h('a', { class: 'side-link', href: SITE + '/', target: '_blank', rel: 'noopener' }, icon('external'), 'View the website'),
          h('p', { class: 'side-me', title: me }, me),
          h('button', { class: 'side-link', type: 'button', onclick: () => signOut('You’re signed out.') }, icon('logout'), 'Sign out'))),
      h('div', { class: 'content' },
        h('header', { class: 'topbar' },
          h('label', { class: 'search' }, icon('search'), search),
          h('button', { class: 'btn btn-primary', type: 'button', 'aria-label': 'New contact', onclick: () => openNewContact() }, icon('plus'), h('span', { class: 'hide-sm' }, 'New contact'))),
        main)));
  }
  const ROUTES = [
    [/^#\/?$/, viewDashboard, '#/'],
    [/^#\/pipeline$/, viewPipeline, '#/pipeline'],
    [/^#\/contacts$/, viewContacts, '#/contacts'],
    [/^#\/contacts\/(\d+)$/, viewContact, '#/contacts'],
    [/^#\/tasks$/, viewTasks, '#/tasks'],
    [/^#\/renewals$/, viewRenewals, '#/renewals'],
    [/^#\/settings$/, viewSettings, '#/settings'],
  ];
  async function route() {
    if (!token) return viewLogin();
    const hash = location.hash || '#/';
    const hit = ROUTES.find(([re]) => re.test(hash));
    if (!hit) { location.replace('#/'); return; }
    if (viewCtl) viewCtl.abort();
    const ctl = viewCtl = new AbortController();
    ensureShell();
    document.querySelectorAll('[data-nav]').forEach(a => a.getAttribute('data-nav') === hit[2] ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    if (hit[2] !== '#/contacts' && shell.search.value) { searchQ = ''; shell.search.value = ''; }
    shell.main.replaceChildren(loadingBlock());
    scrollTo(0, 0);
    try { await hit[1](shell.main, ctl, ...hit[0].exec(hash).slice(1)); }
    catch (err) {
      if (err.message === 'signed out' || ctl.signal.aborted) return;
      shell.main.replaceChildren(panel('That didn’t load', null, h('p', { class: 'panel-intro' }, err.message), h('button', { class: 'btn btn-quiet', type: 'button', onclick: route }, 'Try again')));
    }
  }
  async function boot() {
    if (!token) return viewLogin();
    try {
      const s = await api('GET', '/crm/settings');
      stages = s.stages; admins = s.admins;
    } catch (err) {
      if (err.message === 'signed out') return;
      app.replaceChildren(h('main', { class: 'login' }, h('div', { class: 'login-card' }, h('h1', null, 'Can’t reach the CRM'), h('p', { class: 'login-help' }, err.message), h('button', { class: 'btn btn-primary', type: 'button', onclick: boot }, 'Try again'))));
      return;
    }
    shell = null;
    await route();
    api('GET', '/crm/summary').then(s => setBadge(s.tasksOverdue + s.tasksToday)).catch(() => {});
  }
  addEventListener('hashchange', () => { if (token) route(); });

  const pageHead = (title, sub, ...actions) => {
    document.title = `${title} | CRM | Digital Doorway Marketing`;
    return h('div', { class: 'page-head' }, h('div', null, h('h1', null, title), sub ? h('p', null, sub) : null), actions.length ? h('div', { class: 'page-actions' }, actions) : null);
  };

  /* ---------- shared rows ---------- */
  function taskRow(t, { showContact = true, deletable = false, onChange } = {}) {
    const cb = h('input', { type: 'checkbox', checked: !!t.done, 'aria-label': 'Mark done: ' + t.title });
    const row = h('div', { class: 'task' + (t.done ? ' is-done' : '') }, cb,
      h('div', { class: 'task-main' }, h('span', { class: 'task-title' }, t.title),
        showContact && t.contact_id ? h('a', { class: 'task-who', href: '#/contacts/' + t.contact_id }, who(t)) : null),
      dueBadge(t.due_on, t.done),
      deletable ? iconBtn('trash', 'Delete task', async () => {
        if (!confirm(`Delete the task “${t.title}”?`)) return;
        try { await api('DELETE', '/crm/tasks/' + t.id); row.remove(); toast('Task deleted.'); if (onChange) onChange(t, 'deleted'); } catch (err) { toast(err.message, true); }
      }) : null);
    cb.addEventListener('change', async () => {
      row.classList.toggle('is-done', cb.checked);
      try {
        await api('PATCH', '/crm/tasks/' + t.id, { done: cb.checked });
        t.done = cb.checked ? 1 : 0;
        toast(cb.checked ? 'Nice. Task done.' : 'Task reopened.');
        if (onChange) onChange(t);
      } catch (err) { cb.checked = !cb.checked; row.classList.toggle('is-done', cb.checked); toast(err.message, true); }
    });
    return row;
  }
  function renewalRow(r) {
    return h('a', { class: 'link-row', href: '#/contacts/' + r.id },
      h('span', { class: 'renew-kind ' + r.kind }, r.kind === 'crm' ? 'CRM' : 'SVCS'),
      h('span', { class: 'row-main' }, h('b', null, who(r)), h('small', null, (r.kind === 'crm' ? 'Free CRM year ends ' : 'Included services end ') + fmtDate(r.date))),
      countdown(r.date));
  }
  function feedRow(a) {
    const [label, ic] = KINDS[a.kind] || KINDS.system;
    return h('li', { class: 'feed-item', 'data-kind': a.kind },
      h('span', { class: 'feed-ic' }, icon(ic)),
      h('div', { class: 'feed-main' }, h('p', null, h('a', { href: '#/contacts/' + a.contact_id }, who(a)), h('span', { class: 'muted' }, ' · ' + label)), h('p', { class: 'feed-body' }, firstLine(a.body))),
      h('time', { datetime: a.created_at, title: fmtDateTime(a.created_at) }, ago(a.created_at)));
  }

  /* ---------- dashboard ---------- */
  async function viewDashboard(main, ctl) {
    const s = await api('GET', '/crm/summary');
    if (ctl.signal.aborted) return;
    setBadge(s.tasksOverdue + s.tasksToday);
    const hr = new Date().getHours();
    const maxN = Math.max(1, ...s.stages.map(x => x.n));
    const kpi = (label, value, sub, href, feature) => h('a', { class: 'kpi' + (feature ? ' kpi-feature' : ''), href }, h('small', null, label), h('b', null, value), h('span', null, sub));
    main.replaceChildren(
      pageHead(hr < 12 ? 'Good morning.' : hr < 18 ? 'Good afternoon.' : 'Good evening.', `Here’s where things stand, ${fmtDate(s.today, true)}.`),
      h('div', { class: 'kpis' },
        kpi('Open pipeline', String(s.openCount), `${money(s.openValue)} in open deals`, '#/pipeline', true),
        kpi('Paid this month', money(s.wonMonth.v), plural(s.wonMonth.n, 'payment'), '#/contacts'),
        kpi('Monthly recurring', money(s.mrrCents), `${plural(s.crmPaid, 'CRM client')} · ${plural(s.bundles, 'bundle')}`, '#/renewals'),
        kpi('Tasks due', String(s.tasksOverdue + s.tasksToday), s.tasksOverdue ? `${s.tasksOverdue} overdue` : 'Nothing overdue', '#/tasks')),
      h('div', { class: 'dash-grid' },
        panel('Pipeline', h('a', { href: '#/pipeline' }, 'Open the board'),
          h('div', { class: 'funnel' }, s.stages.map(st => h('a', { class: 'funnel-row', href: '#/pipeline' },
            h('span', { class: 'funnel-label' }, st.label),
            h('span', { class: 'track' }, cssVar(h('span', { class: 'fill' }), '--w', (st.n / maxN * 100) + '%', '--c', stageColor(st.key))),
            h('span', { class: 'funnel-n' }, String(st.n)))))),
        panel('Up next', h('a', { href: '#/tasks' }, 'All tasks'),
          s.upcoming.length ? h('div', { class: 'list' }, s.upcoming.map(t => taskRow(t))) : empty('You’re all caught up.', 'Nothing due in the next week.')),
        panel('Renewals coming up', h('a', { href: '#/renewals' }, 'See all'),
          s.renewals.length ? h('div', { class: 'list' }, s.renewals.map(renewalRow)) : empty('Nothing in the next 60 days.', 'Clients whose included first year of services and CRM is about to end show up here.')),
        panel('Recent activity', null,
          s.recent.length ? h('ul', { class: 'feed' }, s.recent.map(feedRow)) : empty('No activity yet.', 'Website inquiries and Square payments land here on their own. You can also add a contact with the New contact button.'))));
  }

  /* ---------- pipeline ---------- */
  async function viewPipeline(main, ctl) {
    const { contacts } = await api('GET', '/crm/contacts');
    if (ctl.signal.aborted) return;
    const list = contacts.filter(c => !c.archived);
    const board = h('div', { class: 'board' });
    const card = c => cssVar(h('a', { class: 'deal', href: '#/contacts/' + c.id, 'data-id': String(c.id), draggable: 'false' },
      h('b', null, who(c)),
      c.business && c.name ? h('span', { class: 'sub' }, c.name) : null,
      h('span', { class: 'meta' }, h('span', null, c.industry || c.source || ''), h('b', null, money(c.value_cents))),
      h('span', { class: 'meta' }, h('span', null, c.city || ''), h('span', null, ago(c.last_activity_at || c.updated_at)))), '--c', stageColor(c.stage));
    function draw() {
      const left = board.scrollLeft;
      board.replaceChildren(...stages.map(st => {
        const items = list.filter(c => c.stage === st.key);
        return h('section', { class: 'col' + (st.type === 'lost' ? ' col-lost' : ''), 'data-stage': st.key, 'aria-label': `${st.label}, ${plural(items.length, 'contact')}` },
          cssVar(h('header', { class: 'col-head' }, h('span', { class: 'dot' }), h('b', null, st.label), h('span', { class: 'count' }, String(items.length)), h('span', { class: 'sum' }, items.length ? money(items.reduce((a, c) => a + c.value_cents, 0)) : '')), '--c', stageColor(st.key)),
          h('div', { class: 'col-cards' }, items.length ? items.map(card) : h('p', { class: 'col-empty' }, 'Nothing here yet')));
      }));
      board.scrollLeft = left;
    }
    draw();
    enableDrag(board, ctl.signal, async (id, key) => {
      const c = list.find(x => String(x.id) === id);
      if (!c || c.stage === key) return;
      const prev = c.stage;
      c.stage = key; draw();
      try { const r = await api('PATCH', '/crm/contacts/' + c.id, { stage: key }); Object.assign(c, r.contact); toast(`${who(c)} moved to ${stageLabel(key)}.`); }
      catch (err) { c.stage = prev; draw(); toast(err.message, true); }
    });
    const touch = matchMedia('(hover: none)').matches;
    main.replaceChildren(
      pageHead('Pipeline', touch ? 'Tap a card to open it and change its stage.' : 'Drag a card to another column to change its stage. Click to open it.',
        h('a', { class: 'btn btn-quiet', href: '#/settings' }, icon('sliders'), 'Edit stages')),
      list.length ? board : panel('Your pipeline is empty', null, h('p', { class: 'panel-intro' }, 'Website inquiries and Square payments land here on their own. You can also add contacts yourself.'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openNewContact() }, icon('plus'), 'New contact')));
  }
  function enableDrag(board, signal, onDrop) {
    let d = null, suppressUntil = 0;
    const cleanup = x => { x.ghost.remove(); x.card.classList.remove('is-dragging'); document.body.classList.remove('dragging'); if (x.over) x.over.classList.remove('is-over'); };
    board.addEventListener('click', e => { if (Date.now() < suppressUntil && e.target.closest('.deal')) e.preventDefault(); }, { capture: true, signal });
    board.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const card = e.target.closest('.deal');
      if (card) d = { card, x: e.clientX, y: e.clientY, started: false, over: null };
    }, { signal });
    addEventListener('pointermove', e => {
      if (!d) return;
      if (!d.started) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
        const r = d.card.getBoundingClientRect();
        d.started = true; d.dx = d.x - r.left; d.dy = d.y - r.top;
        d.ghost = d.card.cloneNode(true);
        d.ghost.classList.add('deal-ghost');
        d.ghost.style.width = r.width + 'px';
        d.ghost.style.setProperty('--c', d.card.style.getPropertyValue('--c'));
        document.body.append(d.ghost);
        d.card.classList.add('is-dragging');
        document.body.classList.add('dragging');
      }
      d.ghost.style.transform = `translate(${e.clientX - d.dx}px, ${e.clientY - d.dy}px) rotate(1.5deg)`;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const col = hit && hit.closest('.col');
      if (col !== d.over) { if (d.over) d.over.classList.remove('is-over'); if (col) col.classList.add('is-over'); d.over = col; }
      const br = board.getBoundingClientRect();
      if (e.clientX > br.right - 56) board.scrollLeft += 14; else if (e.clientX < br.left + 56) board.scrollLeft -= 14;
    }, { signal });
    addEventListener('pointerup', () => {
      if (!d) return;
      const x = d; d = null;
      if (!x.started) return;
      suppressUntil = Date.now() + 300;
      cleanup(x);
      if (x.over && x.over.dataset.stage) onDrop(x.card.dataset.id, x.over.dataset.stage);
    }, { signal });
    addEventListener('pointercancel', () => { if (d && d.started) cleanup(d); d = null; }, { signal });
    addEventListener('keydown', e => { if (e.key === 'Escape' && d && d.started) { cleanup(d); d = null; suppressUntil = Date.now() + 300; } }, { signal });
  }

  /* ---------- contacts ---------- */
  async function exportCsv(btn) {
    btn.disabled = true;
    try {
      const text = await api('GET', '/crm/export.csv');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
      const a = h('a', { href: url, download: `ddm-crm-contacts-${todayISO()}.csv` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) { if (err.message !== 'signed out') toast(err.message, true); }
    btn.disabled = false;
  }
  async function viewContacts(main, ctl) {
    const { contacts } = await api('GET', '/crm/contacts');
    if (ctl.signal.aborted) return;
    let stageF = '', showArchived = false;
    const tbody = h('tbody');
    const foot = h('p', { class: 'table-foot' });
    const stageSel = h('select', { 'aria-label': 'Filter by stage' }, h('option', { value: '' }, 'All stages'), stages.map(s => h('option', { value: s.key }, s.label)));
    const arch = h('input', { type: 'checkbox' });
    stageSel.addEventListener('change', () => { stageF = stageSel.value; draw(); });
    arch.addEventListener('change', () => { showArchived = arch.checked; draw(); });
    const row = c => {
      const tr = h('tr', { class: c.archived ? 'is-archived' : null },
        h('td', { class: 'cell-title' }, h('a', { href: '#/contacts/' + c.id }, who(c)), h('small', null, [c.business && c.name ? c.name : '', c.email].filter(Boolean).join(' · ') || ' ')),
        h('td', { 'data-label': 'Stage' }, stagePill(c.stage)),
        h('td', { 'data-label': 'Industry' }, c.industry || '—'),
        h('td', { 'data-label': 'Value', class: 'num' }, money(c.value_cents)),
        h('td', { 'data-label': 'Source' }, c.source || '—'),
        h('td', { 'data-label': 'Last activity' }, ago(c.last_activity_at || c.updated_at)));
      tr.addEventListener('click', e => { if (!e.target.closest('a')) location.hash = '#/contacts/' + c.id; });
      return tr;
    };
    const table = h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, ['Contact', 'Stage', 'Industry', 'Value', 'Source', 'Last activity'].map((t, i) => h('th', { class: i === 3 ? 'num' : null, scope: 'col' }, t)))), tbody));
    const none = empty('No contacts match.', 'Try a different search or stage.');
    function draw() {
      const q = searchQ.trim().toLowerCase();
      const rows = contacts.filter(c => (showArchived || !c.archived) && (!stageF || c.stage === stageF) &&
        (!q || [c.business, c.name, c.email, c.phone, c.industry, c.city, c.tags, c.source].some(v => String(v || '').toLowerCase().includes(q))));
      tbody.replaceChildren(...rows.map(row));
      table.hidden = !rows.length; none.hidden = !!rows.length;
      foot.textContent = `Showing ${rows.length} of ${plural(contacts.length, 'contact')}.`;
    }
    document.addEventListener('crm:search', draw, { signal: ctl.signal });
    const exportBtn = h('button', { class: 'btn btn-quiet', type: 'button' }, icon('download'), 'Export CSV');
    exportBtn.addEventListener('click', () => exportCsv(exportBtn));
    main.replaceChildren(
      pageHead('Contacts', 'Every lead and client in one list. Search from the bar above.', exportBtn),
      h('div', { class: 'filters' }, stageSel, h('label', { class: 'check' }, arch, 'Show archived')),
      ...(contacts.length ? [table, none, foot] : [panel('No contacts yet', null, h('p', { class: 'panel-intro' }, 'Website inquiries and Square payments create contacts on their own. You can add one now, too.'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openNewContact() }, icon('plus'), 'New contact'))]));
    draw();
    if (searchQ) { shell.search.focus(); }
  }

  /* ---------- one contact ---------- */
  function offerLink(c) {
    const p = new URLSearchParams({ business: c.business || c.name || '' });
    const site = safeHttp(c.website);
    if (site) {
      const host = new URL(site).hostname.replace(/^www\./, '');
      if (!/digitaldoorwaymarketing\.com$/.test(host)) p.set('domain', host);
      p.set('site', site);
    }
    return SITE + '/ready/?' + p.toString();
  }
  async function viewContact(main, ctl, idStr) {
    const id = +idStr;
    let data;
    try { data = await api('GET', '/crm/contacts/' + id); }
    catch (err) {
      if (err.status !== 404) throw err;
      main.replaceChildren(pageHead('Contact not found'), panel('That contact no longer exists.', null, h('a', { class: 'btn btn-quiet', href: '#/contacts' }, icon('back'), 'Back to contacts')));
      return;
    }
    if (ctl.signal.aborted) return;
    let c = data.contact;
    const patch = async (body, okMsg) => {
      const r = await api('PATCH', '/crm/contacts/' + id, body);
      c = data.contact = r.contact;
      if (okMsg) toast(okMsg);
      return c;
    };
    async function refresh() {
      const r = await api('GET', '/crm/contacts/' + id);
      if (ctl.signal.aborted) return;
      data = r; c = r.contact;
      stageSel.value = c.stage; paintStage();
      renderHead(); renderTimeline(); renderServices(); renderTasks(); renderPayments();
    }

    /* header */
    const title = h('h1');
    const meta = h('div', { class: 'detail-meta' });
    const stageSel = h('select', { class: 'stage-select', 'aria-label': 'Stage' }, stages.map(s => h('option', { value: s.key }, s.label)));
    const paintStage = () => cssVar(stageSel, '--c', stageColor(stageSel.value));
    stageSel.value = c.stage; paintStage();
    stageSel.addEventListener('change', async () => {
      paintStage();
      try { await patch({ stage: stageSel.value }, `Moved to ${stageLabel(stageSel.value)}.`); await refresh(); }
      catch (err) { stageSel.value = c.stage; paintStage(); toast(err.message, true); }
    });
    const actions = h('div', { class: 'detail-actions' });
    function renderHead() {
      document.title = `${who(c)} | CRM | Digital Doorway Marketing`;
      title.textContent = who(c);
      const site = safeHttp(c.website), tel = (c.phone || '').replace(/[^\d+]/g, '');
      meta.replaceChildren(...[
        c.business && c.name ? h('span', null, c.name) : null,
        c.email ? h('a', { href: 'mailto:' + c.email }, c.email) : null,
        c.phone ? h('a', { href: 'tel:' + tel }, c.phone) : null,
        c.city ? h('span', null, c.city) : null,
        site ? h('a', { href: site, target: '_blank', rel: 'noopener noreferrer' }, new URL(site).hostname.replace(/^www\./, '') + ' ↗') : null,
        c.archived ? h('span', { class: 'pill' }, 'Archived') : null,
      ].filter(Boolean));
      const copyBtn = h('button', { class: 'btn btn-quiet btn-sm', type: 'button', title: 'Copies a personalized /ready offer page link' }, icon('link'), 'Copy offer link');
      copyBtn.addEventListener('click', async () => {
        const link = offerLink(c);
        try { await navigator.clipboard.writeText(link); toast('Offer page link copied.'); }
        catch { prompt('Copy this offer page link:', link); }
      });
      const archBtn = h('button', { class: 'btn btn-quiet btn-sm', type: 'button' }, icon('archive'), c.archived ? 'Restore' : 'Archive');
      archBtn.addEventListener('click', async () => {
        try { await patch({ archived: !c.archived }, c.archived ? 'Restored.' : 'Archived. It’s hidden from the pipeline now.'); await refresh(); } catch (err) { toast(err.message, true); }
      });
      const delBtn = h('button', { class: 'btn btn-danger btn-sm', type: 'button' }, icon('trash'), 'Delete');
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete ${who(c)} for good? Their notes, tasks, and history go too. Archiving keeps them instead.`)) return;
        try { await api('DELETE', '/crm/contacts/' + id); toast('Contact deleted.'); location.hash = '#/contacts'; } catch (err) { toast(err.message, true); }
      });
      actions.replaceChildren(...[stageSel,
        c.phone ? h('a', { class: 'btn btn-quiet btn-sm', href: 'tel:' + tel }, icon('phone'), 'Call') : null,
        c.email ? h('a', { class: 'btn btn-quiet btn-sm', href: 'mailto:' + c.email }, icon('mail'), 'Email') : null,
        copyBtn, archBtn, delBtn].filter(Boolean));
    }

    /* activity composer + timeline */
    let kind = 'note';
    const ta = h('textarea', { rows: '3', placeholder: KIND_HINTS.note, 'aria-label': 'Activity details', maxlength: '4000' });
    const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Activity type' }, MANUAL.map(k => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === kind) }, icon(KINDS[k][1]), KINDS[k][0]);
      b.addEventListener('click', () => { kind = k; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b))); ta.placeholder = KIND_HINTS[k]; ta.focus(); });
      return b;
    }));
    const logBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Save to timeline');
    const composer = h('form', { class: 'panel composer' }, seg, ta, h('div', { class: 'composer-foot' }, h('span', { class: 'muted small' }, 'Ctrl or ⌘ + Enter saves'), logBtn));
    composer.addEventListener('submit', async e => {
      e.preventDefault();
      const body = ta.value.trim();
      if (!body) { ta.focus(); return; }
      logBtn.disabled = true;
      try { await api('POST', `/crm/contacts/${id}/activities`, { kind, body }); ta.value = ''; await refresh(); toast('Saved to the timeline.'); }
      catch (err) { toast(err.message, true); }
      logBtn.disabled = false;
    });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) composer.requestSubmit(); });
    const timeline = h('ol', { class: 'timeline' });
    const tlCount = h('span', { class: 'h2-aside' });
    function renderTimeline() {
      const n = data.activities.length;
      tlCount.textContent = `${n} ${n === 1 ? 'entry' : 'entries'}`;
      if (!n) { timeline.replaceChildren(h('li', { class: 'empty' }, 'No activity yet.')); return; }
      timeline.replaceChildren(...data.activities.map(a => {
        const [label, ic] = KINDS[a.kind] || KINDS.system;
        return h('li', { class: 'tl', 'data-kind': a.kind },
          h('span', { class: 'tl-ic' }, icon(ic)),
          h('div', { class: 'tl-body' }, h('p', { class: 'tl-text' }, a.body),
            h('p', { class: 'tl-meta' }, label + (a.created_by ? ' · ' + a.created_by : '') + ' · ', h('time', { datetime: a.created_at, title: fmtDateTime(a.created_at) }, ago(a.created_at)))),
          MANUAL.includes(a.kind) ? iconBtn('trash', 'Delete this ' + label.toLowerCase(), async () => {
            if (!confirm(`Delete this ${label.toLowerCase()}?`)) return;
            try { await api('DELETE', '/crm/activities/' + a.id); await refresh(); toast('Deleted.'); } catch (err) { toast(err.message, true); }
          }) : null);
      }));
    }

    /* details form */
    const FIELDS = [['business', 'Business'], ['name', 'Contact name'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['industry', 'Industry', 'text', 'dl-industries'], ['city', 'City'],
      ['website', 'Website or demo link', 'url', null, true], ['source', 'Source', 'text', 'dl-sources'], ['value', 'Deal value ($)', 'number'], ['tags', 'Tags', 'text', null, true], ['notes', 'Background notes', 'textarea', null, true]];
    const inputs = {};
    const saveBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'submit', disabled: true }, 'Save changes');
    const current = k => k === 'value' ? String((c.value_cents || 0) / 100) : (c[k] || '');
    const changed = () => FIELDS.filter(([k]) => inputs[k].value.trim() !== current(k)).map(([k]) => k);
    const detailsForm = h('form', { class: 'panel', novalidate: true }, h('h2', null, h('span', null, 'Details')),
      h('div', { class: 'form-grid' }, FIELDS.map(([k, label, type, list, wide]) => {
        const inp = type === 'textarea' ? h('textarea', { id: 'cf-' + k, rows: '3', maxlength: '4000' })
          : h('input', { id: 'cf-' + k, type: type === 'url' ? 'text' : (type || 'text'), list, inputmode: type === 'url' ? 'url' : null, min: type === 'number' ? '0' : null, step: type === 'number' ? '1' : null, spellcheck: type === 'email' || type === 'url' ? 'false' : null });
        inp.value = current(k);
        inp.addEventListener('input', () => { saveBtn.disabled = !changed().length; });
        inputs[k] = inp;
        return h('div', { class: 'field' + (wide ? ' span-2' : '') }, h('label', { for: 'cf-' + k }, label), inp);
      })),
      h('div', { class: 'panel-actions' }, saveBtn));
    detailsForm.addEventListener('submit', async e => {
      e.preventDefault();
      const keys = changed();
      if (!keys.length) return;
      const body = {};
      for (const k of keys) { if (k === 'value') body.value_cents = Math.round((parseFloat(inputs.value.value) || 0) * 100); else body[k] = inputs[k].value.trim(); }
      saveBtn.disabled = true;
      try {
        await patch(body, 'Details saved.');
        for (const [k] of FIELDS) inputs[k].value = current(k);
        renderHead();
      } catch (err) { toast(err.message, true); saveBtn.disabled = false; }
    });

    /* services & CRM */
    const services = h('section', { class: 'panel' });
    function renderServices() {
      const firstPay = data.payments.length ? data.payments[data.payments.length - 1].paid_on : null;
      const hint = date => {
        if (!date) return h('span', { class: 'hint' }, 'Not set');
        const d = daysFromToday(date);
        return h('span', { class: 'hint' + (d < 0 ? ' is-over' : d <= 30 ? ' is-soon' : '') }, d < 0 ? `Ended ${plural(-d, 'day')} ago` : d === 0 ? 'Ends today' : `${plural(d, 'day')} left`);
      };
      const dateField = (key, label) => {
        const inp = h('input', { id: 'sv-' + key, type: 'date', value: c[key] || '' });
        inp.addEventListener('change', async () => { try { await patch({ [key]: inp.value || null }, 'Saved.'); renderServices(); } catch (err) { toast(err.message, true); } });
        return h('div', { class: 'field' }, h('label', { for: 'sv-' + key }, label), inp, key === 'launched_on' ? null : hint(c[key]));
      };
      const planField = (key, label, opts) => {
        const sel = h('select', { id: 'sv-' + key }, opts.map(([v, t]) => h('option', { value: v }, t)));
        sel.value = c[key] || '';
        sel.addEventListener('change', async () => { try { await patch({ [key]: sel.value }, 'Saved.'); } catch (err) { toast(err.message, true); sel.value = c[key] || ''; } });
        return h('div', { class: 'field' }, h('label', { for: 'sv-' + key }, label), sel);
      };
      services.replaceChildren(h('h2', null, h('span', null, 'Services and CRM')),
        h('p', { class: 'panel-intro' }, 'The $499 covers 12 months of services and CRM. The clock starts when they pay.'),
        h('dl', { class: 'facts' }, h('dt', null, 'Paid'), h('dd', null, firstPay ? fmtDate(firstPay, true) : 'Not yet')),
        h('div', { class: 'form-grid' },
          dateField('crm_free_until', 'Free CRM until'), dateField('services_until', 'Included services until'),
          planField('crm_plan', 'CRM after the free year', CRM_PLANS), planField('bundle_plan', 'Services after month 12', BUNDLE_PLANS),
          dateField('launched_on', 'Site launched')));
    }

    /* tasks */
    const taskList = h('div', { class: 'list' });
    function renderTasks() {
      taskList.replaceChildren(...(data.tasks.length ? data.tasks.map(t => taskRow(t, { showContact: false, deletable: true, onChange: () => refresh() })) : [h('p', { class: 'muted small' }, 'No tasks for this contact.')]));
    }
    const tTitle = h('input', { placeholder: 'Follow up about…', 'aria-label': 'New task', maxlength: '200' });
    const tDue = h('input', { type: 'date', value: addDaysISO(1), 'aria-label': 'Due date' });
    const tForm = h('form', { class: 'task-add' }, tTitle, tDue, h('button', { class: 'btn btn-quiet btn-sm', type: 'submit' }, icon('plus'), 'Add'));
    tForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!tTitle.value.trim()) { tTitle.focus(); return; }
      try { await api('POST', '/crm/tasks', { title: tTitle.value.trim(), due_on: tDue.value || null, contact_id: id }); tTitle.value = ''; await refresh(); toast('Task added.'); }
      catch (err) { toast(err.message, true); }
    });

    /* payments */
    const payList = h('div', { class: 'list' });
    function renderPayments() {
      payList.replaceChildren(...(data.payments.length ? data.payments.map(p => {
        const receipt = safeHttp(p.receipt_url);
        return h('div', { class: 'pay-row' },
          h('span', null, fmtDate(p.paid_on), p.receipt_number ? h('span', { class: 'muted' }, ' · #' + p.receipt_number) : null, receipt ? [' · ', h('a', { href: receipt, target: '_blank', rel: 'noopener noreferrer' }, 'Receipt ↗')] : null),
          h('b', null, money(p.amount_cents)),
          p.items ? h('small', null, p.items) : null);
      }) : [h('p', { class: 'muted small' }, 'No payments yet. Square payments show up here automatically.')]));
    }

    renderHead(); renderTimeline(); renderServices(); renderTasks(); renderPayments();
    main.replaceChildren(
      h('a', { class: 'back', href: '#/contacts' }, icon('back'), 'All contacts'),
      h('header', { class: 'detail-head' }, h('div', null, title, meta), actions),
      h('div', { class: 'detail-grid' },
        h('div', { class: 'detail-main' }, composer, panel('Timeline', tlCount, timeline)),
        h('div', { class: 'detail-side' }, panel('Tasks', null, taskList, tForm), services, detailsForm, panel('Payments', null, payList))));
  }

  /* ---------- tasks ---------- */
  async function viewTasks(main, ctl) {
    const [{ tasks }, { contacts }] = await Promise.all([api('GET', '/crm/tasks'), api('GET', '/crm/contacts')]);
    if (ctl.signal.aborted) return;
    const t0 = todayISO(), wk = addDaysISO(7);
    const recount = () => setBadge(tasks.filter(t => !t.done && t.due_on && t.due_on <= t0).length);
    recount();
    const title = h('input', { placeholder: 'What needs doing?', 'aria-label': 'New task', maxlength: '200' });
    const due = h('input', { type: 'date', value: t0, 'aria-label': 'Due date' });
    const whoSel = h('select', { 'aria-label': 'Contact (optional)' }, h('option', { value: '' }, 'No contact'),
      contacts.filter(c => !c.archived).sort((a, b) => who(a).localeCompare(who(b))).map(c => h('option', { value: String(c.id) }, who(c))));
    const form = h('form', { class: 'task-add task-add-wide' }, title, due, whoSel, h('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus'), 'Add task'));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!title.value.trim()) { title.focus(); return; }
      try { await api('POST', '/crm/tasks', { title: title.value.trim(), due_on: due.value || null, contact_id: whoSel.value || null }); toast('Task added.'); route(); }
      catch (err) { toast(err.message, true); }
    });
    const groups = [
      ['Overdue', t => t.due_on && t.due_on < t0, 'group-over'],
      ['Today', t => t.due_on === t0],
      ['Next 7 days', t => t.due_on && t.due_on > t0 && t.due_on <= wk],
      ['Later', t => t.due_on && t.due_on > wk],
      ['No date', t => !t.due_on],
    ].map(([name, test, cls]) => {
      const items = tasks.filter(test);
      if (!items.length) return null;
      const p = panel(name, h('span', { class: 'group-count' }, String(items.length)), h('div', { class: 'list' }, items.map(t => taskRow(t, { deletable: true, onChange: recount }))));
      if (cls) p.classList.add(cls);
      return p;
    }).filter(Boolean);
    const doneBox = h('div');
    const showDone = h('button', { class: 'btn btn-quiet btn-sm', type: 'button' }, 'Show recently completed');
    showDone.addEventListener('click', async () => {
      showDone.disabled = true;
      try {
        const r = await api('GET', '/crm/tasks?done=1');
        doneBox.replaceChildren(panel('Recently completed', null, r.tasks.length ? h('div', { class: 'list' }, r.tasks.map(t => taskRow(t, { deletable: true }))) : h('p', { class: 'muted small' }, 'Nothing completed yet.')));
        showDone.remove();
      } catch (err) { toast(err.message, true); showDone.disabled = false; }
    });
    main.replaceChildren(
      pageHead('Tasks', 'Follow-ups for you and Marv. New website inquiries and payments add one automatically.'),
      form,
      groups.length ? h('div', { class: 'task-groups' }, groups) : panel('No open tasks', null, h('p', { class: 'panel-intro' }, 'You’re all caught up.')),
      h('div', { class: 'panel-actions' }, showDone), doneBox);
  }

  /* ---------- renewals ---------- */
  async function viewRenewals(main, ctl) {
    const { contacts } = await api('GET', '/crm/renewals');
    if (ctl.signal.aborted) return;
    const table = (rows, dateKey, planKey, opts, undecided) => {
      if (!rows.length) return h('p', { class: 'muted small' }, 'No clients with this date yet. It’s set when a client pays.');
      return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, ['Client', 'Ends', '', 'Decision'].map(t => h('th', { scope: 'col' }, t)))),
        h('tbody', null, rows.map(c => {
          const sel = h('select', { 'aria-label': 'Decision for ' + who(c) }, opts.map(([v, t]) => h('option', { value: v }, t)));
          sel.value = c[planKey] || '';
          const tr = h('tr', { class: undecided.includes(c[planKey] || '') ? null : 'is-decided' },
            h('td', { class: 'cell-title' }, h('a', { href: '#/contacts/' + c.id }, who(c)), h('small', null, [c.business && c.name ? c.name : '', c.phone || c.email].filter(Boolean).join(' · ') || ' ')),
            h('td', { 'data-label': 'Ends' }, fmtDate(c[dateKey])),
            h('td', { 'data-label': 'When' }, countdown(c[dateKey])),
            h('td', { 'data-label': 'Decision' }, sel));
          sel.addEventListener('click', e => e.stopPropagation());
          sel.addEventListener('change', async () => {
            try { await api('PATCH', '/crm/contacts/' + c.id, { [planKey]: sel.value }); c[planKey] = sel.value; tr.classList.toggle('is-decided', !undecided.includes(sel.value)); toast('Saved.'); }
            catch (err) { sel.value = c[planKey] || ''; toast(err.message, true); }
          });
          tr.addEventListener('click', e => { if (!e.target.closest('a, select')) location.hash = '#/contacts/' + c.id; });
          return tr;
        }))));
    };
    const by = k => (a, b) => a[k].localeCompare(b[k]);
    const crmRows = contacts.filter(c => c.crm_free_until).sort(by('crm_free_until'));
    const svcRows = contacts.filter(c => c.services_until).sort(by('services_until'));
    main.replaceChildren(
      pageHead('Renewals', 'Each client’s included services and free CRM end at month 12. Reach out about a month before.'),
      panel('Free CRM year ending', h('span', { class: 'h2-aside' }, 'then $34.95/month, or included in the Business Bundle'), table(crmRows, 'crm_free_until', 'crm_plan', CRM_PLANS, ['', 'free'])),
      panel('Included services ending', h('span', { class: 'h2-aside' }, 'Business Bundle $49.95/month (CRM included), or individual services'), table(svcRows, 'services_until', 'bundle_plan', BUNDLE_PLANS, [''])));
  }

  /* ---------- settings ---------- */
  async function viewSettings(main, ctl) {
    const s = await api('GET', '/crm/settings');
    if (ctl.signal.aborted) return;
    stages = s.stages; admins = s.admins;
    let draft = stages.map(x => ({ ...x }));
    const listEl = h('ol', { class: 'stage-list' });
    function draw(focusIndex) {
      listEl.replaceChildren(...draft.map((st, i) => {
        const inp = h('input', { value: st.label, maxlength: '40', 'aria-label': `Stage ${i + 1} name` });
        inp.addEventListener('input', () => { st.label = inp.value; });
        const move = dir => { const j = i + dir; [draft[i], draft[j]] = [draft[j], draft[i]]; draw(j); };
        const up = iconBtn('up', 'Move up', () => move(-1)); up.disabled = i === 0;
        const down = iconBtn('down', 'Move down', () => move(1)); down.disabled = i === draft.length - 1;
        const rm = st.type === 'open'
          ? iconBtn('trash', 'Remove stage', () => { if (draft.filter(x => x.type === 'open').length <= 1) { toast('Keep at least one open stage.', true); return; } draft.splice(i, 1); draw(); })
          : h('span');
        const li = cssVar(h('li', { class: 'stage-item' }, h('span', { class: 'dot' }), inp, h('span', { class: 'stage-type' }, TYPE_NAMES[st.type]), up, down, rm), '--c', colorFor(st, draft));
        if (i === focusIndex) requestAnimationFrame(() => inp.focus());
        return li;
      }));
    }
    draw();
    const addBtn = h('button', { class: 'btn btn-quiet btn-sm', type: 'button' }, icon('plus'), 'Add a stage');
    addBtn.addEventListener('click', () => {
      if (draft.length >= 15) { toast('That’s the most stages the board can hold.', true); return; }
      const at = draft.findIndex(x => x.type !== 'open');
      const idx = at < 0 ? draft.length : at;
      draft.splice(idx, 0, { key: '', label: 'New stage', type: 'open' });
      draw(idx);
    });
    const resetBtn = h('button', { class: 'btn btn-quiet btn-sm', type: 'button' }, 'Restore defaults');
    resetBtn.addEventListener('click', () => { draft = s.defaults.map(x => ({ ...x })); draw(); toast('Defaults restored. Save to keep them.'); });
    const saveBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Save stages');
    saveBtn.addEventListener('click', async () => {
      if (draft.some(x => !x.label.trim())) { toast('Every stage needs a name.', true); return; }
      saveBtn.disabled = true;
      try { const r = await api('PUT', '/crm/settings', { stages: draft.map(x => ({ ...x, label: x.label.trim() })) }); stages = r.stages; draft = stages.map(x => ({ ...x })); draw(); toast('Stages saved.'); }
      catch (err) { toast(err.message, true); }
      saveBtn.disabled = false;
    });
    const exportBtn = h('button', { class: 'btn btn-quiet btn-sm', type: 'button' }, icon('download'), 'Export contacts (CSV)');
    exportBtn.addEventListener('click', () => exportCsv(exportBtn));
    main.replaceChildren(
      pageHead('Settings'),
      h('div', { class: 'settings-grid' },
        panel('Pipeline stages', null,
          h('p', { class: 'panel-intro' }, 'Rename, reorder, add, or remove stages. Paid, Launched, and Lost can be renamed but not removed, since payments and renewals depend on them. Contacts in a removed stage move to the first stage.'),
          listEl,
          h('div', { class: 'panel-actions' }, addBtn, resetBtn, saveBtn)),
        h('div', { class: 'settings-side' },
          panel('How leads get here', null, h('ul', { class: 'how-list' },
            h('li', null, h('b', null, 'Website contact form: '), 'creates or updates the contact, logs their message, and adds a “reply” task for today.'),
            h('li', null, h('b', null, 'Square payment: '), 'records the payment, moves the contact to Paid, starts the 12-month service and CRM clock, and adds a “book the first call” task.'),
            h('li', null, h('b', null, 'Everything else: '), 'add contacts with the New contact button.'))),
          panel('Who can sign in', null, h('ul', { class: 'admins' }, admins.map(a => h('li', null, a))),
            h('p', { class: 'muted small' }, 'To change this list, edit CRM_ADMINS in api/wrangler.toml and redeploy the worker.')),
          panel('Your data', null, h('p', { class: 'panel-intro' }, 'Download every contact as a spreadsheet.'), exportBtn),
          panel('Account', null, h('p', { class: 'panel-intro' }, 'Signed in as ' + me + '.'),
            h('button', { class: 'btn btn-quiet btn-sm', type: 'button', onclick: () => signOut('You’re signed out.') }, icon('logout'), 'Sign out')))));
  }

  /* ---------- new contact ---------- */
  function openNewContact() {
    const dlg = h('dialog', { class: 'modal', 'aria-labelledby': 'nc-title' });
    const f = {};
    const field = (key, label, attrs = {}, wide) => {
      const inp = h('input', { id: 'nc-' + key, ...attrs });
      f[key] = inp;
      return h('div', { class: 'field' + (wide ? ' span-2' : '') }, h('label', { for: 'nc-' + key }, label), inp);
    };
    const stageSel = h('select', { id: 'nc-stage' }, stages.filter(s => s.type !== 'lost').map(s => h('option', { value: s.key }, s.label)));
    const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add contact');
    const form = h('form', { class: 'modal-body', novalidate: true },
      h('header', { class: 'modal-head' }, h('h2', { id: 'nc-title' }, 'New contact'), iconBtn('x', 'Close', () => dlg.close())),
      h('div', { class: 'form-grid' },
        field('business', 'Business', { autocomplete: 'organization', maxlength: '160' }),
        field('name', 'Contact name', { autocomplete: 'name', maxlength: '120' }),
        field('email', 'Email', { type: 'email', autocomplete: 'email', spellcheck: 'false', maxlength: '200' }),
        field('phone', 'Phone', { type: 'tel', autocomplete: 'tel', maxlength: '40' }),
        field('industry', 'Industry', { list: 'dl-industries', maxlength: '80' }),
        field('city', 'City', { maxlength: '120' }),
        field('website', 'Website or demo link', { inputmode: 'url', spellcheck: 'false', placeholder: 'https://', maxlength: '300' }, true),
        h('div', { class: 'field' }, h('label', { for: 'nc-stage' }, 'Stage'), stageSel),
        field('value', 'Deal value ($)', { type: 'number', min: '0', step: '1', value: '499' }),
        field('source', 'Source', { list: 'dl-sources', placeholder: 'Referral, outreach, walk-in…', maxlength: '80' }, true)),
      err,
      h('footer', { class: 'modal-foot' }, h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => dlg.close() }, 'Cancel'), submit));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      err.hidden = true;
      const body = { stage: stageSel.value };
      for (const [k, inp] of Object.entries(f)) body[k] = inp.value.trim();
      body.value_cents = Math.round((parseFloat(body.value) || 0) * 100);
      delete body.value;
      if (!body.business && !body.name && !body.email) { err.textContent = 'Add at least a business, a name, or an email.'; err.hidden = false; f.business.focus(); return; }
      submit.disabled = true;
      try {
        const r = await api('POST', '/crm/contacts', body);
        dlg.close(); toast('Contact added.');
        location.hash = '#/contacts/' + r.contact.id;
      } catch (ex) {
        err.replaceChildren(ex.message);
        if (ex.status === 409 && ex.data && ex.data.id) err.append(' ', h('a', { href: '#/contacts/' + ex.data.id, onclick: () => dlg.close() }, 'Open that contact'));
        err.hidden = false; submit.disabled = false;
      }
    });
    dlg.append(form);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
    f.business.focus();
  }

  boot();
})();
