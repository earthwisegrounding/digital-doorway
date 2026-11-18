(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----- Headline: wait for the variable font so the width animation is real ----- */
  const ready = () => root.classList.add('is-ready');
  if (document.fonts && document.fonts.load) {
    Promise.race([
      document.fonts.load('800 1em Archivo'),
      new Promise((resolve) => setTimeout(resolve, 1400)),
    ]).then(ready, ready);
  } else {
    ready();
  }

  /* ----- The riser: measure where it starts and ends, fill it as the page scrolls ----- */
  const page = document.querySelector('.page');
  const riser = document.querySelector('.riser');
  const startEl = document.querySelector('[data-riser-start]');
  const endEl = document.querySelector('[data-riser-end]');
  const taps = [...document.querySelectorAll('[data-tap]')];
  const LINE_OFFSET = 9; // centre of the wire-and-pipe pair, from the riser's edge

  let riserTop = 0;
  let riserHeight = 0;
  let tapOffsets = [];
  let fill = 0;
  let frame = null;

  const pageY = (el) => el.getBoundingClientRect().top + window.scrollY;

  function measure() {
    if (!page || !riser || !startEl || !endEl) return;
    const pageTop = pageY(page);
    const startRect = startEl.getBoundingClientRect();
    const endRect = endEl.getBoundingClientRect();
    const startCentre = startRect.top + window.scrollY + startRect.height / 2;
    const endCentre = endRect.top + window.scrollY + endRect.height / 2;
    riserTop = startCentre - pageTop - LINE_OFFSET;
    riserHeight = Math.max(0, endCentre - startCentre + LINE_OFFSET * 2);
    riser.style.setProperty('--riser-top', `${riserTop}px`);
    riser.style.setProperty('--riser-h', `${riserHeight}px`);
    tapOffsets = taps.map((tap) => {
      const r = tap.getBoundingClientRect();
      return r.top + window.scrollY + r.height / 2 - pageTop - riserTop;
    });
    requestTick();
  }

  function target() {
    const pageTop = pageY(page);
    const endRect = endEl.getBoundingClientRect();
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom || endRect.top + endRect.height / 2 < window.innerHeight * 0.78) return riserHeight;
    const reach = window.scrollY + window.innerHeight * 0.8 - pageTop - riserTop;
    return Math.min(Math.max(reach, 0), Math.max(riserHeight - 40, 0));
  }

  function paint() {
    riser.style.setProperty('--fill', `${fill}px`);
    taps.forEach((tap, i) => tap.classList.toggle('is-live', fill >= tapOffsets[i]));
    endEl.classList.toggle('is-connected', riserHeight > 0 && fill >= riserHeight - 0.5);
  }

  function tick() {
    frame = null;
    const goal = target();
    if (reduceMotion) {
      fill = goal;
    } else {
      fill += (goal - fill) * 0.14;
      if (Math.abs(goal - fill) < 0.5) fill = goal;
    }
    paint();
    if (fill !== goal) requestTick();
  }

  function requestTick() {
    if (frame === null) frame = requestAnimationFrame(tick);
  }

  if (page && riser && startEl && endEl) {
    measure();
    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(page);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  /* ----- Open-now status and today's row, on Matthews (Eastern) time ----- */
  function easternNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day, minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
  }

  function status() {
    const { day, minutes } = easternNow();
    const weekday = day >= 1 && day <= 5;
    const OPEN = 8 * 60;
    const CLOSE = 17 * 60;
    if (weekday && minutes >= OPEN && minutes < CLOSE) return { state: 'open', text: 'Open now until 5:00 PM' };
    if (weekday && minutes < OPEN) return { state: 'closed', text: 'Opens today at 8:00 AM' };
    if (day === 6) return { state: 'appointment', text: 'Saturday visits by appointment' };
    if (day === 5) return { state: 'closed', text: 'Closed now, Saturday by appointment' };
    if (day === 0) return { state: 'closed', text: 'Closed today, opens Monday at 8:00 AM' };
    return { state: 'closed', text: 'Closed now, opens tomorrow at 8:00 AM' };
  }

  try {
    const now = status();
    document.querySelectorAll('[data-status]').forEach((el) => {
      el.textContent = now.text;
      el.dataset.state = now.state;
      el.hidden = false;
    });
    const today = String(easternNow().day);
    document.querySelectorAll('.hours tr[data-days]').forEach((row) => {
      row.classList.toggle('is-today', row.dataset.days.split(',').includes(today));
    });
  } catch (err) {
    /* Leave the static hours in place if the time zone lookup is unavailable. */
  }

  /* ----- Mobile menu ----- */
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ----- Reviews: offer "read the full review" only where text is actually cut off ----- */
  function setupReviews() {
    document.querySelectorAll('.review').forEach((review) => {
      const text = review.querySelector('.review__text');
      const more = review.querySelector('.review__more');
      if (!text || !more || review.classList.contains('is-open')) return;
      more.hidden = text.scrollHeight <= text.clientHeight + 2;
    });
  }
  document.querySelectorAll('.review__more').forEach((more) => {
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', () => {
      const open = more.closest('.review').classList.toggle('is-open');
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Show less' : 'Read the full review';
    });
  });
  setupReviews();
  window.addEventListener('load', setupReviews);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setupReviews);

  /* ----- Photo lightbox ----- */
  const lightbox = document.querySelector('.lightbox');
  if (lightbox && typeof lightbox.showModal === 'function') {
    const image = lightbox.querySelector('img');
    const caption = lightbox.querySelector('.lightbox__caption');
    document.querySelectorAll('[data-lightbox]').forEach((button) => {
      button.addEventListener('click', () => {
        const thumb = button.querySelector('img');
        const figcaption = button.closest('figure').querySelector('figcaption');
        image.src = button.dataset.lightbox;
        image.alt = thumb ? thumb.alt : '';
        caption.textContent = figcaption ? figcaption.textContent : '';
        lightbox.showModal();
      });
    });
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) lightbox.close();
    });
  }

  /* ----- Mobile call bar: show it whenever neither call button is on screen ----- */
  const callbar = document.querySelector('[data-callbar]');
  if (callbar && startEl && endEl && 'IntersectionObserver' in window) {
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      callbar.classList.toggle('is-visible', visible.size === 0);
    });
    observer.observe(startEl);
    observer.observe(endEl);
  }
})();
