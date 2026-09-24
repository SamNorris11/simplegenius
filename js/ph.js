/* Homepage: draw the Process line once it scrolls into view. */
(function () {
  var pr = document.querySelector('[data-pr]');
  if (!pr) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) { pr.classList.add('is-in'); return; }
  document.documentElement.classList.add('ph-js');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { pr.classList.add('is-in'); io.disconnect(); } });
  }, { threshold: 0.25 });
  io.observe(pr);
})();
