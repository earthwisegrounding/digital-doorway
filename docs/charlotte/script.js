/* 24 HR Emergency Plumber Charlotte */
(() => {
  const TZ = 'America/New_York';
  const meta = document.querySelector('meta[name="color-scheme"]');

  /* ---------- Charlotte time ---------- */

  const partsFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });

  function charlotteNow() {
    const parts = partsFmt.formatToParts(new Date());
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return { h: get('hour') % 24, m: get('minute'), s: get('second') };
  }

  const schemeForHour = (h) => (h >= 19 || h < 6 ? 'dark' : 'light');

  function tailForHour(h) {
    if (h >= 21 || h < 5) return 'A plumber is awake.';
    if (h < 9) return 'A plumber is already up.';
    if (h < 17) return 'A plumber is on call.';
    return 'A plumber is still on call.';
  }

  /* ---------- Headline + dial ---------- */

  const lineA = document.querySelector('[data-now-a]');
  const lineB = document.querySelector('[data-now-b]');
  const hands = document.querySelectorAll('[data-hand]');

  function renderTime() {
    const { h, m } = charlotteNow();
    const mm = String(m).padStart(2, '0');
    const h12 = h % 12 || 12;

    if (lineA && lineB) {
      const time = document.createElement('time');
      time.dateTime = `${String(h).padStart(2, '0')}:${mm}`;
      const colon = document.createElement('span');
      colon.className = 'colon';
      colon.textContent = ':';
      time.append(String(h12), colon, `${mm} ${h < 12 ? 'a.m.' : 'p.m.'}`);
      lineA.replaceChildren('It’s ', time, ' in Charlotte.');
      lineB.textContent = tailForHour(h);
    }

    // 24-hour dial: midnight at the top, noon at the bottom.
    const angle = ((h + m / 60) / 24) * 360;
    hands.forEach((hand) => { hand.style.transform = `rotate(${angle}deg)`; });

    // Follow the clock unless the visitor has chosen a view for this visit.
    let override = null;
    try { override = sessionStorage.getItem('scheme'); } catch (e) { /* storage blocked */ }
    if (!override) meta.content = schemeForHour(h);
  }

  function scheduleTick() {
    const { s } = charlotteNow();
    setTimeout(() => { renderTime(); scheduleTick(); }, (60 - s) * 1000 + 50);
  }

  // Let the hand sweep from midnight to now once the page has painted.
  requestAnimationFrame(() => requestAnimationFrame(renderTime));
  scheduleTick();

  /* ---------- Day / night preview ---------- */

  const toggle = document.querySelector('[data-scheme-toggle]');
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const natural = schemeForHour(charlotteNow().h);
      const current = meta.content === 'dark' || meta.content === 'light' ? meta.content : natural;
      const target = current === 'dark' ? 'light' : 'dark';
      try {
        if (target === natural) sessionStorage.removeItem('scheme');
        else sessionStorage.setItem('scheme', target);
      } catch (e) { /* storage blocked: still switch for this page view */ }
      meta.content = target;
    });
  }

  /* ---------- Triage ---------- */

  const triage = document.querySelector('[data-triage]');
  if (triage) {
    const buttons = [...triage.querySelectorAll('.triage-item button')];
    const stacked = window.matchMedia('(max-width: 860px)');

    const open = (btn) => {
      buttons.forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-expanded', String(on));
        document.getElementById(b.getAttribute('aria-controls')).hidden = !on;
      });
    };

    buttons.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        // Stacked layout behaves like an accordion; side by side, one is always shown.
        if (isOpen && stacked.matches) {
          btn.setAttribute('aria-expanded', 'false');
          document.getElementById(btn.getAttribute('aria-controls')).hidden = true;
        } else {
          open(btn);
        }
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const next = buttons[(i + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length];
        next.focus();
        if (!stacked.matches) open(next);
      });
    });

    stacked.addEventListener('change', () => {
      if (!stacked.matches && !buttons.some((b) => b.getAttribute('aria-expanded') === 'true')) open(buttons[0]);
    });
  }

  /* ---------- Photo lightbox ---------- */

  const lightbox = document.getElementById('lightbox');
  const gallery = document.querySelector('[data-gallery]');
  if (lightbox && gallery && typeof lightbox.showModal === 'function') {
    const img = lightbox.querySelector('[data-lightbox-img]');
    const caption = lightbox.querySelector('[data-lightbox-caption]');

    gallery.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-full]');
      if (!btn) return;
      img.src = btn.dataset.full;
      img.alt = btn.querySelector('img').alt;
      caption.textContent = btn.dataset.caption;
      lightbox.showModal();
    });

    // Fallback for browsers without closedby="any".
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      lightbox.addEventListener('click', (e) => {
        if (e.target !== lightbox) return;
        const r = lightbox.getBoundingClientRect();
        const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
        if (!inside) lightbox.close();
      });
    }
  }
})();
