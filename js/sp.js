/* Process page: sticky rail, gathering words, draw-in reveals. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var reveals = document.querySelectorAll('[data-reveal-draw]');
  if (reduce || !hasIO) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
    document.querySelectorAll('[data-gather]').forEach(function (g) { g.style.setProperty('--p', 1); });
  } else {
    root.classList.add('sp-js');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
    var seq = document.querySelector('.sp-seq'); if (seq) io.observe(seq);
  }

  var gathers = Array.prototype.slice.call(document.querySelectorAll('[data-gather]'));
  var spine = document.querySelector('[data-spine]');
  var stages = spine ? Array.prototype.slice.call(spine.querySelectorAll('[data-stage]')) : [];
  var num = document.querySelector('[data-rail-num]');
  var fill = document.querySelector('[data-rail-fill]');
  var items = spine ? spine.querySelectorAll('.sp-rail__list li:not(.sp-rail__back)') : [];
  var back = spine ? spine.querySelector('.sp-rail__back') : null;
  var active = -1;

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function frame() {
    var vh = window.innerHeight;
    if (!reduce) {
      gathers.forEach(function (g) {
        var r = g.getBoundingClientRect();
        var p = clamp((vh * 0.92 - r.top) / (vh * 0.62));
        g.style.setProperty('--p', ease(p).toFixed(3));
      });
    }
    if (!spine) return;
    var sr = spine.getBoundingClientRect();
    if (fill) fill.parentNode.style.setProperty('--fill', clamp((vh * 0.5 - sr.top) / sr.height).toFixed(3));
    var idx = 0;
    for (var i = 0; i < stages.length; i++) { if (stages[i].getBoundingClientRect().top < vh * 0.5) idx = i; }
    var atEnd = sr.bottom < vh * 0.62;
    if (back) back.classList.toggle('is-on', atEnd);
    if (idx !== active) {
      active = idx;
      for (var j = 0; j < items.length; j++) {
        items[j].classList.toggle('is-on', j === idx);
        items[j].classList.toggle('is-done', j < idx);
      }
      if (num) {
        num.textContent = stages[idx].getAttribute('data-stage');
        num.classList.remove('is-swap'); void num.offsetWidth; num.classList.add('is-swap');
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
