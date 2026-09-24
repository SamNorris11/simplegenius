/* Simple Genius interaction + motion layer */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)').matches;
  var root = document.documentElement;

  /* Header: always visible, switches to light after the first dark section */
  var hd = document.querySelector('[data-header]');
  var main = document.querySelector('main');
  var first = main && main.firstElementChild;
  function limit() { return Math.max(40, (first ? first.offsetHeight : 0) - (hd ? hd.offsetHeight : 0)); }
  var lim = limit();
  function onHeader() { if (hd) hd.classList.toggle('is-scrolled', window.scrollY > lim); }
  window.addEventListener('scroll', onHeader, { passive: true });
  window.addEventListener('resize', function () { lim = limit(); onHeader(); });
  onHeader();

  /* Whole audience card is clickable (link stays the keyboard target) */
  document.querySelectorAll('.aud__card').forEach(function (c) {
    var a = c.querySelector('.aud__more');
    if (!a) return;
    c.addEventListener('click', function (e) { if (e.target.closest('a')) return; window.location.href = a.href; });
  });

  /* Yellow top lines */
  var lined = document.querySelectorAll('.goal__panel, .offer .form, .talk .form.form--talk, .fc .form');
  lined.forEach(function (p) {
    var l = document.createElement('span'); l.className = 'm-line'; l.setAttribute('aria-hidden', 'true');
    p.appendChild(l); p.classList.add('m-lined');
  });

  /* Section entrances */
  if (!reduce && 'IntersectionObserver' in window) {
    var H = 'h1, h2';
    var C = '.pp-hero__sub, .pp-hero__line, .pp-eyebrow, .prose, .goal__copy, .offer__copy, .talk__copy, .pp-copy, .pp-goals, .pp-yours, .pp-yours__p, .pp-dark__lead, .pp-adjust, .pp-cta__sub, .pp-cta__copy, .fcta__copy, .fc__copy, .cred, .hw-flow, .hw-soft__copy, .hw-areas, .tm-p__body, .x-prose, .x-proc__sub, .x-talk__copy, .x-cred, .x-flow, .x-qs, .x-learn, .x-plan, .x-stay, .x-loop, .x-chron, .x-yours, .x-watch, .x-band__copy, .x-team__list, .x-price__grid';
    var P = '.hero__video, .aud__grid, .aud, .story__media, .quotes__track, .goal__panel, .split__form, .vids, .pp-three, .pp-big, .pp-cta .btn, .vbox, .hw-feat__shot, .x-film, .x-duo, .x-q, .x-talk__form, .x-rep__form';
    var secs = document.querySelectorAll('main > section:not(.feel), .vpage__main');
    secs.forEach(function (s) {
      var h = s.querySelector(H); if (h) h.classList.add('m-h');
      s.querySelectorAll(C).forEach(function (e) { if (!e.closest('.m-c')) e.classList.add('m-c'); });
      s.querySelectorAll(P).forEach(function (e) { if (!e.closest('.m-p') && !e.closest('.m-c')) e.classList.add('m-p'); });
    });
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { var t = en.target; t.classList.add('m-in'); io.unobserve(t); setTimeout(function () { t.classList.add('m-done'); }, 1200); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    secs.forEach(function (s) { io.observe(s); });
    lined.forEach(function (p) { io.observe(p); });
    root.classList.add('m-on');
  } else {
    lined.forEach(function (p) { p.classList.add('m-in'); });
  }

  if (reduce) return;

  /* Hero portrait: near-imperceptible upward drift (max 20px) */
  var media = document.querySelector('.hero__media'), hero = document.querySelector('.hero');
  if (media && hero && fine) {
    var tick = false;
    var drift = function () {
      tick = false;
      var p = Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight));
      media.style.transform = 'translate3d(0,' + (-20 * p).toFixed(2) + 'px,0)';
    };
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(drift); } }, { passive: true });
  }

  /* Testimonial marquee, only when there are more than four real quotes */
  var track = document.querySelector('.quotes__track');
  if (track) {
    var real = track.querySelectorAll('.tcard:not([data-placeholder])');
    if (real.length > 4 && fine) {
      track.querySelectorAll('[data-placeholder]').forEach(function (n) { n.remove(); });
      var vp = document.createElement('div'); vp.className = 'quotes__viewport';
      track.parentNode.insertBefore(vp, track); vp.appendChild(track);
      Array.prototype.forEach.call(real, function (n) { var c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
      track.classList.add('m-marquee');
      track.style.setProperty('--marq-dur', (real.length * 10) + 's');
      vp.addEventListener('pointerdown', function () { vp.classList.add('is-paused'); });
      vp.addEventListener('pointerleave', function () { vp.classList.remove('is-paused'); });
    }
  }

  if (!fine) return;

  /* Cursor bubble on featured visuals only */
  var cur = document.createElement('div'); cur.className = 'm-cursor'; cur.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cur);
  var tx = -100, ty = -100, x = -100, y = -100, running = false, on = false;
  function loop() {
    x += (tx - x) * 0.2; y += (ty - y) * 0.2;
    cur.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + (on ? 1 : 0.6) + ')';
    if (on || Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) requestAnimationFrame(loop); else running = false;
  }
  function bind(sel, label) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; cur.textContent = label; tx = x = e.clientX; ty = y = e.clientY; on = true; cur.classList.add('is-on'); if (!running) { running = true; requestAnimationFrame(loop); } });
      el.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; });
      el.addEventListener('pointerleave', function () { on = false; cur.classList.remove('is-on'); });
    });
  }
  bind('.aud__card', 'View →');
  bind('.vid__btn', 'Watch →');
  bind('.hero__video', 'Watch →');
  document.addEventListener('click', function (e) { if (e.target.closest('.vid__btn')) { on = false; cur.classList.remove('is-on'); } }, true);

  /* Magnetic primary buttons (max 3px) */
  document.querySelectorAll('.btn:not(.feel .btn)').forEach(function (b) {
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      b.style.setProperty('--mx', (dx * 3).toFixed(2) + 'px'); b.style.setProperty('--my', (dy * 2).toFixed(2) + 'px');
    });
    b.addEventListener('pointerleave', function () { b.style.removeProperty('--mx'); b.style.removeProperty('--my'); });
  });
})();
