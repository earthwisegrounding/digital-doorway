/* ==========================================================================
   Marv walks on. When the voice note starts, a rigged character struts in
   from the left, dances for the length of the audio, then struts off right.
   Uses Three.js r128 + GLTFLoader (already on the page). Overlay is a
   transparent, click-through canvas fixed to the viewport.
   ========================================================================== */
(function () {
  'use strict';
  var audio = document.querySelector('[data-voice] audio');
  if (!audio || !window.THREE || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var renderer, scene, camera, mixer, model, clips = {}, actions = {}, canvas;
  var state = 'idle', clock, halfW = 4, target = 0, ready = false, loading = false, pendingPlay = false;
  var t0 = 0;

  function setup() {
    canvas = document.createElement('canvas');
    canvas.className = 'marv-stage'; canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true }); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b5d4d, 1.1));
    var key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(3, 6, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0xe0a526, .6); rim.position.set(-4, 3, -3); scene.add(rim);
    clock = new THREE.Clock();
    window.addEventListener('resize', resize); resize();
    return true;
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    // character is 1.7 units tall; make it about 42% of the viewport height, feet near the bottom
    // feet at the bottom edge of the viewport, character about 45% of its height
    var dist = 7, halfH = dist * Math.tan(camera.fov * Math.PI / 360);
    halfW = halfH * camera.aspect;
    camera.position.set(0, halfH - 0.12, dist); camera.lookAt(0, halfH - 0.12, 0);
  }
  function load() {
    if (loading || ready || !THREE.GLTFLoader) return; loading = true;
    new THREE.GLTFLoader().load('assets/marv.glb', function (gltf) {
      model = gltf.scene; model.rotation.y = Math.PI / 2;    // face +x so the strut reads left-to-right
      model.traverse(function (o) { if (o.isMesh) { o.frustumCulled = false; o.material.side = THREE.DoubleSide; } });
      scene.add(model);
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(function (c) { clips[c.name] = c; actions[c.name] = mixer.clipAction(c); });
      ready = true; loading = false;
      if (pendingPlay) { pendingPlay = false; enter(); }
    }, undefined, function () { loading = false; });
  }
  function play(name, fade) {
    var a = actions[name]; if (!a) return;
    Object.keys(actions).forEach(function (k) { if (k !== name && actions[k].isRunning()) actions[k].fadeOut(fade); });
    a.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
  }
  function enter() {
    canvas.classList.add('is-on'); model.position.set(-halfW - 1.2, 0, 0); model.rotation.y = Math.PI / 2;
    state = 'enter'; t0 = clock.getElapsedTime(); play('strut', .2); tick();
  }
  function exit() { state = 'exit'; t0 = clock.getElapsedTime(); model.rotation.y = Math.PI / 2; play('strut', .3); }
  var raf = 0;
  function tick() {
    cancelAnimationFrame(raf);
    var dt = clock.getDelta(), t = clock.getElapsedTime();
    if (mixer) mixer.update(dt);
    var speed = 1.9;  // units per second, matched to the strut's stride
    if (state === 'enter') {
      model.position.x += speed * dt;
      if (model.position.x >= 0) { model.position.x = 0; state = 'dance'; model.rotation.y = 0; play('dance', .35); }
    } else if (state === 'dance') {
      model.rotation.y = Math.sin(t * .8) * .25;
    } else if (state === 'exit') {
      model.position.x += speed * dt;
      if (model.position.x > halfW + 1.2) { state = 'idle'; canvas.classList.remove('is-on'); renderer.clear(); return; }
    } else if (state === 'paused') { renderer.render(scene, camera); return; }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  audio.addEventListener('play', function () {
    if (!renderer && !setup()) return;
    if (!ready) { pendingPlay = true; load(); return; }
    if (state === 'idle') enter();
    else if (state === 'paused') { state = 'dance'; if (mixer) mixer.timeScale = 1; tick(); }
  });
  audio.addEventListener('pause', function () {
    if (!ready) { pendingPlay = false; return; }
    if (audio.ended) return;
    if (state === 'dance' || state === 'enter') { state = 'paused'; if (mixer) mixer.timeScale = 0; }
  });
  audio.addEventListener('ended', function () { if (ready && state !== 'idle' && state !== 'exit') { if (mixer) mixer.timeScale = 1; exit(); tick(); } });
  // warm the model up once the hero is on screen so the first click is instant
  var hero = document.querySelector('.hero-voice');
  if (hero && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { if (!renderer) setup(); load(); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(hero);
  }
})();
