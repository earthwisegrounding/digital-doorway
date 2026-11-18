(() => {
  'use strict';

  const wide = window.matchMedia('(min-width: 62rem)');

  /* Navigation: a popover on small screens, an inline row on wide ones. */
  const menu = document.getElementById('site-menu');
  if (menu) {
    const syncMenu = () => {
      if (wide.matches) {
        if (menu.matches(':popover-open')) menu.hidePopover();
        menu.removeAttribute('popover');
      } else {
        menu.setAttribute('popover', 'auto');
      }
    };
    if ('popover' in HTMLElement.prototype) {
      syncMenu();
      wide.addEventListener('change', syncMenu);
      menu.addEventListener('click', (event) => {
        if (event.target.closest('a') && menu.matches(':popover-open')) menu.hidePopover();
      });
    }
  }

  /* Plumbing diagram: one service lit at a time. */
  const diagram = document.getElementById('diagram');
  const caption = document.getElementById('diagram-caption');
  const buttons = [...document.querySelectorAll('.svc')];

  if (diagram && buttons.length) {
    const systems = [...diagram.querySelectorAll('.sys')];
    const defaultCaption = caption.textContent;
    let active = null;

    const setActive = (key) => {
      if (key === active) return;
      active = key;
      diagram.classList.toggle('has-active', Boolean(key));
      systems.forEach((group) => {
        const on = Boolean(key) && group.dataset.sys.split(' ').includes(key);
        group.classList.toggle('is-active', on);
      });
      let label = defaultCaption;
      buttons.forEach((button) => {
        const on = button.dataset.service === key;
        button.setAttribute('aria-pressed', String(on));
        if (on) label = button.querySelector('.svc__name').textContent;
      });
      caption.textContent = label;
    };

    buttons.forEach((button) => {
      const key = button.dataset.service;
      button.addEventListener('click', () => setActive(key));
      button.addEventListener('focus', () => setActive(key));
      button.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') setActive(key);
      });
    });

    diagram.querySelectorAll('.hot').forEach((spot) => {
      spot.addEventListener('click', () => {
        const key = spot.dataset.service;
        setActive(active === key ? null : key);
      });
    });

    /* Scrolling through the list lights each service as it crosses a reading line. */
    let rowObserver;
    const watchRows = () => {
      if (rowObserver) rowObserver.disconnect();
      const margin = wide.matches ? '-42% 0px -52% 0px' : '-62% 0px -30% 0px';
      rowObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setActive(entry.target.dataset.service || null);
        });
      }, { rootMargin: margin });
      buttons.forEach((button) => rowObserver.observe(button));
      const hero = document.querySelector('.hero');
      if (hero) rowObserver.observe(hero);
    };
    watchRows();
    wide.addEventListener('change', watchRows);

    /* Draw the pipes in once, the first time the diagram is on screen. */
    const drawObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        diagram.classList.add('is-in');
        drawObserver.disconnect();
      }
    }, { threshold: 0.15 });
    drawObserver.observe(diagram);
  }

  /* Rating gauge: sweep the needle when it scrolls into view. */
  const rating = document.getElementById('rating');
  if (rating) {
    const gaugeObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        rating.classList.add('is-in');
        gaugeObserver.disconnect();
      }
    }, { threshold: 0.6 });
    gaugeObserver.observe(rating);
  }

  /* Phone call bar: appears once the hero call button has scrolled away, hides from the contact section down. */
  const callBar = document.getElementById('call-bar');
  const heroCall = document.getElementById('hero-call');
  const contact = document.getElementById('contact');
  if (callBar && heroCall && contact) {
    const visible = new Set();
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      callBar.classList.toggle('is-shown', visible.size === 0);
    });
    barObserver.observe(heroCall);
    barObserver.observe(contact);
    const footer = document.querySelector('.site-footer');
    if (footer) barObserver.observe(footer);
  }
})();
