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
        ok = v === '' || /^[+(\d][\d\s().-]{6,}$/.test(v);
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
        var hp = form.querySelector('input[name="website"]'); if (hp) payload.website = hp.value;
        payload.addons = Array.prototype.map.call(form.querySelectorAll('input[name="addons"]:checked'), function (c) { return c.value; }).join(', ');
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
          'Type: ' + fields.type.el.value + '\n' +
          'Add-ons: ' + (Array.prototype.map.call(form.querySelectorAll('input[name="addons"]:checked'), function (c) { return c.value; }).join(', ') || 'none') + '\n\n' +
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
          var telLink = document.createElement('a');
          telLink.className = 'link-hand'; telLink.href = 'tel:+18778531920'; telLink.textContent = '(877) 853-1920';
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

  /* ---------- Hero video: swap the poster for the YouTube player on click ---------- */
  document.querySelectorAll('[data-video]').forEach(function (box) {
    var poster = box.querySelector('.hero-video-poster'); if (!poster) return;
    poster.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + box.getAttribute('data-video') + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      f.title = 'Digital Doorway Marketing: website and services tour'; f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; f.allowFullscreen = true; f.setAttribute('loading', 'eager');
      poster.parentNode.replaceChild(f, poster); f.focus();
    });
  });

  /* ---------- Add-on buttons pre-tick the matching box in the contact form ---------- */
  document.querySelectorAll('[data-addon]').forEach(function (a) {
    a.addEventListener('click', function () {
      var box = document.querySelector('input[name="addons"][value="' + a.getAttribute('data-addon') + '"]');
      if (box) box.checked = true;
    });
  });

  /* ---------- Client work: A/B comparison slider with synced scrolling ---------- */
  (function () {
    var box = document.querySelector('[data-compare]'); if (!box) return;
    var frames = [box.querySelector('.cmp-a'), box.querySelector('.cmp-b')];
    var handle = box.querySelector('.cmp-handle');
    var segBtns = document.querySelectorAll('[data-cw-set]');
    var x = 50;

    function setX(v, fromSeg) {
      x = Math.max(0, Math.min(100, v));
      box.style.setProperty('--x', x + '%');
      box.setAttribute('data-side', x >= 97 ? 'a' : x <= 3 ? 'b' : 'split');
      handle.setAttribute('aria-valuenow', Math.round(x));
      handle.setAttribute('aria-valuetext', x >= 97 ? 'Direction A' : x <= 3 ? 'Direction B' : Math.round(x) + '% Direction A, ' + Math.round(100 - x) + '% Direction B');
      segBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-cw-set') === Math.round(x))); });
    }

    /* drag the handle (pointer events cover mouse, pen, and touch) */
    function xFrom(e) { var r = box.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; }
    handle.addEventListener('pointerdown', function (e) {
      e.preventDefault(); handle.setPointerCapture(e.pointerId); box.classList.add('is-dragging');
      box.style.transition = 'none';
    });
    handle.addEventListener('pointermove', function (e) { if (box.classList.contains('is-dragging')) setX(xFrom(e)); });
    function endDrag() { box.classList.remove('is-dragging'); }
    handle.addEventListener('pointerup', endDrag); handle.addEventListener('pointercancel', endDrag); handle.addEventListener('lostpointercapture', endDrag);
    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 25 : 5;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setX(x - step); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setX(x + step); e.preventDefault(); }
      else if (e.key === 'Home') { setX(0); e.preventDefault(); }
      else if (e.key === 'End') { setX(100); e.preventDefault(); }
    });

    /* A / side by side / B buttons glide the bar */
    var anim = 0;
    function glideTo(target) {
      cancelAnimationFrame(anim); var from = x, t0 = performance.now(), dur = 450;
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        setX(from + (target - from) * e); if (p < 1) anim = requestAnimationFrame(step);
      })(t0);
      setTimeout(function () { if (Math.abs(x - target) > .01) { cancelAnimationFrame(anim); setX(target); } }, dur + 80);
    }
    segBtns.forEach(function (b) { b.addEventListener('click', function () { glideTo(+b.getAttribute('data-cw-set')); }); });

    /* keep both sites scrolled to the same point (proportionally, since page lengths differ).
       Each side remembers the position it was just told to take, so its own scroll event
       doesn't echo back; smooth scrolling is switched off inside the frames so moves are instant. */
    var expected = [null, null];
    function scroller(f) { try { return f.contentDocument && (f.contentDocument.scrollingElement || f.contentDocument.documentElement); } catch (err) { return null; } }
    function link(i) {
      var src = frames[i], j = 1 - i, dst = frames[j], w;
      try { w = src.contentWindow; } catch (err) { return; } if (!w) return;
      try { src.contentDocument.documentElement.style.scrollBehavior = 'auto'; } catch (err) {}
      w.addEventListener('scroll', function () {
        var s = scroller(src), d = scroller(dst); if (!s || !d) return;
        if (expected[i] !== null && Math.abs(s.scrollTop - expected[i]) < 3) { expected[i] = null; return; }
        expected[i] = null;
        var max = s.scrollHeight - s.clientHeight, dmax = d.scrollHeight - d.clientHeight;
        var target = Math.round((max > 0 ? s.scrollTop / max : 0) * dmax);
        if (Math.abs(d.scrollTop - target) < 2) return;
        expected[j] = target; d.scrollTop = target;
      }, { passive: true });
    }
    /* only one welcome message plays at a time */
    function audioGuard(f, other) {
      try {
        f.contentDocument.addEventListener('play', function () {
          try { Array.prototype.forEach.call(other.contentDocument.querySelectorAll('audio, video'), function (m) { m.pause(); }); } catch (err) {}
        }, true);
      } catch (err) {}
    }
    /* inside the comparison, anything that leaves the page opens in a new tab,
       so the 3D studio and outside links never take over a frame */
    function keepHome(f) {
      var doc = f.contentDocument, win = f.contentWindow, here = win.location.href.split('#')[0];
      win.addEventListener('pagehide', function () { if (resetting) return; var i = frames.indexOf(f); ok[i] = false; box.classList.remove('is-ready'); back.hidden = false; });
      doc.addEventListener('click', function (e) {
        var launch = e.target.closest && e.target.closest('#launch');
        if (launch) { e.preventDefault(); e.stopImmediatePropagation(); window.open('https://earthwisegrounding.github.io/verdura/prolawn/b/designer.html', '_blank', 'noopener'); return; }
        var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
        var href = a.getAttribute('href'); if (!href || href.charAt(0) === '#') return;
        var url; try { url = new URL(href, win.location.href); } catch (err) { return; }
        if (url.protocol === 'mailto:' || url.protocol === 'tel:') { e.preventDefault(); window.location.href = url.href; return; }
        if (url.href.split('#')[0] === here) return;          // same page, just a jump
        e.preventDefault(); e.stopImmediatePropagation(); window.open(url.href, '_blank', 'noopener');
      }, true);
      doc.addEventListener('submit', function (e) { var t = e.target; if (t && t.getAttribute('action') && !/^#/.test(t.getAttribute('action'))) t.setAttribute('target', '_blank'); }, true);
    }

    /* safety net: if a frame ends up anywhere else, offer a way back */
    var back = document.createElement('button');
    back.type = 'button'; back.className = 'cmp-back btn btn-primary'; back.hidden = true;
    back.textContent = 'Back to the comparison';
    box.appendChild(back);
    var resetting = false;
    function reset() {
      resetting = true; back.hidden = true; box.classList.remove('is-ready'); ok = [false, false];
      frames.forEach(function (f) { f.setAttribute('src', f.getAttribute('data-src') + '?r=' + Date.now()); });
    }
    back.addEventListener('click', reset);

    var ok = [false, false];
    frames.forEach(function (f, i) {
      f.addEventListener('load', function () {
        if (!f.getAttribute('src')) return;
        var home = false;
        try { home = f.contentWindow.location.pathname.replace(/index\.html$/, '') === new URL(f.getAttribute('data-src'), location.href).pathname; } catch (err) { home = false; }
        if (!home) { ok[i] = false; back.hidden = false; return; }
        ok[i] = true; keepHome(f); link(i); audioGuard(f, frames[1 - i]);
        if (ok[0] && ok[1]) {
          resetting = false; box.classList.add('is-ready');
          var s = scroller(frames[0]), d = scroller(frames[1]);                     // line the two up again
          if (s && d) { var max = s.scrollHeight - s.clientHeight; expected[1] = Math.round((max > 0 ? s.scrollTop / max : 0) * (d.scrollHeight - d.clientHeight)); d.scrollTop = expected[1]; }
        }
      });
    });

    /* load both live sites only when the section is near */
    function start() { frames.forEach(function (f) { if (!f.getAttribute('src')) f.setAttribute('src', f.getAttribute('data-src')); }); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { start(); io.disconnect(); } }, { rootMargin: '600px 0px' });
      io.observe(box);
    } else start();
    setX(50);
  })();

  /* ---------- Free CRM: industry chips rename the sample pipeline ---------- */
  (function () {
    var chips = document.querySelector('[data-crm-chips]'), board = document.querySelector('[data-crm-board]'), title = document.querySelector('[data-crm-title]');
    if (!chips || !board) return;
    var COLORS = ['#7C9BD6', '#3D74C9', '#1553A8', '#12805A'];
    // [stage, [[job, who, detail], ...]] x 4
    var DEMO = {
      trades: ['Plumbing & HVAC', [['New call', [['Water heater leak', 'Dana K.', 'Today'], ['No heat upstairs', 'Mike R.', '2h ago']]], ['Quote sent', [['Bathroom repipe', 'Erin S.', '$3,200']]], ['Job booked', [['AC tune-up', 'Tom W.', 'Thu 9 am']]], ['Paid', [['Drain clearing', 'Ana P.', '$225']]]]],
      salon: ['Salons & spas', [['New client', [['Color consult', 'Jess M.', 'Today'], ['Bridal trial', 'Nora L.', 'Sat']]], ['Booked', [['Cut and gloss', 'Leah T.', 'Fri 2 pm']]], ['Visited', [['Balayage', 'Maya R.', '$240']]], ['Rebook due', [['Root touch-up', 'Kim D.', 'In 6 wks']]]]],
      food: ['Restaurants & catering', [['Catering inquiry', [['Office lunch for 40', 'Brightline Co.', '$820'], ['Rehearsal dinner', 'Sara & Ben', 'Jun 14']]], ['Menu sent', [['Birthday party for 25', 'Luis G.', '$560']]], ['Confirmed', [['Team breakfast', 'Northwind', 'Tue 8 am']]], ['Follow up', [['Holiday party', 'Cedar Dental', 'Ask for a review']]]]],
      landscape: ['Landscaping', [['Estimate request', [['Spring cleanup', 'Rob H.', 'Today'], ['Paver patio', 'Lena K.', '1d ago']]], ['Site visit', [['Drainage fix', 'Carl M.', 'Wed 10 am']]], ['Proposal sent', [['Backyard redesign', 'Priya S.', '$6,200']]], ['Seasonal care', [['Weekly mowing', 'Oak St. HOA', '$45/visit']]]]],
      dental: ['Dental & medical', [['New patient', [['Cleaning and exam', 'Grace W.', 'Today'], ['Whitening consult', 'Omar F.', '3h ago']]], ['Appointment set', [['Crown fitting', 'Dale P.', 'Mon 11 am']]], ['Visited', [['Implant consult', 'Rita B.', 'Plan sent']]], ['Recall due', [['6-month checkup', 'Sam Y.', 'Nov 3']]]]],
      fitness: ['Gyms & fitness', [['Trial booked', [['Free week pass', 'Alex J.', 'Today'], ['Intro PT session', 'Mei C.', 'Sat']]], ['Trial done', [['Follow-up call', 'Chris V.', 'Due today']]], ['Member', [['Annual plan', 'Tara N.', '$89/mo']]], ['Renewal due', [['Membership renewal', 'Jordan P.', 'Dec 1']]]]]
    };
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function render(key) {
      var d = DEMO[key], n = 0, frag = document.createDocumentFragment();
      d[1].forEach(function (stage, i) {
        var col = el('div', 'crm-col'), head = el('p', 'crm-col-title', stage[0]);
        col.style.setProperty('--c', COLORS[i]);
        head.appendChild(el('span', null, String(stage[1].length)));
        col.appendChild(head);
        stage[1].forEach(function (c) {
          var card = el('div', 'crm-card'), meta = el('span');
          card.style.setProperty('--d', n++);
          meta.appendChild(el('i', null, c[1])); meta.appendChild(el('em', null, c[2]));
          card.appendChild(el('b', null, c[0])); card.appendChild(meta);
          col.appendChild(card);
        });
        frag.appendChild(col);
      });
      board.innerHTML = '';
      board.appendChild(frag);
      title.textContent = 'Your CRM \u00b7 ' + d[0];
    }
    chips.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-industry]');
      if (!btn || btn.getAttribute('aria-pressed') === 'true') return;
      Array.prototype.forEach.call(chips.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      if (reduceMotion) { render(btn.getAttribute('data-industry')); return; }
      board.classList.add('is-swapping');
      setTimeout(function () { render(btn.getAttribute('data-industry')); board.classList.remove('is-swapping'); }, 180);
    });
  })();

  /* ---------- Order: the $499 website (1 year of hosting, domain, SSL, 5 emails, local SEO, QR codes, audio welcome, and CRM included), paid through Square ----------
     The worker prices the order (api/worker.js CATALOG) and returns a Square payment link for it. */
  (function () {
    var form = document.querySelector('[data-checkout]'); if (!form) return;
    var API = 'https://digital-doorway-mail.angie-tatum-api.workers.dev';
    var lines = document.querySelector('[data-co-lines]'), total = document.querySelector('[data-co-total]');
    var renew = document.querySelector('[data-co-renew]'), pay = document.querySelector('[data-co-pay]'), err = document.querySelector('[data-co-error]');
    var inEmail = document.getElementById('co-email');
    function selected() { return ['build']; }
    function render() {
      lines.innerHTML = '';
      [['Website design and build', '$499.00'], ['7 services for 12 months', 'Included'], ['Customized CRM for 12 months', 'Free']].forEach(function (row) {
        var li = document.createElement('li'), n = document.createElement('span'), v = document.createElement('b');
        n.textContent = row[0]; v.textContent = row[1]; li.appendChild(n); li.appendChild(v); lines.appendChild(li);
      });
      total.textContent = '$499.00';
      renew.textContent = 'No monthly fees for your first 12 months. After that, the optional Business Bundle keeps everything running, CRM included, for $49.95 a month.';
      renew.hidden = false;
    }

    pay.addEventListener('click', function () {
      err.hidden = true;
      var email = (inEmail.value || '').trim(), field = inEmail.closest('.field');
      var emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      field.classList.toggle('has-error', !emailOk);
      if (!emailOk) { err.textContent = 'That email doesn’t look right. Fix it or leave it blank; Square will ask for it.'; err.hidden = false; return; }
      pay.setAttribute('aria-busy', 'true');
      var label = pay.firstChild.textContent; pay.firstChild.textContent = 'Opening secure checkout… ';
      fetch(API + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: selected(), email: email }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.url) throw new Error(d.detail || d.error || 'failed'); return d; }); })
        .then(function (d) { window.location.href = d.url; })
        .catch(function () {
          pay.removeAttribute('aria-busy'); pay.firstChild.textContent = label;
          err.innerHTML = '';
          err.appendChild(document.createTextNode('We couldn’t open checkout just now. Please try again in a moment, or call (877) 853-1920.'));
          err.hidden = false;
        });
    });
    render();
  })();

  /* ---------- Domain search: live registry lookup through the worker; an open name can go straight into the services order ---------- */
  (function () {
    var form = document.querySelector('[data-domain-search]'); if (!form) return;
    var API = 'https://digital-doorway-mail.angie-tatum-api.workers.dev';
    var input = document.getElementById('ds-q'), list = document.querySelector('[data-ds-results]'), status = document.querySelector('[data-ds-status]');
    var LABEL = { available: 'Available', taken: 'Taken', unknown: 'Ask us' };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) { input.focus(); return; }
      status.textContent = 'Checking…'; list.innerHTML = '';
      fetch(API + '/domain-check?q=' + encodeURIComponent(q))
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) { var er = new Error(d.error || 'failed'); er.shown = !!d.error; throw er; } return d; }); })
        .then(function (d) {
          var open = d.results.filter(function (x) { return x.status === 'available'; }).length;
          status.textContent = open ? open + (open === 1 ? ' name is' : ' names are') + ' open.' : 'Those are taken. Try a variation, like adding your city.';
          d.results.forEach(function (x) {
            var li = document.createElement('li'), name = document.createElement('span'), tag = document.createElement('b');
            li.className = 'ds-row is-' + x.status;
            name.className = 'ds-name'; name.textContent = x.domain;
            tag.className = 'ds-tag'; tag.textContent = LABEL[x.status];
            li.appendChild(name); li.appendChild(tag);
            if (x.status === 'available') {
              var add = document.createElement('button');
              add.type = 'button'; add.className = 'btn btn-ghost ds-add'; add.textContent = 'Add to my order';
              add.addEventListener('click', function () { document.dispatchEvent(new CustomEvent('ddm:domain', { detail: x.domain })); });
              li.appendChild(add);
            } else if (x.status === 'unknown') {
              var a = document.createElement('a'); a.className = 'link-hand ds-ask'; a.href = '#contact'; a.textContent = 'We’ll check this one';
              li.appendChild(a);
            }
            list.appendChild(li);
          });
        })
        .catch(function (err) { status.textContent = err.shown ? err.message : 'We couldn’t check right now. Please try again in a moment.'; });
    });
  })();

  /* ---------- Buy services individually: pick services (or the bundle), pay the first month or year through Square ----------
     Display prices only; the worker (api/worker.js CATALOG) sets what is charged. */
  (function () {
    var form = document.querySelector('[data-services-checkout]'); if (!form) return;
    var API = 'https://digital-doorway-mail.angie-tatum-api.workers.dev';
    var P = {
      bundle: ['Business Bundle', 4995, 'month'], hosting: ['Website hosting', 1495, 'month'], domain: ['Domain name registration', 995, 'year'],
      ssl: ['SSL security certificate', 595, 'month'], email5: ['5 professional email addresses', 5900, 'year'], seo: ['Local SEO', 1995, 'month'],
      qr: ['QR code generation', 595, 'month'], audio: ['Professional audio welcome message', 995, 'month'], crm: ['Customized CRM', 3495, 'month']
    };
    var boxes = Array.prototype.slice.call(form.querySelectorAll('input[name="sv"]'));
    var bundle = form.querySelector('input[value="bundle"]');
    var lines = document.querySelector('[data-sv-lines]'), total = document.querySelector('[data-sv-total]'), renew = document.querySelector('[data-sv-renew]');
    var pay = document.querySelector('[data-sv-pay]'), err = document.querySelector('[data-sv-error]'), inEmail = document.getElementById('sv-email');
    function usd(c) { return '$' + (c / 100).toFixed(2); }
    function selected() { return bundle.checked ? ['bundle'] : boxes.filter(function (b) { return b.checked && b !== bundle; }).map(function (b) { return b.value; }); }
    var domainName = '';
    document.addEventListener('ddm:domain', function (e) {
      domainName = e.detail;
      var box = form.querySelector('input[value="domain"]');
      if (!bundle.checked) box.checked = true;
      render();
      document.getElementById('buy-services').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
    function render() {
      form.classList.toggle('is-bundled', bundle.checked);
      boxes.forEach(function (b) { if (b !== bundle) b.disabled = bundle.checked; });
      var keys = selected(), sum = 0, mo = 0, yr = 0;
      lines.innerHTML = '';
      keys.forEach(function (k) {
        var it = P[k], li = document.createElement('li'), n = document.createElement('span'), v = document.createElement('b');
        n.textContent = it[0] + ((k === 'domain' || k === 'bundle') && domainName ? ' (' + domainName + ')' : ''); v.textContent = usd(it[1]) + (it[2] === 'month' ? '/mo' : '/yr');
        li.appendChild(n); li.appendChild(v); lines.appendChild(li);
        sum += it[1]; if (it[2] === 'month') mo += it[1]; else yr += it[1];
      });
      if (!keys.length) { var li = document.createElement('li'); li.textContent = 'Pick a service to get started.'; lines.appendChild(li); }
      total.textContent = usd(sum);
      var parts = [];
      if (mo) parts.push(usd(mo) + ' a month');
      if (yr) parts.push(usd(yr) + ' a year');
      renew.textContent = parts.length ? 'Today covers the first ' + (mo && yr ? 'month and year' : mo ? 'month' : 'year') + '. After that, ' + parts.join(' plus ') + '. We’ll confirm each renewal with you before it’s due.' : '';
      renew.hidden = !parts.length;
      pay.disabled = !keys.length;
    }
    form.addEventListener('change', render);
    pay.addEventListener('click', function () {
      err.hidden = true;
      var email = (inEmail.value || '').trim(), field = inEmail.closest('.field');
      var ok = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      field.classList.toggle('has-error', !ok);
      if (!ok) { err.textContent = 'That email doesn’t look right. Fix it or leave it blank; Square will ask for it.'; err.hidden = false; return; }
      pay.setAttribute('aria-busy', 'true');
      var label = pay.firstChild.textContent; pay.firstChild.textContent = 'Opening secure checkout… ';
      fetch(API + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: selected(), build: false, email: email, domain: domainName }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.url) throw new Error(d.detail || d.error || 'failed'); return d; }); })
        .then(function (d) { window.location.href = d.url; })
        .catch(function () {
          pay.removeAttribute('aria-busy'); pay.firstChild.textContent = label;
          err.textContent = 'We couldn’t open checkout just now. Please try again in a moment, or call (877) 853-1920.';
          err.hidden = false;
        });
    });
    render();
  })();
})();
