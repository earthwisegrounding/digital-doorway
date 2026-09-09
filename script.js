/* Digital Doorway Marketing — vanilla JS
   Nav state, mobile menu, scroll reveals, threshold dividers, process path,
   active-section tracking, smooth anchors, FAQ accordion, contact form. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var menuOpen = false;
  var nav = document.querySelector('.nav');
  var hamburger = document.querySelector('.hamburger');
  var mobileMenu = document.getElementById('mobile-menu');
  var body = document.body;

  /* ---------- Nav: transparent -> solid after 40px; on phones, tuck away on scroll-down ---------- */
  var ticking = false;
  var lastY = window.scrollY;
  var compactMql = window.matchMedia('(max-width: 1023px)');
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 40);
      if (compactMql.matches && !menuOpen) {
        var delta = y - lastY;
        if (y < 120 || delta < -6) nav.classList.remove('is-hidden');
        else if (delta > 6) nav.classList.add('is-hidden');
      } else {
        nav.classList.remove('is-hidden');
      }
      lastY = y;
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  function setPageInert(state) {
    document.querySelectorAll('main, footer, .skip-link').forEach(function (el) { el.inert = state; });
  }
  function openMenu() {
    menuOpen = true;
    mobileMenu.hidden = false;
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Close menu');
    body.classList.add('menu-open');
    nav.classList.remove('is-hidden');
    setPageInert(true);
    // next frame so the transition runs from the hidden state
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        mobileMenu.classList.add('is-open');
        var first = mobileMenu.querySelector('a');
        if (first) first.focus({ preventScroll: true });
      });
    });
  }
  function closeMenu(returnFocus) {
    if (!menuOpen) return;
    menuOpen = false;
    setPageInert(false);
    mobileMenu.classList.remove('is-open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Open menu');
    body.classList.remove('menu-open');
    var delay = reduceMotion ? 0 : 320;
    window.setTimeout(function () { if (!menuOpen) mobileMenu.hidden = true; }, delay);
    if (returnFocus) hamburger.focus();
  }
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () { menuOpen ? closeMenu(false) : openMenu(); });
    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) closeMenu(true);
    });
    var desktopMql = window.matchMedia('(min-width: 1024px)');
    var onDesktop = function (e) { if (e.matches) closeMenu(false); };
    if (desktopMql.addEventListener) desktopMql.addEventListener('change', onDesktop);
    else if (desktopMql.addListener) desktopMql.addListener(onDesktop);
  }

  /* ---------- Smooth anchor scrolling ---------- */
  function navOffset() { return nav ? nav.getBoundingClientRect().height + 8 : 80; }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    var top = id === 'top' ? 0 : target.getBoundingClientRect().top + window.scrollY - navOffset() + 12;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    if (history.pushState) history.pushState(null, '', '#' + id);
    // move focus for keyboard users without scrolling again
    if (id !== 'top') {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  });

  /* ---------- Scroll reveals ---------- */
  var supportsIO = 'IntersectionObserver' in window;
  var revealEls = document.querySelectorAll('[data-reveal]');
  if (supportsIO && !reduceMotion) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
    // (.showcase carries data-reveal too, so the sideways-scrolling mobile row reveals as one.)
    revealEls.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Threshold dividers draw in ---------- */
  var thresholds = document.querySelectorAll('.threshold');
  if (supportsIO && !reduceMotion) {
    var thIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-drawn');
          thIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    thresholds.forEach(function (el) { thIO.observe(el); });
  } else {
    thresholds.forEach(function (el) { el.classList.add('is-drawn'); });
  }

  /* ---------- Example rail (phones): tab stop + position counter ---------- */
  var showcase = document.querySelector('.showcase');
  var railCurrent = document.querySelector('[data-rail-current]');
  if (showcase) {
    var railMql = window.matchMedia('(max-width: 639px)');
    var applyRail = function (isRail) {
      if (isRail) {
        showcase.tabIndex = 0;
        showcase.setAttribute('role', 'group');
        showcase.setAttribute('aria-label', 'Example sites, scroll sideways');
      } else {
        showcase.removeAttribute('tabindex');
        showcase.removeAttribute('role');
        showcase.removeAttribute('aria-label');
      }
    };
    applyRail(railMql.matches);
    var onRail = function (e) { applyRail(e.matches); };
    if (railMql.addEventListener) railMql.addEventListener('change', onRail);
    else if (railMql.addListener) railMql.addListener(onRail);
    if (railCurrent) {
      var cards = showcase.querySelectorAll('.show');
      var railTick = false;
      showcase.addEventListener('scroll', function () {
        if (railTick) return;
        railTick = true;
        window.requestAnimationFrame(function () {
          var w = showcase.scrollWidth - showcase.clientWidth;
          var i = w > 0 ? Math.round(showcase.scrollLeft / w * (cards.length - 1)) : 0;
          railCurrent.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
          railTick = false;
        });
      }, { passive: true });
    }
  }

  /* ---------- Search demo: with / without a site ---------- */
  var demo = document.querySelector('[data-search-demo]');
  if (demo) {
    var sdButtons = demo.querySelectorAll('.sd-btn');
    sdButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var withSite = btn.getAttribute('data-sd') === 'with';
        demo.classList.toggle('is-with', withSite);
        sdButtons.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    });
  }

  /* ---------- How-it-works path ---------- */
  var steps = document.querySelector('[data-steps]');
  if (steps) {
    if (supportsIO && !reduceMotion) {
      var stepIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            steps.classList.add('is-drawn');
            stepIO.disconnect();
          }
        });
      }, { threshold: 0.25 });
      stepIO.observe(steps);
    } else {
      steps.classList.add('is-drawn');
    }
  }

  /* ---------- Active section link ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  var sections = navLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
  if (supportsIO && sections.length) {
    var activeIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    sections.forEach(function (s) { activeIO.observe(s); });
  }

  /* ---------- FAQ accordion: one open at a time ---------- */
  var faq = document.querySelector('[data-faq]');
  if (faq) {
    faq.addEventListener('toggle', function (e) {
      var d = e.target;
      if (d.tagName !== 'DETAILS' || !d.open) return;
      faq.querySelectorAll('details[open]').forEach(function (other) {
        if (other !== d) other.open = false;
      });
    }, true);
  }

  /* ---------- Contact form ---------- */
  var form = document.getElementById('contact-form');
  var success = document.getElementById('form-success');
  if (form) {
    var fields = {
      name: { el: form.elements.name, err: document.getElementById('f-name-err'), msg: 'Please tell us your name.' },
      business: { el: form.elements.business, err: document.getElementById('f-biz-err'), msg: 'What\'s your business called?' },
      email: { el: form.elements.email, err: document.getElementById('f-email-err'), msg: 'We need a working email to reply to.' },
      phone: { el: form.elements.phone, err: document.getElementById('f-phone-err'), msg: 'That phone number doesn\'t look right.' },
      type: { el: form.elements.type, err: document.getElementById('f-type-err'), msg: 'Pick the closest kind of business.' },
      message: { el: form.elements.message, err: document.getElementById('f-msg-err'), msg: 'A sentence or two is plenty.' }
    };

    function validateField(key) {
      var f = fields[key];
      var v = f.el.value.trim();
      var ok = true;
      if (key === 'phone') {
        ok = v === '' || /^[+\d][\d\s().-]{6,}$/.test(v);
      } else if (key === 'email') {
        ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      } else {
        ok = v.length > 0;
      }
      var wrap = f.el.closest('.field');
      wrap.classList.toggle('has-error', !ok);
      f.err.textContent = ok ? '' : f.msg;
      f.el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) f.el.setAttribute('aria-describedby', f.err.id); else f.el.removeAttribute('aria-describedby');
      return ok;
    }

    Object.keys(fields).forEach(function (key) {
      var el = fields[key].el;
      el.addEventListener('blur', function () { if (el.value.trim() !== '' || el.closest('.field').classList.contains('has-error')) validateField(key); });
      el.addEventListener('input', function () { if (el.closest('.field').classList.contains('has-error')) validateField(key); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      Object.keys(fields).forEach(function (key) {
        var ok = validateField(key);
        if (!ok && !firstBad) firstBad = fields[key].el;
      });
      var status = form.querySelector('.form-status');
      if (firstBad) {
        firstBad.focus();
        status.textContent = 'A couple of fields need a look.';
        return;
      }
      status.textContent = '';

      var endpoint = form.getAttribute('data-endpoint');
      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;

      function showSuccess() {
        form.classList.add('is-sent');
        form.inert = true;
        form.setAttribute('aria-hidden', 'true');
        success.hidden = false;
        window.setTimeout(function () { success.focus(); }, 50);
        window.setTimeout(function () { form.hidden = true; }, 400);
      }

      if (endpoint) {
        // FORM ENDPOINT: posts JSON to data-endpoint (Formspree-style). Swap for Netlify if preferred.
        var payload = {};
        Object.keys(fields).forEach(function (k) { payload[k] = fields[k].el.value.trim(); });
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (r) {
          if (!r.ok) throw new Error('bad status');
          showSuccess();
        }).catch(function () {
          button.disabled = false;
          status.textContent = 'Something hiccupped. Email us directly and we\'ll sort it out.';
        });
      } else {
        // No endpoint wired yet: open a prefilled email as a fallback, then show the success card.
        var to = form.getAttribute('data-mailto') || '';
        var subject = encodeURIComponent('Website for ' + fields.business.el.value.trim());
        var bodyText = encodeURIComponent(
          'Name: ' + fields.name.el.value.trim() + '\n' +
          'Business: ' + fields.business.el.value.trim() + '\n' +
          'Email: ' + fields.email.el.value.trim() + '\n' +
          'Phone: ' + fields.phone.el.value.trim() + '\n' +
          'Type: ' + fields.type.el.value + '\n\n' +
          fields.message.el.value.trim()
        );
        try { window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + bodyText; } catch (err) { /* ignore */ }
        // Nothing has been delivered yet: say so, instead of claiming "got it".
        var title = success.querySelector('[data-success-title]');
        var bodyEl = success.querySelector('[data-success-body]');
        if (title) title.textContent = 'Almost there. Your email app should have opened with everything filled in.';
        if (bodyEl) {
          bodyEl.textContent = '';
          bodyEl.appendChild(document.createTextNode('Hit send and we\'ll reply within one business day. Nothing opened? Email '));
          var mailLink = document.createElement('a'); // REPLACE (mirrors data-mailto)
          mailLink.className = 'link-hand'; mailLink.href = 'mailto:' + to; mailLink.textContent = to;
          bodyEl.appendChild(mailLink);
          bodyEl.appendChild(document.createTextNode(' or call '));
          var telLink = document.createElement('a'); // REPLACE phone number
          telLink.className = 'link-hand'; telLink.href = 'tel:+15550100199'; telLink.textContent = '(555) 010-0199';
          bodyEl.appendChild(telLink);
          bodyEl.appendChild(document.createTextNode('.'));
        }
        showSuccess();
      }
    });
  }

  /* ---------- Footer year ---------- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Voice note player ---------- */
  document.querySelectorAll('[data-voice]').forEach(function (box) {
    var audio = box.querySelector('audio'), btn = box.querySelector('.voice-btn'), track = box.querySelector('.voice-track');
    var cur = box.querySelector('[data-voice-current]'), tot = box.querySelector('[data-voice-total]');
    if (!audio || !btn || !track) return;
    function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    function paint() {
      var d = audio.duration || 0, p = d ? (audio.currentTime / d) * 100 : 0;
      track.style.setProperty('--p', p.toFixed(2) + '%'); track.setAttribute('aria-valuenow', Math.round(p));
      cur.textContent = fmt(audio.currentTime);
    }
    audio.addEventListener('loadedmetadata', function () { if (audio.duration) tot.textContent = fmt(audio.duration); });
    audio.addEventListener('timeupdate', paint);
    audio.addEventListener('play', function () { box.classList.add('is-playing'); btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'Pause the message from Marv'); });
    audio.addEventListener('pause', function () { box.classList.remove('is-playing'); btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Play a message from Marv'); });
    audio.addEventListener('ended', function () { audio.currentTime = 0; paint(); });
    btn.addEventListener('click', function () { if (audio.paused) { audio.play(); } else { audio.pause(); } });
    function seekTo(clientX) { var r = track.getBoundingClientRect(); var f = Math.min(1, Math.max(0, (clientX - r.left) / r.width)); if (audio.duration) { audio.currentTime = f * audio.duration; paint(); } }
    track.addEventListener('click', function (e) { seekTo(e.clientX); });
    track.addEventListener('keydown', function (e) {
      if (!audio.duration) return;
      if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); paint(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); paint(); e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'Enter') { btn.click(); e.preventDefault(); }
    });
  });
})();
