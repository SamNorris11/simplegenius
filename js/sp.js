/* Process page: sticky number indicator, scroll linked figures, draw-in reveals. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var reveals = document.querySelectorAll('[data-reveal-draw]');
  if (reduce || !hasIO) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
    document.querySelectorAll('[data-gather]').forEach(function (g) { g.style.setProperty('--p', 1); g.classList.add('is-done'); });
  } else {
    root.classList.add('sp-js');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  var gathers = Array.prototype.slice.call(document.querySelectorAll('[data-gather]'));
  var spine = document.querySelector('[data-spine]');
  var stages = spine ? Array.prototype.slice.call(spine.querySelectorAll('[data-stage]')) : [];
  var fill = document.querySelector('[data-rail-fill]');
  var items = spine ? spine.querySelectorAll('.sp-rail__nums li') : [];
  var active = -1;

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function frame() {
    var vh = window.innerHeight;
    if (!reduce) {
      gathers.forEach(function (g) {
        var r = g.getBoundingClientRect();
        var p = clamp((vh * 0.95 - r.top) / (vh * 0.55));
        g.style.setProperty('--p', ease(p).toFixed(3));
        g.classList.toggle('is-done', p > 0.98);
      });
    }
    if (!spine) return;
    var sr = spine.getBoundingClientRect();
    if (fill) fill.parentNode.style.setProperty('--fill', clamp((vh * 0.5 - sr.top) / sr.height).toFixed(3));
    var idx = 0;
    for (var i = 0; i < stages.length; i++) { if (stages[i].getBoundingClientRect().top < vh * 0.5) idx = i; }
    if (idx !== active) {
      active = idx;
      for (var j = 0; j < items.length; j++) {
        items[j].classList.toggle('is-on', j === idx);
        items[j].classList.toggle('is-done', j < idx);
      }
      spine.classList.toggle('is-dark', stages[idx].hasAttribute('data-dark'));
    }
  }
  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; frame(); }); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();
})();

/* Stage heads: shrink each headline box to its real line width so every number + headline composition centers on what you actually see. */
(function () {
  var hs = [].slice.call(document.querySelectorAll('.sp-head .sp-h'));
  if (!hs.length) return;
  var bodies = [].slice.call(document.querySelectorAll('.sp-stage__body'));
  function fit() {
    bodies.forEach(function (b) { b.style.zoom = ''; });
    hs.forEach(function (h) {
      h.style.width = '';
      var r = document.createRange(); r.selectNodeContents(h);
      var rects = [].slice.call(r.getClientRects()), left = h.getBoundingClientRect().left, max = 0;
      rects.forEach(function (x) { if (x.right - left > max) max = x.right - left; });
      if (max > 0) h.style.width = Math.ceil(max + 2) + 'px';
    });
    /* Desktop: scale a stage down only if it would not fit one screen under the header. */
    var hd = document.querySelector('.hd'), hh = hd ? hd.getBoundingClientRect().height : 72;
    if (window.innerWidth > 900 || window.innerWidth <= 600) {
      var avail = window.innerHeight - hh - (window.innerWidth > 900 ? 64 : 20);
      bodies.forEach(function (b) {
        var hgt = b.getBoundingClientRect().height;
        if (hgt > avail) b.style.zoom = Math.max(window.innerWidth > 900 ? 0.68 : 0.84, avail / hgt).toFixed(3);
      });
    }
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fit, 120); });
})();
