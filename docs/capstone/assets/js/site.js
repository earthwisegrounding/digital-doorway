// Capstone Fence: hero pickets, photo viewer, opening-hours status.

// Hero: cut the photo into boards. One board per ~62px of width.
(() => {
  const fence = document.querySelector('[data-fence]');
  if (!fence || !CSS.supports('width', '1cqw')) return;

  let count = 0;
  const build = () => {
    const n = Math.max(6, Math.min(22, Math.round(fence.clientWidth / 62)));
    if (n === count) return;
    count = n;
    fence.querySelectorAll('.picket').forEach((p) => p.remove());
    fence.style.setProperty('--n', n);
    for (let i = 0; i < n; i += 1) {
      const picket = document.createElement('span');
      picket.className = 'picket';
      picket.style.setProperty('--i', i);
      picket.appendChild(document.createElement('i'));
      fence.appendChild(picket);
    }
    fence.classList.add('is-built');
  };

  build();
  // Only the first build animates; later rebuilds (resize, rotate) appear in place.
  setTimeout(() => fence.classList.add('is-settled'), 2600);
  new ResizeObserver(build).observe(fence);
})();

// Close the phone menu after choosing a section.
(() => {
  const menu = document.getElementById('menu');
  if (!menu || !menu.hidePopover) return;
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) menu.hidePopover();
  });
})();

// Photo viewer.
(() => {
  const dialog = document.querySelector('.lightbox');
  const shots = [...document.querySelectorAll('[data-shot]')];
  if (!dialog || !dialog.showModal || !shots.length) return;

  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  let current = 0;

  const show = (index) => {
    current = (index + shots.length) % shots.length;
    const button = shots[current];
    image.src = button.dataset.shot;
    image.alt = button.querySelector('img').alt;
    caption.textContent = button.closest('figure').querySelector('figcaption').textContent;
  };

  shots.forEach((button, index) => {
    button.addEventListener('click', () => {
      show(index);
      dialog.showModal();
    });
  });

  dialog.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
  dialog.querySelector('.lb-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
  dialog.addEventListener('close', () => shots[current].focus());
})();

// "Open now" line, worked out in the office's own time zone (Central).
(() => {
  const el = document.querySelector('[data-open-status]');
  if (!el) return;

  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date());
  } catch (error) {
    return;
  }

  const get = (type) => parts.find((part) => part.type === type).value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const OPEN = 8 * 60;
  const CLOSE = 17 * 60;
  const weekday = day >= 1 && day <= 5;

  let message;
  if (weekday && minutes >= OPEN && minutes < CLOSE) {
    message = 'Open now until 5:00 PM Central';
    el.classList.add('is-open');
  } else if (weekday && minutes < OPEN) {
    message = 'Opens today at 8:00 AM Central';
  } else if (day === 6) {
    message = 'Saturday by appointment. Office opens Monday at 8:00 AM Central';
  } else if (day === 5 || day === 0) {
    message = 'Closed now. Opens Monday at 8:00 AM Central';
  } else {
    message = 'Closed now. Opens tomorrow at 8:00 AM Central';
  }

  el.textContent = message;
  el.hidden = false;
})();

// Keep the copyright year current.
(() => {
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
