(() => {
  'use strict';

  const hero = document.querySelector('.hero');
  const raw = hero.querySelector('.raw');
  const tape = hero.querySelector('.tape');
  const range = hero.querySelector('.tape-range');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rest = Number(range.value);

  /* ---- Uncorrected side gets its own copy of the headline, laid out identically ---- */
  const copy = hero.querySelector('.hero__inner').cloneNode(true);
  copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  copy.querySelector('h1').replaceWith(
    Object.assign(document.createElement('p'), {
      className: 'hero__title',
      innerHTML: copy.querySelector('h1').innerHTML,
    })
  );
  raw.append(copy);

  /* ---- Tape line ---- */
  const setSplit = (pct) => {
    const v = Math.min(Number(range.max), Math.max(Number(range.min), pct));
    hero.style.setProperty('--split', v + '%');
    return v;
  };
  const touched = () => hero.classList.add('is-touched');

  /* The tape rests in the gap between the words, so it never sits on a letter. */
  const settleInGap = () => {
    const lines = [...hero.querySelectorAll(':scope > .hero__inner .hero__title span')].slice(0, 2);
    const box = hero.getBoundingClientRect();
    const r = document.createRange();
    let left = -Infinity;
    let right = Infinity;
    for (const line of lines) {
      const node = line.firstChild;
      const i = node && node.nodeType === 3 ? node.data.indexOf(' ') : -1;
      if (i < 0) return;
      r.setStart(node, 0); r.setEnd(node, i);
      left = Math.max(left, r.getBoundingClientRect().right);
      r.setStart(node, i + 1); r.setEnd(node, node.data.length);
      right = Math.min(right, r.getBoundingClientRect().left);
    }
    if (!(right - left > 8)) return;
    rest = (((left + right) / 2 - box.left) / box.width) * 100;
    hero.style.setProperty('--tape-w', Math.max(10, Math.min(30, right - left - 4)).toFixed(1) + 'px');
    range.value = String(Math.round(rest));
  };

  let sweep = null;
  const stopSweep = () => { if (sweep) cancelAnimationFrame(sweep); sweep = null; };

  range.addEventListener('input', () => { stopSweep(); setSplit(Number(range.value)); touched(); });

  tape.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    stopSweep();
    tape.setPointerCapture(e.pointerId);
    touched();
    const move = (ev) => {
      const box = hero.getBoundingClientRect();
      range.value = String(Math.round(setSplit(((ev.clientX - box.left) / box.width) * 100)));
    };
    const end = () => {
      tape.removeEventListener('pointermove', move);
      tape.removeEventListener('pointerup', end);
      tape.removeEventListener('pointercancel', end);
    };
    tape.addEventListener('pointermove', move);
    tape.addEventListener('pointerup', end);
    tape.addEventListener('pointercancel', end);
    e.preventDefault();
  });

  /* ---- One opening move: the whole panel starts uncorrected, then the line pulls back ---- */
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const ready = Promise.race([fontsReady, new Promise((res) => setTimeout(res, 1200))]);

  if (!reduceMotion) hero.style.setProperty('--split', '100%');

  ready.then(() => {
    settleInGap();
    if (reduceMotion) { setSplit(rest); return; }
    setTimeout(() => {
      const start = performance.now();
      const dur = 1500;
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 4);
        hero.style.setProperty('--split', 100 + (rest - 100) * eased + '%');
        sweep = t < 1 ? requestAnimationFrame(step) : null;
      };
      sweep = requestAnimationFrame(step);
    }, 250);
  });

  /* Until someone moves the tape, keep it in the gap when the layout changes. */
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (hero.classList.contains('is-touched') || sweep) return;
      settleInGap();
      setSplit(rest);
    }, 150);
  });

  /* ---- Inspection light follows a mouse or pen ---- */
  let frame = 0;
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const box = hero.getBoundingClientRect();
      hero.style.setProperty('--lx', (e.clientX - box.left).toFixed(1) + 'px');
      hero.style.setProperty('--ly', (e.clientY - box.top).toFixed(1) + 'px');
    });
  });

  /* ---- Menu closes when a link is chosen ---- */
  const menu = document.getElementById('site-menu');
  if (menu && typeof menu.hidePopover === 'function') {
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) menu.hidePopover();
    });
  }

  /* ---- Phone call bar appears after the hero ---- */
  const callbar = document.querySelector('.callbar');
  if (callbar && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      callbar.hidden = entry.isIntersecting;
      document.body.classList.toggle('has-callbar', !entry.isIntersecting);
    }).observe(hero);
  }

  /* ---- Quote form builds an email draft; nothing is sent from the page ---- */
  const form = document.getElementById('quote-form');
  const error = document.getElementById('quote-error');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fields = [...form.querySelectorAll('input, textarea')];
    const empty = fields.filter((f) => !f.value.trim());
    fields.forEach((f) => f.toggleAttribute('aria-invalid', false));
    if (empty.length) {
      empty.forEach((f) => f.setAttribute('aria-invalid', 'true'));
      const names = empty.map((f) => form.querySelector(`label[for="${f.id}"]`).textContent.toLowerCase());
      error.textContent = 'Fill in ' + names.join(', ').replace(/, ([^,]*)$/, ' and $1') + ' to open the draft.';
      error.hidden = false;
      empty[0].focus();
      return;
    }
    error.hidden = true;
    const v = Object.fromEntries(fields.map((f) => [f.name, f.value.trim()]));
    const subject = `Quote request: ${v.vehicle}`;
    const body = `Hi Jason,\n\nVehicle: ${v.vehicle}\n\nWhat it needs:\n${v.needs}\n\nThanks,\n${v.name}`;
    window.location.href =
      'mailto:info.mach1coat@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  });
})();
