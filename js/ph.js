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

/* Hero video: autoplays muted; the sound button restarts it from the beginning with audio */
(function () {
  var b = document.querySelector('.hero__snd'), v = document.querySelector('.hero__mp4'); if (!b || !v) return;
  var p = v.play && v.play(); if (p && p.catch) p.catch(function () {});
  b.addEventListener('click', function () {
    v.currentTime = 0; v.muted = false; v.loop = false; v.controls = true; v.play(); b.remove();
    if (window.dataLayer) window.dataLayer.push({ event: 'hero_video_sound', video: 'simple-genius-homepage' });
  });
})();
