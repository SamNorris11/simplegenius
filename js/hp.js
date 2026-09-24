/* Homepage: header state + restrained entrances. No cursor effects, no parallax. */
(function () {
  var root = document.documentElement;
  var hd = document.querySelector('[data-header]');
  function onScroll() { if (hd) hd.classList.toggle('is-stuck', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var els = document.querySelectorAll('[data-rv], [data-pr], .hp-cyc');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('hp-js');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92) el.classList.add('is-in'); else io.observe(el);
  });
})();
