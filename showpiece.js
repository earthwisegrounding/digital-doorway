/* ==========================================================================
   Showpiece: a scroll-driven 3D doorway (Three.js r128).
   Scroll pins the section; progress drives the camera through an open door
   into a lit interior where sample sites drift past and settle into a gallery.
   Falls back to a single static frame under prefers-reduced-motion, and to a
   plain gradient if WebGL is unavailable.
   ========================================================================== */
(function () {
  'use strict';

  var section = document.getElementById('showcase');
  if (!section) return;
  var stage = section.querySelector('.showpiece-stage');
  var canvas = section.querySelector('.showpiece-canvas');
  var steps = Array.prototype.slice.call(section.querySelectorAll('.sp-step'));
  var bar = section.querySelector('.sp-progress i');
  var hint = section.querySelector('.sp-hint');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(hover: none)').matches;

  function setStatic() { section.classList.add('is-static'); }

  if (!window.THREE) { setStatic(); return; }
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (err) { setStatic(); return; }

  /* ---------- helpers ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return Math.min(1, Math.max(0, x)); }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function easeInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function luma(hex) { var n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

  /* ---------- the sample sites painted onto the panels: eight different layouts ---------- */
  var SERIF = '"Fraunces", "Iowan Old Style", Georgia, serif';
  var SANS = '"Inter Tight", "Inter", system-ui, sans-serif';
  var PANEL_COUNT = 8;

  function rr(g, x, y, w, h, r, fill) { roundRect(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); }
  function txt(g, s, x, y, font, color, align) { g.font = font; g.fillStyle = color; g.textAlign = align || 'left'; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); g.textAlign = 'left'; }
  function pill(g, x, y, w, h, fill, label, color, size) { rr(g, x, y, w, h, h / 2, fill); txt(g, label, x + w / 2, y + h / 2 + size * .36, '600 ' + size + 'px ' + SANS, color, 'center'); }
  function dot(g, x, y, r, fill) { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function croissant(g, cx, baseY, w, rot) {
    g.save(); g.translate(cx, baseY); g.rotate(rot);
    g.beginPath(); g.ellipse(0, 0, w / 2, w * .34, 0, Math.PI, Math.PI * 2); g.closePath();
    g.fillStyle = '#E8B96A'; g.fill(); g.strokeStyle = '#B9884A'; g.lineWidth = 2; g.stroke();
    g.beginPath(); [-.5, 0, .5].forEach(function (k) { g.moveTo(k * w * .6, -2); g.lineTo(k * w * .42, -w * .28); }); g.strokeStyle = 'rgba(185,136,74,.7)'; g.lineWidth = 1.6; g.stroke();
    g.restore();
  }
  function tooth(g, cx, cy) {
    rr(g, cx - 40, cy + 18, 30, 40, 14, '#fff'); rr(g, cx + 10, cy + 18, 30, 40, 14, '#fff');
    rr(g, cx - 46, cy - 60, 92, 96, 40, '#fff');
    [[cx - 17, cy - 18], [cx + 17, cy - 18]].forEach(function (p) { dot(g, p[0], p[1], 5, '#1E6B5E'); });
    g.strokeStyle = '#1E6B5E'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy - 8, 18, Math.PI * .15, Math.PI * .85); g.stroke();
    g.fillStyle = '#F5BFB0'; [[cx - 30, cy - 4], [cx + 30, cy - 4]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 7, 4, 0, 0, Math.PI * 2); g.fill(); });
  }

  var PAINTERS = [
    // Marigold: awning, sunrise, pastries, centered serif
    function (g) {
      g.fillStyle = '#FBE7A1'; g.fillRect(0, 0, 512, 640);
      for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#FDFAF3' : '#C4552D'; g.fillRect(i * 64, 0, 64, 26); g.beginPath(); g.arc(i * 64 + 32, 26, 32, 0, Math.PI); g.fill(); }
      txt(g, 'Marigold', 256, 100, '600 34px ' + SERIF, '#4A2C17', 'center');
      txt(g, 'MENU   ·   VISIT   ·   ORDER', 256, 126, '600 12px ' + SANS, 'rgba(74,44,23,.7)', 'center');
      var sun = g.createRadialGradient(256, 330, 10, 256, 330, 130); sun.addColorStop(0, '#FFE28A'); sun.addColorStop(1, '#F6BE45');
      g.fillStyle = sun; g.beginPath(); g.arc(256, 330, 118, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4A2C17'; g.fillRect(0, 392, 512, 14);
      croissant(g, 150, 392, 96, -.15); croissant(g, 256, 394, 112, 0); croissant(g, 362, 392, 96, .15);
      txt(g, 'Fresh at 6 a.m.', 256, 488, '600 56px ' + SERIF, '#4A2C17', 'center');
      txt(g, 'Sourdough, croissants, and cinnamon rolls worth the drive.', 256, 520, '400 15px ' + SANS, 'rgba(74,44,23,.8)', 'center');
      pill(g, 166, 542, 180, 46, '#4A2C17', 'Order a box', '#FBE7A1', 17);
      g.fillStyle = '#4A2C17'; g.fillRect(0, 606, 512, 34);
      txt(g, 'TUE–SUN', 36, 628, '600 12px ' + SANS, '#FBE7A1'); txt(g, '6 A.M. – 2 P.M.', 256, 628, '600 12px ' + SANS, '#FBE7A1', 'center'); txt(g, 'OAK & 5TH', 476, 628, '600 12px ' + SANS, '#FBE7A1', 'right');
    },
    // Hartline: navy, red band, giant phone number, badge row, service tiles
    function (g) {
      g.fillStyle = '#12304B'; g.fillRect(0, 0, 512, 640);
      txt(g, 'Hartline', 36, 52, '700 28px ' + SANS, '#fff'); txt(g, 'PLUMBING', 152, 52, '500 12px ' + SANS, 'rgba(255,255,255,.7)');
      pill(g, 376, 26, 100, 38, '#D7412F', 'Call now', '#fff', 15);
      g.fillStyle = '#D7412F'; g.beginPath(); g.moveTo(0, 126); g.lineTo(512, 98); g.lineTo(512, 250); g.lineTo(0, 278); g.closePath(); g.fill();
      txt(g, 'Same-day repairs.', 36, 186, '700 42px ' + SANS, '#fff'); txt(g, 'Honest quotes.', 36, 236, '700 42px ' + SANS, '#fff');
      txt(g, '(555) 200-0148', 36, 352, '700 44px ' + SANS, '#fff');
      txt(g, 'Leaks, heaters, drains, and today’s emergency.', 36, 384, '400 15px ' + SANS, '#C3D2DF');
      ['Licensed', 'Insured', '24/7'].forEach(function (s, i) { var x = 36 + i * 112; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; roundRect(g, x, 404, 100, 34, 17); g.stroke(); txt(g, s, x + 50, 426, '600 14px ' + SANS, '#fff', 'center'); });
      ['Water heaters', 'Drains', 'Leak repair'].forEach(function (s, i) { var x = 36 + i * 150; rr(g, x, 470, 140, 130, 14, '#EEF3F7'); dot(g, x + 32, 506, 18, '#12304B'); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x + 32, 506, 7, 0, Math.PI * 2); g.stroke(); txt(g, s, x + 14, 576, '600 15px ' + SANS, '#12304B'); });
    },
    // Bright Row: centered mascot, headline, booking calendar card
    function (g) {
      g.fillStyle = '#DDF2EC'; g.fillRect(0, 0, 512, 640);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(48, 44, 10, 12, 0, 0, Math.PI * 2); g.fill();
      txt(g, 'Bright Row', 66, 52, '600 24px ' + SANS, '#1E6B5E');
      txt(g, 'Services    Team    Book', 476, 51, '500 14px ' + SANS, '#1E6B5E', 'right');
      dot(g, 256, 190, 96, '#BFE7DA'); tooth(g, 256, 190);
      txt(g, '✦', 344, 120, '30px ' + SANS, '#E0A526', 'center');
      txt(g, 'Gentle care for', 256, 340, '600 40px ' + SANS, '#1E6B5E', 'center'); txt(g, 'the whole family', 256, 384, '600 40px ' + SANS, '#1E6B5E', 'center');
      txt(g, 'New patients welcome. Evening hours on Tuesdays.', 256, 412, '400 14px ' + SANS, '#2E7E70', 'center');
      rr(g, 48, 440, 416, 178, 18, '#fff');
      txt(g, 'Book a visit', 72, 474, '600 16px ' + SANS, '#1E6B5E'); txt(g, 'October', 440, 474, '600 16px ' + SANS, '#1E6B5E', 'right');
      ['M', 'T', 'W', 'T', 'F', 'S', 'S', '6', '7', '8', '9', '10', '11', '12'].forEach(function (d, i) {
        var c = i % 7, r = Math.floor(i / 7), x = 72 + c * 54, y = 500 + r * 34;
        if (i === 9) rr(g, x, y - 2, 40, 28, 8, '#1E6B5E');
        txt(g, d, x + 20, y + 17, (r ? '500' : '600') + ' 13px ' + SANS, i === 9 ? '#fff' : r ? '#1E6B5E' : 'rgba(30,107,94,.55)', 'center');
      });
      pill(g, 72, 570, 150, 36, '#1E6B5E', 'Request 8 a.m.', '#fff', 14);
    },
    // Studio Ash: dark editorial, huge stacked serif, round book button, gallery tiles
    function (g) {
      g.fillStyle = '#151313'; g.fillRect(0, 0, 512, 640);
      txt(g, 'S T U D I O   A S H', 36, 48, '400 15px ' + SERIF, '#E9C9C1');
      txt(g, 'Services    Stylists', 476, 48, '500 13px ' + SANS, 'rgba(233,201,193,.8)', 'right');
      g.fillStyle = 'rgba(233,201,193,.25)'; g.fillRect(36, 66, 440, 1);
      g.strokeStyle = 'rgba(233,201,193,.3)'; g.lineWidth = 1.2; g.lineCap = 'round';
      [0, 34, 68, 102].forEach(function (o) { g.beginPath(); g.moveTo(-20, 150 + o); g.bezierCurveTo(140, 90 + o, 200, 330 + o, 330, 250 + o); g.bezierCurveTo(420, 200 + o, 480, 260 + o, 540, 230 + o); g.stroke(); });
      txt(g, 'Cut.', 36, 200, '400 96px ' + SERIF, '#E9C9C1'); txt(g, 'Color.', 70, 292, 'italic 400 96px ' + SERIF, '#F3DED8'); txt(g, 'Calm.', 36, 384, '400 96px ' + SERIF, '#E9C9C1');
      dot(g, 430, 330, 44, '#E9C9C1'); txt(g, 'BOOK', 430, 336, '600 15px ' + SANS, '#151313', 'center');
      [['#8C6A60', '#241C1C', 'BALAYAGE'], ['#F0D7CF', '#6E4E46', 'BLUNT BOB'], ['#6B4A52', '#1A1416', 'CURLS']].forEach(function (t, i) {
        var x = 36 + i * 150, gr = g.createLinearGradient(x, 430, x + 140, 600); gr.addColorStop(0, t[0]); gr.addColorStop(1, t[1]);
        roundRect(g, x, 430, 140, 170, 10); g.fillStyle = gr; g.fill(); txt(g, t[2], x + 12, 588, '600 11px ' + SANS, '#F3DED8');
      });
    },
    // Corner Cup: tan band, chalkboard with chalk cup, hours, dotted menu
    function (g) {
      g.fillStyle = '#FBF5EA'; g.fillRect(0, 0, 512, 640);
      g.fillStyle = '#C9A77C'; g.fillRect(0, 0, 512, 78);
      txt(g, 'Corner Cup', 36, 50, 'italic 600 30px ' + SERIF, '#2C1E12'); txt(g, 'Menu    Find us', 476, 48, '500 14px ' + SANS, '#2C1E12', 'right');
      rr(g, 28, 96, 456, 220, 14, '#A67C52'); rr(g, 36, 104, 440, 204, 10, '#2C1E12');
      g.strokeStyle = '#F3E9D8'; g.lineWidth = 3; g.lineCap = 'round'; roundRect(g, 66, 170, 90, 74, 14); g.stroke();
      g.beginPath(); g.ellipse(111, 170, 45, 12, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(156, 200, 20, -Math.PI / 2, Math.PI / 2); g.stroke();
      g.lineWidth = 2; [[95, 150], [111, 142], [127, 150]].forEach(function (p) { g.beginPath(); g.moveTo(p[0], p[1]); g.bezierCurveTo(p[0] - 8, p[1] - 14, p[0] + 8, p[1] - 22, p[0], p[1] - 34); g.stroke(); });
      txt(g, 'Good coffee,', 190, 178, 'italic 600 40px ' + SERIF, '#F8F0E1'); txt(g, 'no fuss.', 190, 224, 'italic 600 40px ' + SERIF, '#F8F0E1');
      txt(g, 'Open at 7. Pastries from Marigold next door.', 190, 262, '400 14px ' + SANS, '#D9C6A8');
      txt(g, 'Mon–Fri   7 – 4', 36, 356, '600 15px ' + SANS, '#3A2B1E'); txt(g, 'Sat–Sun   8 – 2', 36, 380, '600 15px ' + SANS, '#3A2B1E'); txt(g, '●  12 Corner St.', 476, 356, '600 15px ' + SANS, '#3A2B1E', 'right');
      [['Drip', '12 oz'], ['Latte', '12 oz'], ['Cortado', '4 oz'], ['Cold brew', '16 oz']].forEach(function (m, i) {
        var y = 430 + i * 34; txt(g, m[0], 36, y, '500 17px ' + SANS, '#3A2B1E'); var w = g.measureText(m[0]).width;
        txt(g, m[1], 476, y, '500 15px ' + SANS, 'rgba(58,43,30,.7)', 'right');
        g.strokeStyle = 'rgba(58,43,30,.35)'; g.setLineDash([2, 5]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(36 + w + 14, y - 4); g.lineTo(410, y - 4); g.stroke(); g.setLineDash([]);
      });
      g.fillStyle = '#3A2B1E'; g.fillRect(0, 582, 512, 58); txt(g, 'Skip the line tomorrow', 36, 617, '500 15px ' + SANS, '#FBF5EA'); pill(g, 344, 594, 132, 34, '#C9A77C', 'Order ahead', '#2C1E12', 14);
    },
    // Greenway: deep green with leaf shapes, serif headline, service icons, review
    function (g) {
      g.fillStyle = '#F4F1E6'; g.fillRect(0, 0, 512, 640);
      var hero = g.createLinearGradient(0, 0, 512, 330); hero.addColorStop(0, '#1F3D2B'); hero.addColorStop(.7, '#2E5B3E'); hero.addColorStop(1, '#3C7A46'); g.fillStyle = hero; g.fillRect(0, 0, 512, 330);
      [[40, 300, -.6, '#3C8A3E', .55, 190], [200, 330, -.35, '#4F9A47', .4, 210], [400, 320, -.9, '#8CCB6F', .3, 170], [-40, 150, -.1, '#2E6B34', .5, 230]].forEach(function (l) {
        g.save(); g.translate(l[0], l[1]); g.rotate(l[2]); g.globalAlpha = l[4]; g.fillStyle = l[3];
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l[5] * .5, -l[5] * .34, l[5], 0); g.quadraticCurveTo(l[5] * .5, l[5] * .34, 0, 0); g.fill();
        g.strokeStyle = 'rgba(246,239,227,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, 0); g.lineTo(l[5] - 8, 0); g.stroke(); g.restore();
      });
      g.globalAlpha = 1;
      txt(g, '☘  Greenway', 36, 50, '700 24px ' + SANS, '#F6EFE3'); pill(g, 362, 26, 114, 36, '#E0A526', 'Free estimate', '#1F1A14', 13);
      txt(g, 'DESIGN  ·  INSTALL  ·  WEEKLY CARE', 36, 150, '600 12px ' + SANS, '#F0C75E');
      txt(g, 'Lawns, patios, and', 36, 204, '600 42px ' + SERIF, '#F6EFE3'); txt(g, 'gardens, done properly.', 36, 252, '600 42px ' + SERIF, '#F6EFE3');
      pill(g, 36, 276, 196, 40, '#E0A526', 'Book a free estimate', '#1F1A14', 14);
      [['Lawn care', function (x, y) { g.beginPath(); g.moveTo(x - 10, y + 8); g.lineTo(x + 10, y + 8); g.moveTo(x - 6, y + 8); g.lineTo(x - 6, y - 4); g.moveTo(x, y + 8); g.lineTo(x, y - 9); g.moveTo(x + 6, y + 8); g.lineTo(x + 6, y - 3); g.stroke(); }],
       ['Patios & paths', function (x, y) { g.strokeRect(x - 9, y - 9, 18, 18); g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.stroke(); }],
       ['Planting', function (x, y) { g.beginPath(); g.moveTo(x - 9, y + 9); g.quadraticCurveTo(x - 9, y - 9, x + 9, y - 9); g.quadraticCurveTo(x + 9, y + 9, x - 9, y + 9); g.moveTo(x - 9, y + 9); g.lineTo(x + 3, y - 3); g.stroke(); }]
      ].forEach(function (s, i) { var x = 36 + i * 150; dot(g, x + 22, 378, 22, '#E3EDDC'); g.strokeStyle = '#2E5B3E'; g.lineWidth = 2.2; g.lineCap = 'round'; s[1](x + 22, 378); txt(g, s[0], x + 52, 384, '600 14px ' + SANS, '#1F2A20'); });
      rr(g, 36, 424, 440, 128, 14, '#fff'); g.fillStyle = '#E0A526'; g.fillRect(36, 424, 6, 128);
      txt(g, '★★★★★', 62, 456, '16px ' + SANS, '#E0A526');
      txt(g, '“They turned a mud patch into the', 62, 490, 'italic 500 20px ' + SERIF, '#1F2A20'); txt(g, 'best yard on the street.”', 62, 516, 'italic 500 20px ' + SERIF, '#1F2A20');
      txt(g, 'Dana K., Elm Street', 62, 540, '500 13px ' + SANS, '#4B5A4E');
      g.fillStyle = '#1F3D2B'; g.fillRect(0, 572, 512, 68);
      [['12', 'years'], ['300+', 'yards'], ['4.9★', 'rating']].forEach(function (s, i) { var x = 96 + i * 160; txt(g, s[0], x, 606, '600 26px ' + SERIF, '#F0C75E', 'center'); txt(g, s[1], x, 628, '500 12px ' + SANS, '#F6EFE3', 'center'); });
    },
    // Northside: black, diagonal stripes, condensed shouting type, stats, schedule
    function (g) {
      g.fillStyle = '#1F1A14'; g.fillRect(0, 0, 512, 640);
      g.fillStyle = '#E0A526'; [0, 56, 112].forEach(function (o) { g.beginPath(); g.moveTo(330 + o, 0); g.lineTo(366 + o, 0); g.lineTo(196 + o, 250); g.lineTo(160 + o, 250); g.closePath(); g.fill(); });
      txt(g, 'NORTHSIDE', 36, 52, '700 22px ' + SANS, '#F6EFE3'); pill(g, 406, 26, 70, 36, '#E0A526', 'Join', '#1F1A14', 15);
      txt(g, 'SHOW UP.', 36, 232, '700 70px ' + SANS, '#F6EFE3'); txt(g, 'WE DO', 36, 302, '700 70px ' + SANS, '#E0A526'); txt(g, 'THE REST.', 36, 372, '700 70px ' + SANS, '#E0A526');
      [['5AM', 'doors open'], ['40+', 'classes a week'], ['No', 'contract']].forEach(function (s, i) { var x = 36 + i * 150; txt(g, s[0], x, 440, '700 34px ' + SANS, '#F6EFE3'); txt(g, s[1].toUpperCase(), x, 462, '600 11px ' + SANS, 'rgba(246,239,227,.6)'); });
      [['6:00', 'Strength'], ['7:00', 'Spin'], ['18:30', 'Boxing']].forEach(function (r, i) { var y = 506 + i * 42; g.fillStyle = 'rgba(246,239,227,.12)'; g.fillRect(36, y - 26, 440, 1); txt(g, r[0], 36, y, '600 15px ' + SANS, '#E0A526'); txt(g, r[1], 110, y, '500 16px ' + SANS, '#F6EFE3'); pill(g, 416, y - 18, 60, 26, 'rgba(246,239,227,.15)', 'Book', '#F6EFE3', 11); });
    },
    // Elm & Ink: ruled paper, centered italic serif, a shelf of book spines, events
    function (g) {
      g.fillStyle = '#F1E6D6'; g.fillRect(0, 0, 512, 640);
      g.strokeStyle = 'rgba(42,33,26,.08)'; g.lineWidth = 1; for (var y = 40; y < 640; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
      g.fillStyle = '#2A211A'; g.fillRect(140, 62, 66, 1); g.fillRect(306, 62, 66, 1);
      txt(g, 'Elm & Ink', 256, 72, '600 34px ' + SERIF, '#2A211A', 'center');
      txt(g, 'BOOKSHOP   ·   EST. 1984', 256, 96, '600 11px ' + SANS, 'rgba(42,33,26,.6)', 'center');
      txt(g, 'Open late', 256, 182, 'italic 600 54px ' + SERIF, '#2A211A', 'center'); txt(g, 'on Fridays.', 256, 240, 'italic 600 54px ' + SERIF, '#2A211A', 'center');
      txt(g, 'Readings at 7, the kettle is on, and nobody minds if you stay.', 256, 274, '400 14px ' + SANS, 'rgba(42,33,26,.75)', 'center');
      var x = 46; ['#2E5B3E', '#C4552D', '#E0A526', '#12304B', '#6B4A52', '#F6EFE3', '#3A2B1E', '#8CCB6F', '#D7412F', '#2A211A'].forEach(function (c, i) {
        var w = 26 + (i * 7) % 22, h = 96 + (i * 13) % 30; rr(g, x, 420 - h, w, h, 3, c); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + w / 2 - 1, 420 - h + 14, 2, h - 28); x += w + 6;
      });
      g.fillStyle = '#3A2B1E'; g.fillRect(36, 420, 440, 8); g.fillStyle = 'rgba(42,33,26,.15)'; g.fillRect(36, 428, 440, 6);
      txt(g, 'THIS WEEK', 36, 474, '600 11px ' + SANS, 'rgba(42,33,26,.6)');
      [['FRI 12', 'Poetry night with the Elm Street Circle'], ['SAT 13', 'Kids’ story hour, 10 a.m.']].forEach(function (e, i) { var y = 506 + i * 40; rr(g, 36, y - 18, 62, 26, 6, '#2E5B3E'); txt(g, e[0], 67, y, '600 11px ' + SANS, '#F6EFE3', 'center'); txt(g, e[1], 112, y, '500 15px ' + SANS, '#2A211A'); });
      pill(g, 36, 586, 200, 40, '#2E5B3E', 'Join the reading club', '#F6EFE3', 14);
    }
  ];

  function paint(i) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 640;
    PAINTERS[i](c.getContext('2d'));
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  /* ---------- scene ---------- */
  var BG = 0x1E1712;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.048);
  var camera = new THREE.PerspectiveCamera(52, 1, 0.1, 90);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5));

  scene.add(new THREE.AmbientLight(0xFFE3B8, 0.25));
  var doorLight = new THREE.PointLight(0xE0A526, 1.0, 18, 1); doorLight.position.set(0, 3.0, -5.5); scene.add(doorLight);
  var farLight = new THREE.PointLight(0xFFE3B8, 1.5, 24, 1); farLight.position.set(0, 3.2, -20); scene.add(farLight);
  var camLight = new THREE.PointLight(0xFFF1DA, 0.15, 10, 1); scene.add(camLight);
  var spot = new THREE.SpotLight(0xFFE3B8, 1.3, 40, 0.42, 0.7, 1); spot.position.set(1.5, 8, 7); spot.target.position.set(0, 1.6, 0); scene.add(spot); scene.add(spot.target);

  // floor
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x2A211A, roughness: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; scene.add(floor);

  // wall with an opening (arched for the procedural door, rectangular once the real door model loads)
  var wallMat = new THREE.MeshStandardMaterial({ color: 0x3B2B21, roughness: .95 });
  function buildWall(rect) {
    var shape = new THREE.Shape();
    shape.moveTo(-16, -1.6); shape.lineTo(16, -1.6); shape.lineTo(16, 10); shape.lineTo(-16, 10); shape.lineTo(-16, -1.6);
    var hole = new THREE.Path();
    if (rect) { hole.moveTo(-rect.w / 2, -1.6); hole.lineTo(-rect.w / 2, -1.6 + rect.h); hole.lineTo(rect.w / 2, -1.6 + rect.h); hole.lineTo(rect.w / 2, -1.6); hole.lineTo(-rect.w / 2, -1.6); }
    else { hole.moveTo(-1.7, -1.6); hole.lineTo(-1.7, 3.2); hole.absarc(0, 3.2, 1.7, Math.PI, 0, true); hole.lineTo(1.7, -1.6); hole.lineTo(-1.7, -1.6); }
    shape.holes.push(hole);
    var m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }), wallMat);
    m.position.z = -0.25; return m;
  }
  var wall = buildWall(null); scene.add(wall);

  // ink-colored arch trim, like the illustration's outline
  var trim = new THREE.Shape();
  trim.moveTo(-2.0, -1.6); trim.lineTo(-2.0, 3.2); trim.absarc(0, 3.2, 2.0, Math.PI, 0, true); trim.lineTo(2.0, -1.6); trim.lineTo(-2.0, -1.6);
  var trimHole = new THREE.Path();
  trimHole.moveTo(-1.7, -1.6); trimHole.lineTo(-1.7, 3.2); trimHole.absarc(0, 3.2, 1.7, Math.PI, 0, true); trimHole.lineTo(1.7, -1.6); trimHole.lineTo(-1.7, -1.6);
  trim.holes.push(trimHole);
  var trimMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(trim, { depth: 0.7, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xEFE4D2, roughness: .85 }));
  trimMesh.position.z = -0.35; scene.add(trimMesh);

  // the door leaf, hinged on the left jamb
  var leafShape = new THREE.Shape();
  leafShape.moveTo(0, -1.58); leafShape.lineTo(0, 3.2); leafShape.absarc(1.64, 3.2, 1.64, Math.PI, 0, true); leafShape.lineTo(3.28, -1.58); leafShape.lineTo(0, -1.58);
  var leafMat = new THREE.MeshStandardMaterial({ color: 0xB84E28, roughness: .92 });
  var leaf = new THREE.Mesh(new THREE.ExtrudeGeometry(leafShape, { depth: 0.14, bevelEnabled: false }), leafMat);
  var pivot = new THREE.Group(); pivot.position.set(-1.64, 0, -0.02); pivot.add(leaf); scene.add(pivot);
  var insetMat = new THREE.MeshStandardMaterial({ color: 0xA8441F, roughness: .8 });
  [[0.86, 2.0], [2.42, 2.0], [0.86, -0.1], [2.42, -0.1]].forEach(function (p) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.55, 0.05), insetMat); m.position.set(p[0], p[1], 0.16); pivot.add(m);
  });
  var knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 18), new THREE.MeshStandardMaterial({ color: 0xE0A526, roughness: .3, metalness: .5 }));
  knob.position.set(2.92, 0.95, 0.24); pivot.add(knob);

  /* ---------- the real door: a photoscanned GLB, split into frame + leaf and hinged on the left ---------- */
  var DOOR_URL = 'assets/door.glb';
  var doorModel = null, leafPivot = null, doorLoading = false, leafPlanes = [], leafLocalPlanes = [], leafMeshRef = null;
  function loadDoorModel() {
    if (doorLoading || doorModel || !THREE.GLTFLoader) return;
    doorLoading = true;
    new THREE.GLTFLoader().load(DOOR_URL, function (gltf) {
      var src = null; gltf.scene.traverse(function (o) { if (o.isMesh && !src) src = o; });
      if (!src) return;
      var geo = src.geometry; geo.computeBoundingBox();
      var bb = geo.boundingBox, size = new THREE.Vector3(); bb.getSize(size);
      var s = 5.0 / size.y;
      var cx0 = (bb.min.x + bb.max.x) / 2, cz0 = (bb.min.z + bb.max.z) / 2;
      var LX = size.x * .19, LY0 = bb.min.y + size.y * .06, LY1 = bb.max.y - size.y * .11;
      // front-most depth of the door slab, for the backing slab and stops
      var pos = geo.attributes.position, zMin = Infinity;
      for (var i = 0; i < pos.count; i += 2) { var vx = pos.getX(i) - cx0, vy = pos.getY(i); if (Math.abs(vx) < LX && vy > LY0 && vy < LY1) zMin = Math.min(zMin, pos.getZ(i)); }
      if (!isFinite(zMin)) zMin = bb.min.z;
      var base = src.material; base.metalness = 0; base.roughness = .85; base.side = THREE.DoubleSide;
      renderer.localClippingEnabled = true;
      // frame: the whole scan with the door slab region clipped out (world space; the frame never moves)
      var W = { x0: -LX * s, x1: LX * s, y0: -1.6 + (LY0 - bb.min.y) * s, y1: -1.6 + (LY1 - bb.min.y) * s };
      var frameMat = base.clone(); frameMat.clipIntersection = true; frameMat.clippingPlanes = [
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), W.x0), new THREE.Plane(new THREE.Vector3(1, 0, 0), -W.x1),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), W.y0), new THREE.Plane(new THREE.Vector3(0, 1, 0), -W.y1)];
      // leaf: the whole scan clipped to the slab region; its planes follow the hinge every frame
      leafLocalPlanes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -(cx0 - LX)), new THREE.Plane(new THREE.Vector3(-1, 0, 0), cx0 + LX),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -LY0), new THREE.Plane(new THREE.Vector3(0, -1, 0), LY1)];
      leafPlanes = leafLocalPlanes.map(function (p) { return p.clone(); });
      var leafMat = base.clone(); leafMat.clipIntersection = false; leafMat.clippingPlanes = leafPlanes;
      var group = new THREE.Group();
      group.scale.set(s, s, s);
      // the model stands in front of the wall (wall face at z = .25); its back touches the wall
      var gz = .25 - bb.min.z * s;
      group.position.set(0, -1.6 - bb.min.y * s, gz);
      var frame = new THREE.Mesh(geo, frameMat); frame.position.x = -cx0; group.add(frame);
      // hinge on the left edge of the slab, at the door's face plane
      var hz = zMin + .02;
      leafPivot = new THREE.Group(); leafPivot.position.set(-LX, 0, hz);
      leafMeshRef = new THREE.Mesh(geo, leafMat); leafMeshRef.position.set(LX - cx0, 0, -hz); leafPivot.add(leafMeshRef); group.add(leafPivot);
      var slab = new THREE.Mesh(new THREE.BoxGeometry(2 * LX, LY1 - LY0, 0.06), new THREE.MeshStandardMaterial({ color: 0x14110d, roughness: .9 }));
      slab.position.set(LX, (LY0 + LY1) / 2, zMin - 0.04 - hz); leafPivot.add(slab);
      // painted jamb liner: jambs and head in the frame's cream, running back through the wall
      var linerMat = new THREE.MeshStandardMaterial({ color: 0xE9DFCE, roughness: .9 });
      var ld = (gz + zMin * s + .3) / s, lz = zMin - ld / 2, lt = .07;
      [[-LX - lt / 2, (LY0 + LY1) / 2, lt, LY1 - LY0 + lt], [LX + lt / 2, (LY0 + LY1) / 2, lt, LY1 - LY0 + lt], [0, LY1 + lt / 2, 2 * LX + 2 * lt, lt]].forEach(function (bx) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(bx[2], bx[3], ld), linerMat); m.position.set(bx[0], bx[1], lz); group.add(m);
      });
      scene.add(group); doorModel = group;
      scene.remove(wall); wall.geometry.dispose(); wall = buildWall({ w: (2 * LX + 2 * lt) * s, h: (LY1 + lt - bb.min.y) * s }); scene.add(wall);
      scene.remove(pivot); scene.remove(trimMesh);
      if (window.__showpieceOnDoor) window.__showpieceOnDoor();
    }, undefined, function () { doorLoading = false; });
  }

  // light through the doorway, and a second glow deep inside
  function glowTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
    var r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(255,220,140,1)'); r.addColorStop(.3, 'rgba(224,165,38,.55)'); r.addColorStop(1, 'rgba(224,165,38,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
  }
  var glowTex = glowTexture();
  var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .95 }));
  glow.position.set(0, 2.3, -2.8); glow.scale.set(7, 7, 1); scene.add(glow);
  var leak = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .22 }));
  leak.position.set(0, 1.7, 0.45); leak.scale.set(5.5, 7.5, 1); scene.add(leak);
  var glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .8 }));
  glow2.position.set(0, 3.2, -24); glow2.scale.set(24, 24, 1); scene.add(glow2);

  // sample-site panels
  var panelGeo = new THREE.PlaneGeometry(2.4, 3);
  var backGeo = new THREE.PlaneGeometry(2.56, 3.16);
  var backMat = new THREE.MeshStandardMaterial({ color: 0x14100C, roughness: .85, side: THREE.DoubleSide });
  var panels = Array.apply(null, Array(PANEL_COUNT)).map(function (_, i) {
    var mesh = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ map: paint(i), side: THREE.DoubleSide, toneMapped: false }));
    var back = new THREE.Mesh(backGeo, backMat); back.position.z = -0.03; mesh.add(back);
    scene.add(mesh);
    return { mesh: mesh, a: {}, g: {} };
  });

  // dust in the light
  var N = coarse ? 320 : 800;
  var pos = new Float32Array(N * 3), vel = new Float32Array(N);
  for (var i = 0; i < N; i++) { pos[i * 3] = rand(-10, 10); pos[i * 3 + 1] = rand(-1.5, 7); pos[i * 3 + 2] = rand(-28, 14); vel[i] = rand(.12, .45); }
  var pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
    var r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,230,170,1)'); r.addColorStop(.4, 'rgba(255,220,140,.6)'); r.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }
  var points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xE0A526, size: 0.11, map: dotTexture(), transparent: true, opacity: .65, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(points);

  /* ---------- layout (depends on aspect) ---------- */
  var portrait = false, camEnd = -10, camStart = 11.5;
  function layout() {
    panels.forEach(function (o, i) {
      var side = i % 2 ? 1 : -1;
      o.a = { x: side * (portrait ? 1.8 : 3.1 + (i % 3) * .3), y: 1.9 + ((i % 3) - 1) * .7, z: -3.2 - i * (portrait ? 2.2 : 1.7), ry: -side * .55 };
      if (portrait) { o.g = { x: side * 1.65, y: 1.9 + ((i % 3) - 1) * .6, z: -3.2 - i * 2.2, ry: -side * .5 }; }
      else {
        var col = i % 4, row = Math.floor(i / 4);
        o.g = { x: (col - 1.5) * 2.3 + .6, y: row === 0 ? 4.16 : 1.45, z: -18.4 + (col === 0 || col === 3 ? .6 : 0), ry: (1.5 - col) * .12 };
      }
    });
    camEnd = portrait ? -6.5 : -10.4;
  }
  function resize() {
    var w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    portrait = w / h < 1;
    camera.aspect = w / h; camera.fov = portrait ? 68 : 52; camera.updateProjectionMatrix();
    layout();
  }

  /* ---------- state ---------- */
  var mx = 0, my = 0, smx = 0, smy = 0;
  if (!coarse) {
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - .5) * 2; my = ((e.clientY - r.top) / r.height - .5) * 2;
    }, { passive: true });
    stage.addEventListener('pointerleave', function () { mx = 0; my = 0; });
  }

  function progress() {
    var total = section.offsetHeight - window.innerHeight;
    if (total <= 0) return 1;
    return clamp01(-section.getBoundingClientRect().top / total);
  }

  var RANGES = [[0, .2], [.24, .48], [.54, .76], [.82, 1.01]];
  var lastStep = -1;
  function setStep(p) {
    var idx = -1;
    RANGES.forEach(function (r, i) { if (p >= r[0] && p < r[1]) idx = i; });
    if (idx === lastStep) return;
    lastStep = idx;
    steps.forEach(function (s, i) { s.classList.toggle('is-on', i === idx); });
  }

  var lookTarget = new THREE.Vector3();
  function update(p, t) {
    var e = easeInOut(p);
    var camZ = lerp(camStart, camEnd, e);
    smx += (mx - smx) * .06; smy += (my - smy) * .06;
    camera.position.set(smx * .55, 1.9 + (portrait ? .15 : 0) - smy * .12, camZ);
    var settle = portrait ? 0 : easeInOut(smooth(.6, .9, p));
    lookTarget.set(smx * .9, lerp(1.75, 2.2, settle) - smy * .35, camZ - 9);
    camera.lookAt(lookTarget);
    camLight.position.copy(camera.position);

    var d = smooth(.06, .38, p);
    pivot.rotation.y = d * 1.85;
    if (leafPivot) {
      leafPivot.rotation.y = d * 1.52; leafMeshRef.updateWorldMatrix(true, false);
      for (var q = 0; q < 4; q++) leafPlanes[q].copy(leafLocalPlanes[q]).applyMatrix4(leafMeshRef.matrixWorld);
    }
    spot.intensity = 1.3 * smooth(.8, 6, camZ);
    doorLight.intensity = .8 + d * .7;
    var nearGlow = smooth(1.5, 7, camZ - glow.position.z);
    glow.material.opacity = (.45 + d * .35) * nearGlow;
    var nearLeak = smooth(1.2, 4.5, camZ - leak.position.z);
    leak.material.opacity = (.22 + d * .25) * nearLeak;

    var s = easeInOut(smooth(.6, .9, p));
    panels.forEach(function (o, i) {
      var a = o.a, g = o.g, m = o.mesh;
      var fl = Math.sin(t * .8 + i * 1.3) * .12 * (1 - s * .7);
      m.position.set(lerp(a.x, g.x, s), lerp(a.y, g.y, s) + fl, lerp(a.z, g.z, s));
      m.rotation.set(Math.sin(t * .6 + i) * .05 * (1 - s), lerp(a.ry, g.ry, s) + Math.sin(t * .5 + i * 2) * .06 * (1 - s), 0);
      var sc = portrait ? 1 : lerp(1, .82, s); m.scale.set(sc, sc, 1);
    });

    var arr = pGeo.attributes.position.array;
    for (var i = 0; i < N; i++) {
      arr[i * 3 + 1] += vel[i] * .004;
      arr[i * 3] += Math.sin(t * .4 + i) * .0015;
      if (arr[i * 3 + 1] > 7.5) arr[i * 3 + 1] = -1.5;
    }
    pGeo.attributes.position.needsUpdate = true;

    if (bar) bar.style.height = (p * 100).toFixed(1) + '%';
    if (hint) hint.classList.toggle('is-gone', p > .04);
    setStep(p);
  }

  /* ---------- loop, only while on screen ---------- */
  var visible = false, running = false, t0 = performance.now();
  function frame() {
    if (!visible) { running = false; return; }
    update(progress(), (performance.now() - t0) / 1000);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function start() { if (!running) { running = true; requestAnimationFrame(frame); } }

  // debug hook: render a given progress on demand (used for screenshots)
  window.__showpieceRender = function (p) { resize(); update(typeof p === 'number' ? p : progress(), (performance.now() - t0) / 1000); renderer.render(scene, camera); return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, cam: camera.position.toArray().map(function (v) { return +v.toFixed(2); }), size: renderer.getSize(new THREE.Vector2()).toArray(), dpr: renderer.getPixelRatio() }; };

  function boot() {
    resize();
    window.addEventListener('resize', resize);
    // fetch the 2 MB door model only once the section is near
    if ('IntersectionObserver' in window) {
      var near = new IntersectionObserver(function (entries) { if (entries[0].isIntersecting) { loadDoorModel(); near.disconnect(); } }, { rootMargin: '1200px 0px' });
      near.observe(section);
    } else { loadDoorModel(); }
    if (window.__showpieceNoLoop) { update(progress(), 0); renderer.render(scene, camera); return; }
    if (reduce) {
      setStatic();
      requestAnimationFrame(function () { resize(); update(.78, 0); renderer.render(scene, camera); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting; if (visible) start();
    }, { rootMargin: '120px 0px' });
    io.observe(section);
    update(progress(), 0); renderer.render(scene, camera);
  }

  // wait for the display fonts so the painted panels use the real typefaces
  var ready = document.fonts && document.fonts.load
    ? Promise.all(['600 56px "Fraunces"', 'italic 600 54px "Fraunces"', '400 96px "Fraunces"', 'italic 400 96px "Fraunces"', 'italic 500 20px "Fraunces"', '700 60px "Inter Tight"', '600 16px "Inter Tight"', '500 16px "Inter Tight"', '400 16px "Inter Tight"'].map(function (f) { return document.fonts.load(f); })).catch(function () {})
    : Promise.resolve();
  ready.then(function () {
    panels.forEach(function (o, i) { o.mesh.material.map.dispose(); o.mesh.material.map = paint(i); o.mesh.material.needsUpdate = true; });
    boot();
  });
})();
