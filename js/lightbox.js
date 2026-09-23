(function () {
  var imgs = document.querySelectorAll('.hw-feat__shot img');
  if (!imgs.length) return;
  var box = document.createElement('div');
  box.className = 'lbx'; box.hidden = true;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Expanded image');
  box.innerHTML = '<button class="lbx__x" type="button" aria-label="Close">&times;</button><img class="lbx__img" alt="" />';
  document.body.appendChild(box);
  var big = box.querySelector('.lbx__img'), x = box.querySelector('.lbx__x'), last = null;
  function open(img) {
    last = img;
    var set = img.getAttribute('srcset') || '';
    var m = set.match(/(\S+)\s+2400w/);
    big.src = m ? m[1] : img.currentSrc || img.src;
    big.alt = img.alt;
    box.hidden = false; document.documentElement.classList.add('lbx-open');
    requestAnimationFrame(function () { box.classList.add('is-on'); });
    x.focus();
  }
  function close() {
    box.classList.remove('is-on'); document.documentElement.classList.remove('lbx-open');
    setTimeout(function () { box.hidden = true; big.removeAttribute('src'); }, 180);
    if (last) last.focus();
  }
  imgs.forEach(function (img) {
    img.tabIndex = 0; img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Expand image: ' + img.alt);
    img.addEventListener('click', function () { open(img); });
    img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); } });
  });
  box.addEventListener('click', function (e) { if (e.target !== big) close(); });
  document.addEventListener('keydown', function (e) { if (!box.hidden && e.key === 'Escape') close(); });
})();
