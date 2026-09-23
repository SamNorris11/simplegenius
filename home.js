if (/[?&]placeholders\b/.test(location.search)) document.documentElement.classList.add('show-ph');
(function () {
  // Pixel-align the Y in YOU with the B in BUILD, measured with the visitor's own font rendering.
  function alignHeadline() {
    var h1 = document.querySelector('.hero__h1');
    var y = h1 && h1.querySelector('.h1-y');
    if (!y) return;
    var cs = getComputedStyle(h1);
    var size = parseFloat(cs.fontSize);
    var dpr = Math.max(window.devicePixelRatio || 1, 2);
    function ink(ch) {
      var w = Math.ceil(size * 2 * dpr), h = Math.ceil(size * 1.6 * dpr);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.font = cs.fontWeight + ' ' + size + 'px ' + cs.fontFamily;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#000';
      ctx.fillText(ch, size * 0.5, size * 1.2);
      var d = ctx.getImageData(0, 0, w, h).data, L = -1, R = -1;
      for (var x = 0; x < w; x++) {
        for (var yy = 0; yy < h; yy++) { if (d[(yy * w + x) * 4 + 3] > 110) { if (L < 0) L = x; R = x; break; } }
      }
      return { l: L / dpr - size * 0.5, r: (R + 1) / dpr - size * 0.5 };
    }
    var Y = ink('Y'), B = ink('B');
    // Line 1 keeps its position; line 2 shifts so the B's visual center sits under the Y's visual center.
    var yMargin = Math.max(0, B.l - Y.l);
    y.style.marginLeft = yMargin.toFixed(2) + 'px';
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignHeadline); else alignHeadline();
  window.addEventListener('resize', alignHeadline);

  // Mobile menu
  var btn = document.querySelector('[data-menu]');
  var panel = document.getElementById('mnav');
  var header = document.querySelector('[data-header]');
  function setMenu(open) {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    header.classList.toggle('is-open', open);
  }
  if (btn && panel) {
    btn.addEventListener('click', function () { setMenu(panel.hidden); });
    panel.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  }

  // Attribution (same hidden fields as simplegenius.com forms)
  var KEY = 'sg_attr_v1';
  var params = new URLSearchParams(window.location.search);
  var stored = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'li_fat_id'].forEach(function (k) {
    if (params.get(k)) stored[k] = params.get(k);
  });
  if (!stored.landing_page) stored.landing_page = window.location.pathname || '/';
  if (!stored.first_visit) stored.first_visit = new Date().toISOString();
  if (!stored.referrer && document.referrer) stored.referrer = document.referrer;
  try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) {}
  function gaId() {
    var m = document.cookie.match(/(?:^|;\s*)_ga=GA\d\.\d\.(\d+\.\d+)/);
    return m ? m[1] : '';
  }
  function attr(name) {
    switch (name) {
      case 'page_url': return window.location.href;
      case 'referrer': return document.referrer || stored.referrer || '';
      case 'ga_client_id': return gaId();
      case 'visit_summary': return '';
      default: return stored[name] || '';
    }
  }

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Same messages as the simplegenius.com forms
  var MESSAGES = {
    required: 'We need this one to run the scan.',
    requiredInvite: 'We need this one to send the invite.',
    email: 'That email address does not look right. Check it and try again.'
  };

  function validate(form) {
    var ok = true, first = null;
    var reqMsg = form.getAttribute('data-required-message') === 'invite' ? MESSAGES.requiredInvite : MESSAGES.required;
    form.querySelectorAll('input:not([type=hidden]), textarea, select').forEach(function (el) {
      var err = el.parentNode.querySelector('.err');
      if (err) err.hidden = true;
      el.removeAttribute('aria-invalid');
      var v = (el.value || '').trim();
      var msg = '';
      if (el.required && !v) msg = reqMsg;
      else if (el.type === 'email' && v && !EMAIL.test(v)) msg = MESSAGES.email;
      if (msg) {
        ok = false;
        el.setAttribute('aria-invalid', 'true');
        if (err) { err.textContent = msg; err.hidden = false; }
        if (!first) first = el;
      }
    });
    if (first) first.focus();
    return ok;
  }

  // Progressive disclosure for the competitor report form
  function setupMore(form) {
    var more = form.querySelector('[data-more]');
    var cont = form.querySelector('[data-continue]');
    if (!more || !cont) return function () {};
    var firsts = form.querySelectorAll('[data-first] input');
    var open = false;
    more.setAttribute('inert', '');
    function expand(focus) {
      if (open) return;
      open = true;
      more.removeAttribute('inert');
      form.classList.add('is-expanded');
      cont.setAttribute('aria-expanded', 'true');
      cont.hidden = true;
      if (focus) {
        var next = more.querySelector('input, textarea');
        setTimeout(function () { next && next.focus({ preventScroll: true }); }, 60);
      }
    }
    function filled() { return Array.prototype.every.call(firsts, function (i) { return i.value.trim(); }); }
    cont.addEventListener('click', function () { expand(true); });
    firsts.forEach(function (i) {
      i.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); if (i === firsts[0] && !filled()) firsts[1].focus(); else expand(true); }
      });
    });
    return expand;
  }

  document.querySelectorAll('form[data-endpoint]').forEach(function (form) {
    var expand = setupMore(form);
    var submit = form.querySelector('[data-submit]');
    var fail = form.querySelector('[data-fail]');
    var labelHtml = submit.innerHTML;

    form.addEventListener('input', function (e) {
      var err = e.target.parentNode && e.target.parentNode.querySelector('.err');
      if (err) err.hidden = true;
      e.target.removeAttribute('aria-invalid');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // Keep this submit away from the legacy GTM "form_submit on /" trigger
      // (old Webflow demo form: GA4 demo_request + Meta CompleteRegistration).
      // Conversions for these forms are sent by sg-track.js after the backend succeeds.
      e.stopPropagation();
      fail.hidden = true;
      expand(false);
      if (!validate(form)) return;

      // Production attribution (visit history, first touch, GA client id) comes from /js/sg-track.js.
      // Local attr() only fills anything sg-track could not provide.
      var attrInputs = form.querySelectorAll('input[data-attr]');
      if (window.sgTrack && window.sgTrack.refresh) {
        attrInputs.forEach(function (i) { i.value = ''; });
        try { window.sgTrack.refresh(form); } catch (x) {}
      }
      attrInputs.forEach(function (i) { if (!i.value) i.value = attr(i.getAttribute('data-attr')); });

      // Free Consultation form: the lead endpoint takes fullName and challenge, so compose them from the split fields.
      if (form.hasAttribute('data-compose')) {
        var v = function (n) { var el = form.querySelector('[name=' + n + ']'); return el ? el.value.trim() : ''; };
        form.querySelector('[name=fullName]').value = (v('firstName') + ' ' + v('lastName')).trim();
        form.querySelector('[name=challenge]').value = [v('message'), v('phone') ? 'Phone: ' + v('phone') : ''].filter(Boolean).join('\n\n');
      }
      var payload = {};
      form.querySelectorAll('input, textarea, select').forEach(function (f) { if (f.name) payload[f.name] = f.value; });


      submit.disabled = true;
      submit.textContent = form.getAttribute('data-submitting') || 'Sending…';

      fetch(form.getAttribute('data-endpoint'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status);
          return data;
        });
      }).then(function () {
        // Conversion fires only after the backend accepted the submission.
        // sgTrack waits for the analytics hit (2s cap) before we navigate away.
        return new Promise(function (resolve) {
          if (window.sgTrack && window.sgTrack.formConversion) {
            try { window.sgTrack.formConversion(form, payload, resolve); } catch (x) { resolve(); }
          } else resolve();
        });
      }).then(function () {
        var status = document.getElementById(form.getAttribute('data-status'));
        var fill = status && status.querySelector('[data-fill=email]');
        if (fill) fill.textContent = payload.email;
        form.hidden = true;
        if (status) { status.hidden = false; status.setAttribute('tabindex', '-1'); status.focus(); }
        // Let's Talk: same as simplegenius.com/talk, continue to the scheduling calendar.
        var redirect = form.getAttribute('data-redirect');
        if (redirect) {
          var q = [];
          if (payload.fullName) q.push('name=' + encodeURIComponent(payload.fullName));
          if (payload.email) q.push('email=' + encodeURIComponent(payload.email));
          window.location.href = redirect + (q.length ? '?' + q.join('&') : '');
        }
      }).catch(function (err) {
        console.error('Form submit failed:', err);
        submit.disabled = false;
        submit.innerHTML = labelHtml;
        fail.textContent = /Missing|Invalid|minute|limit|already/i.test(err.message) ? err.message : 'Something went wrong. Please try again or email hello@simplegenius.com.';
        fail.hidden = false;
      });
    });
  });
})();

// Founder insights: play YouTube videos inline on the page
document.querySelectorAll('.vid__btn[data-yt]').forEach(function (b) {
  b.addEventListener('click', function () {
    var id = b.getAttribute('data-yt');
    var box = document.createElement('div');
    box.className = 'vid__frame';
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    f.title = b.getAttribute('aria-label').replace('Play video: ', '');
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.allowFullscreen = true;
    box.appendChild(f);
    b.replaceWith(box);
  });
});


// Latest founder insights: native video carousel.
// Hover previews muted. Click plays with sound and keeps playing as the cursor moves. Clicking it again (or its sound button) stops it and resets.
// Leaving a video always resets it, so coming back starts from the beginning.
(function () {
  var root = document.querySelector('.fins');
  if (!root) return;
  var track = root.querySelector('.fins__track');
  var prev = root.querySelector('[data-fins-prev]');
  var next = root.querySelector('[data-fins-next]');
  var tiles = Array.prototype.slice.call(root.querySelectorAll('[data-fi]'));
  var active = null;   // tile playing with sound
  var preview = null;  // tile playing muted from hover

  function vid(t) { return t.querySelector('video'); }
  function load(t) {
    var v = vid(t);
    if (v.getAttribute('data-src') && !v.getAttribute('src')) {
      v.src = v.getAttribute('data-src');
      v.preload = 'auto';
    }
    return v;
  }
  function stop(t) {
    if (!t) return;
    var v = vid(t);
    if (!v.paused) v.pause();
    if (v.getAttribute('src')) { try { v.currentTime = 0; } catch (e) {} v.load(); } // back to poster, start over next time
    v.muted = true;
    t.classList.remove('is-playing', 'is-active', 'is-preview');
    t.querySelector('.fi__mute').hidden = true;
    if (active === t) active = null;
    if (preview === t) preview = null;
  }
  function stopOthers(t) { tiles.forEach(function (o) { if (o !== t) stop(o); }); }
  function setMuteBtn(t) {
    var v = vid(t), m = t.querySelector('.fi__mute');
    m.setAttribute('data-muted', v.muted ? 'true' : 'false');
    m.setAttribute('aria-label', v.muted ? 'Unmute' : 'Mute');
  }
  function play(t, withSound) {
    var v = load(t);
    v.muted = !withSound;
    setMuteBtn(t);
    t.classList.toggle('is-preview', !withSound);
    var pr = v.play();
    if (pr && pr.catch) pr.catch(function () { t.classList.remove('is-playing'); });
    t.classList.add('is-playing');
  }

  tiles.forEach(function (t) {
    var v = vid(t);
    v.addEventListener('pause', function () { t.classList.remove('is-playing'); });
    v.addEventListener('playing', function () { t.classList.add('is-playing'); });
    v.addEventListener('error', function () { t.classList.remove('is-playing'); });

    t.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;   // touch/pen: no hover preview
      if (active) return;                      // a video playing with sound keeps playing while the cursor moves
      if (preview === t) return;
      stopOthers(t);
      preview = t;
      play(t, false);
    });
    t.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (preview === t) stop(t);
    });

    t.querySelector('.fi__hit').addEventListener('click', function () {
      if (active === t) { stop(t); return; }   // clicking the playing video stops it; next play starts over
      stopOthers(t);
      preview = null;
      active = t;
      t.classList.add('is-active');
      t.querySelector('.fi__mute').hidden = false;
      if (!v.paused) { v.muted = false; setMuteBtn(t); t.classList.remove('is-preview'); } // hover preview → keep going with sound
      else play(t, true);
    });

    t.querySelector('.fi__mute').addEventListener('click', function (e) {
      e.stopPropagation();
      stop(t);                                 // turning the sound off stops it; next play starts over
    });
  });

  // Pause anything that scrolls out of view
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.intersectionRatio < 0.5) {
          var t = e.target;
          if (t === active || t === preview) stop(t);
        }
      });
    }, { threshold: [0, 0.5] });
    tiles.forEach(function (t) { io.observe(t); });
  }

  // Arrows: move by the number of fully visible tiles
  function step() {
    var w = tiles[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 20);
    var pl = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    return Math.max(1, Math.floor((track.clientWidth - pl) / w)) * w;
  }
  function update() {
    var max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
  }
  prev.addEventListener('click', function () { track.scrollBy({ left: -step() }); });
  next.addEventListener('click', function () { track.scrollBy({ left: step() }); });
  track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
  track.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step() }); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); track.scrollBy({ left: -step() }); }
  });
  window.addEventListener('resize', update);
  update();
})();
