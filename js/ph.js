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

/* Hero YouTube: swap the poster for the player on click */
(function () {
  var b = document.querySelector('.hero__yt'); if (!b) return;
  b.addEventListener('click', function () {
    var id = b.getAttribute('data-yt'), f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    f.title = 'Simple Genius: Know Your Business. Run It Better.';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.referrerPolicy = 'strict-origin-when-cross-origin'; f.allowFullscreen = true;
    b.parentNode.replaceChild(f, b);
    if (window.dataLayer) window.dataLayer.push({ event: 'hero_video_play', video_id: id });
  });
})();
