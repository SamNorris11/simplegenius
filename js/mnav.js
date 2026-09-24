(function () {
  var btn = document.querySelector('[data-mnav]');
  var panel = document.getElementById('mnav');
  var header = document.querySelector('[data-header]');
  if (!btn || !panel || !header) return;
  function set(open) {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    header.classList.toggle('is-open', open);
  }
  btn.addEventListener('click', function () { set(panel.hidden); });
  panel.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
  window.addEventListener('resize', function () { if (window.innerWidth > 1180 && !panel.hidden) set(false); });
})();
