/* Simple Genius — site.js
   Progressive enhancement only. The site is fully readable with JS disabled.
   Behaviours: (1) no-js flag, (2) sticky nav state, (3) mobile nav toggle,
   (4) scroll reveal, (5) FAQ accordion, (6) form validation + states. */

(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------- sticky header --- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 12) header.classList.add('is-stuck');
      else header.classList.remove('is-stuck');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------------ mobile nav ---- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.classList.contains('nav__link')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* --------------------------------------------------- scroll reveal ---- */
  var revealables = document.querySelectorAll('.reveal');
  if (revealables.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(revealables, function (el) {
        el.classList.add('is-visible');
      });
    } else {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var siblings = el.parentNode ? el.parentNode.querySelectorAll(':scope > .reveal') : [el];
          var index = Array.prototype.indexOf.call(siblings, el);
          window.setTimeout(function () { el.classList.add('is-visible'); },
            Math.max(0, index) * 60);
          observer.unobserve(el);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

      Array.prototype.forEach.call(revealables, function (el) { observer.observe(el); });

      // Anything already in view on load reveals immediately.
      window.setTimeout(function () {
        Array.prototype.forEach.call(revealables, function (el) {
          if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible');
        });
      }, 40);
    }
  }

  /* ------------------------------------------- spine progress (four steps) */
  var spine = document.querySelector('.spine');
  var spineFill = spine ? spine.querySelector('.spine__fill') : null;
  if (spine && spineFill && !reduceMotion) {
    var track = spine.querySelector('.spine__track');
    var raf = null;
    var paintSpine = function () {
      raf = null;
      var rect = spine.getBoundingClientRect();
      var trackHeight = track ? track.offsetHeight : rect.height;
      var anchor = window.innerHeight * 0.62;
      var progress = (anchor - rect.top) / rect.height;
      progress = Math.max(0, Math.min(1, progress));
      spineFill.style.height = (progress * trackHeight) + 'px';
    };
    var queueSpine = function () {
      if (raf === null) raf = window.requestAnimationFrame(paintSpine);
    };
    paintSpine();
    window.addEventListener('scroll', queueSpine, { passive: true });
    window.addEventListener('resize', queueSpine);
  }

  /* ------------------------------------------------------- accordion ---- */
  Array.prototype.forEach.call(document.querySelectorAll('.accordion__trigger'), function (btn) {
    // Panels ship open in the markup so the answers are readable without JS.
    // Collapse them only once the script is running.
    var initial = document.getElementById(btn.getAttribute('aria-controls'));
    if (initial && btn.getAttribute('aria-expanded') !== 'true') initial.hidden = true;

    btn.addEventListener('click', function () {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (panel) panel.hidden = open;
    });
  });

  /* -------------------------------------------------- form validation --- */
  var MESSAGES = {
    required: 'We need this one to run the scan.',
    requiredInvite: 'We need this one to send the invite.',
    email: 'That email address does not look right. Check it and try again.'
  };

  function showError(group, message) {
    if (!group) return;
    group.classList.add('has-error');
    var err = group.querySelector('.form__error');
    if (err) { err.textContent = message; err.hidden = false; }
  }

  function clearError(group) {
    if (!group) return;
    group.classList.remove('has-error');
    var err = group.querySelector('.form__error');
    if (err) err.hidden = true;
  }

  function validate(form) {
    var ok = true;
    var firstBad = null;
    var requiredMessage = form.getAttribute('data-required-message') === 'invite'
      ? MESSAGES.requiredInvite : MESSAGES.required;

    Array.prototype.forEach.call(form.querySelectorAll('.form__input'), function (input) {
      var group = input.closest('.form__group');
      clearError(group);
      var value = (input.value || '').trim();

      if (input.hasAttribute('data-required') && !value) {
        showError(group, requiredMessage);
        ok = false;
        if (!firstBad) firstBad = input;
        return;
      }
      if (input.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        showError(group, MESSAGES.email);
        ok = false;
        if (!firstBad) firstBad = input;
      }
    });

    if (firstBad) firstBad.focus();
    return ok;
  }

  /* -------------------------------------------------- attribution capture ---
     Populates any <input data-attr="..."> hidden field from the URL query,
     referrer, and GA client id cookie. Runs once per page so hidden fields
     are populated before the form submits. */
  function getQueryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || '';
    } catch (e) { return ''; }
  }
  function getCookie(name) {
    try {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, '\\$1') + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : '';
    } catch (e) { return ''; }
  }
  function getGaClientId() {
    // GA4 stores the client id in _ga as GAx.x.<clientId>.<timestamp>
    var raw = getCookie('_ga');
    if (!raw) return '';
    var parts = raw.split('.');
    return parts.length >= 4 ? (parts[2] + '.' + parts[3]) : '';
  }
  function attrSource(name) {
    switch (name) {
      case 'utm_source':
      case 'utm_medium':
      case 'utm_campaign':
      case 'utm_term':
      case 'utm_content':
      case 'gclid':
      case 'fbclid':
      case 'li_fat_id':
        return getQueryParam(name);
      case 'page_url':      return window.location.href || '';
      case 'referrer':      return document.referrer || '';
      case 'ga_client_id':  return getGaClientId();
      case 'landing_page':  return window.location.pathname || '';
      case 'first_visit':   return new Date().toISOString();
      default: return '';
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[data-attr]'), function (input) {
    var val = attrSource(input.getAttribute('data-attr'));
    if (val) input.value = val;
  });

  Array.prototype.forEach.call(document.querySelectorAll('.form'), function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return;

      var statusId = form.getAttribute('data-status');
      var status = statusId ? document.getElementById(statusId) : null;
      var submit = form.querySelector('.form__submit');
      var endpoint = form.getAttribute('data-endpoint');

      if (submit) {
        submit.disabled = true;
        submit.textContent = form.getAttribute('data-submitting') || 'Sending…';
      }

      function showSuccess() {
        if (status) {
          form.hidden = true;
          status.hidden = false;
          status.setAttribute('tabindex', '-1');
          status.focus();
          status.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      }

      function restoreSubmit() {
        if (submit) {
          submit.disabled = false;
          submit.textContent = form.getAttribute('data-submit-label') || 'Submit';
        }
      }

      if (endpoint) {
        // Real submit: serialize the form as JSON and POST to the endpoint.
        var payload = {};
        Array.prototype.forEach.call(form.querySelectorAll('input, textarea, select'), function (field) {
          if (!field.name) return;
          payload[field.name] = field.value;
        });
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json().catch(function () { return {}; });
        }).then(function () {
          showSuccess();
        }).catch(function (err) {
          // Surface a soft error — leave the form visible so the user can retry.
          console.error('Form submit failed:', err);
          restoreSubmit();
          var group = form.querySelector('.form__group');
          if (group) {
            var errEl = group.querySelector('.form__error');
            if (errEl) {
              errEl.textContent = 'Something went wrong. Please try again or email hello@simplegenius.com.';
              errEl.hidden = false;
            }
          }
        });
      } else {
        // Legacy behavior: fake delay + success (preserves prior UX for any
        // page not yet wired to a real endpoint).
        window.setTimeout(showSuccess, 600);
      }
    });

    Array.prototype.forEach.call(form.querySelectorAll('.form__input'), function (input) {
      input.addEventListener('input', function () { clearError(input.closest('.form__group')); });
    });
  });

  /* ------------------------------------------- pointer-tracked surfaces ---
     Writes --mx/--my on card-like surfaces so the CSS radial highlight can
     follow the cursor. Purely decorative: the surfaces are complete without
     it, and it is skipped entirely under reduced-motion or on touch. */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    var tracked = document.querySelectorAll(
      '.beat, .commit, .plan, .ctx__pane, .card, .stage'
    );
    Array.prototype.forEach.call(tracked, function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
      el.addEventListener('pointerleave', function () {
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
      });
    });
  }

})();
