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
     referrer, and GA client id cookie. It runs on page load and again at
     submit time because GA may create its cookie after this script loads. */
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

  /* -------------------------------------------- first-party visit history ---
     GA4 keeps the complete event stream. This small browser record keeps only
     the useful sales context so it can be attached when a visitor submits a
     form and becomes a known CRM lead. */
  var VISIT_HISTORY_KEY = 'sg_visit_history_v1';
  var VISIT_HISTORY_DAYS = 90;

  function readVisitHistory() {
    try {
      var saved = JSON.parse(window['local'+'Storage'].getItem(VISIT_HISTORY_KEY) || 'null');
      if (!saved || !saved.firstVisit) return null;
      var age = Date.now() - new Date(saved.firstVisit).getTime();
      if (!isFinite(age) || age > VISIT_HISTORY_DAYS * 24 * 60 * 60 * 1000) {
        window['local'+'Storage'].removeItem(VISIT_HISTORY_KEY);
        return null;
      }
      return saved;
    } catch (e) { return null; }
  }

  function writeVisitHistory(history) {
    try {
      window['local'+'Storage'].setItem(VISIT_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      // Tracking must never block the page or form if storage is unavailable.
    }
  }

  function currentTouch() {
    var touch = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'li_fat_id'].forEach(function (name) {
      var value = getQueryParam(name);
      if (value) touch[name] = value;
    });
    return touch;
  }

  function recordWebsiteVisit() {
    var now = new Date();
    var nowIso = now.toISOString();
    var path = (window.location.pathname || '/') + (window.location.hash || '');
    var day = nowIso.slice(0, 10);
    var history = readVisitHistory();
    var touch = currentTouch();

    if (!history) {
      history = {
        firstVisit: nowIso,
        lastVisit: nowIso,
        landingPage: path,
        originalReferrer: document.referrer || '',
        firstTouch: touch,
        lastTouch: touch,
        sessionCount: 1,
        pageViews: 0,
        days: [],
        recentPages: []
      };
    } else {
      var previousVisit = new Date(history.lastVisit || history.firstVisit).getTime();
      if (!isFinite(previousVisit) || Date.now() - previousVisit > 30 * 60 * 1000) {
        history.sessionCount = (Number(history.sessionCount) || 0) + 1;
      }
      if (Object.keys(touch).length) {
        history.lastTouch = touch;
        if (!history.firstTouch || !Object.keys(history.firstTouch).length) {
          history.firstTouch = touch;
        }
      }
    }

    history.lastVisit = nowIso;
    history.pageViews = (Number(history.pageViews) || 0) + 1;
    history.days = Array.isArray(history.days) ? history.days : [];
    if (history.days.indexOf(day) === -1) history.days.push(day);
    history.recentPages = Array.isArray(history.recentPages) ? history.recentPages : [];
    history.recentPages.push({
      path: path,
      title: (document.title || '').slice(0, 120),
      visitedAt: nowIso
    });
    history.recentPages = history.recentPages.slice(-20);
    writeVisitHistory(history);
    return history;
  }

  var visitHistory = recordWebsiteVisit();

  function storedAttribution(name) {
    var history = readVisitHistory() || visitHistory;
    if (!history) return '';
    if (name === 'landing_page') return history.landingPage || '';
    if (name === 'first_visit') return history.firstVisit || '';
    if (name === 'referrer') return history.originalReferrer || '';
    if (history.firstTouch && history.firstTouch[name]) return history.firstTouch[name];
    return '';
  }

  function buildVisitSummary() {
    var history = readVisitHistory() || visitHistory;
    if (!history) return '';
    return JSON.stringify({
      firstVisit: history.firstVisit || '',
      lastVisit: history.lastVisit || '',
      landingPage: history.landingPage || '',
      originalReferrer: history.originalReferrer || '',
      firstTouch: history.firstTouch || {},
      lastTouch: history.lastTouch || {},
      sessionCount: Number(history.sessionCount) || 1,
      pageViews: Number(history.pageViews) || 1,
      daysVisited: Array.isArray(history.days) ? history.days.length : 1,
      recentPages: Array.isArray(history.recentPages) ? history.recentPages.slice(-12) : []
    });
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
        return getQueryParam(name) || storedAttribution(name);
      case 'page_url':      return window.location.href || '';
      case 'referrer':      return document.referrer || storedAttribution('referrer');
      case 'ga_client_id':  return getGaClientId();
      case 'landing_page':  return storedAttribution('landing_page') || window.location.pathname || '';
      case 'first_visit':   return storedAttribution('first_visit') || new Date().toISOString();
      case 'visit_summary': return buildVisitSummary();
      default: return '';
    }
  }
  function refreshAttributionFields(scope) {
    var root = scope || document;
    Array.prototype.forEach.call(root.querySelectorAll('input[data-attr]'), function (input) {
      var name = input.getAttribute('data-attr');
      var val = attrSource(name);
      if (!val) return;

      // Keep the original landing attribution, but refresh values that can
      // change or become available after the initial page load.
      if (!input.value || name === 'ga_client_id' || name === 'page_url' ||
          name === 'referrer' || name === 'visit_summary') {
        input.value = val;
      }
    });
  }
  refreshAttributionFields(document);

  function formConversionEvent(form) {
    var explicit = form.getAttribute('data-conversion-event');
    if (explicit) return explicit;
    var source = String(
      (form.querySelector('[name="source"]') || {}).value || ''
    ).toLowerCase();
    if (source === 'try-simple-genius-free') return 'free_brief_submit';
    if (source === 'lets-talk' || source === 'conversation-request') {
      return 'conversation_request';
    }
    if (source === 'waitlist') return 'waitlist_submit';
    return 'generate_lead';
  }

  function trackFormConversion(form, payload) {
    var eventName = formConversionEvent(form);
    var eventData = {
      event: eventName,
      form_id: form.id || '',
      form_source: payload.source || '',
      lead_source: 'Website Direct',
      page_location: payload.page_url || window.location.href || '',
      page_referrer: payload.referrer || document.referrer || '',
      utm_source: payload.utm_source || '',
      utm_medium: payload.utm_medium || '',
      utm_campaign: payload.utm_campaign || '',
      utm_content: payload.utm_content || '',
      utm_term: payload.utm_term || ''
    };

    // Never send names, email addresses, company details, or other form PII
    // to Google Analytics. GTM receives only conversion and attribution data.
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);

    // GA4 is loaded through the sitewide GTM container. Send the same
    // successful conversion directly to GA4 so it does not depend on a
    // separate custom-event trigger being created in the GTM workspace.
    if (typeof window.gtag !== 'function') {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    var gaParams = {};
    Object.keys(eventData).forEach(function (key) {
      if (key !== 'event') gaParams[key] = eventData[key];
    });
    window.gtag('event', eventName, gaParams);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.form'), function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return;

      refreshAttributionFields(form);

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
          trackFormConversion(form, payload);
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

  /* -----------------------------------------------------------------------
     LIGHTBOX — clickable software screenshots (Change Order §2.3)
     Opt in by adding class "shot--zoomable" to any <figure class="shot">.
     Caption comes from data-caption or the child <figcaption>.
     ----------------------------------------------------------------------- */
  var lb = {
    root: null,
    img: null,
    cap: null,
    trigger: null,
    open: function (fig) {
      if (!this.root) this.build();
      var img = fig.querySelector('img');
      if (!img) return;
      var src = img.currentSrc || img.src;
      var alt = img.getAttribute('alt') || '';
      var caption = fig.getAttribute('data-caption')
        || (fig.querySelector('figcaption') && fig.querySelector('figcaption').textContent)
        || alt;
      this.img.src = src;
      this.img.setAttribute('alt', alt);
      this.cap.textContent = caption;
      this.trigger = fig;
      this.root.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
      var close = this.root.querySelector('.lightbox__close');
      if (close) close.focus();
    },
    close: function () {
      if (!this.root) return;
      this.root.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-open');
      if (this.trigger) {
        var focusEl = this.trigger.querySelector('button, a, [tabindex]') || this.trigger;
        try { focusEl.focus(); } catch (e) {}
        this.trigger = null;
      }
    },
    build: function () {
      var root = document.createElement('div');
      root.className = 'lightbox';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', 'Screenshot preview');
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML =
        '<div class="lightbox__inner">' +
          '<button type="button" class="lightbox__close" aria-label="Close">&times;</button>' +
          '<img class="lightbox__img" alt="">' +
          '<p class="lightbox__caption"></p>' +
        '</div>';
      document.body.appendChild(root);
      this.root = root;
      this.img = root.querySelector('.lightbox__img');
      this.cap = root.querySelector('.lightbox__caption');
      var self = this;
      root.addEventListener('click', function (e) {
        if (e.target === root || e.target.classList.contains('lightbox__close')) {
          self.close();
        }
      });
    }
  };

  var ZOOM_SELECTOR = '.shot--zoomable, .hiw-stack__shot, .winframe';
  document.addEventListener('click', function (e) {
    var fig = e.target.closest && e.target.closest(ZOOM_SELECTOR);
    if (!fig) return;
    e.preventDefault();
    lb.open(fig);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lb.root && lb.root.getAttribute('aria-hidden') === 'false') {
      lb.close();
    }
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.matches && document.activeElement.matches(ZOOM_SELECTOR)) {
      e.preventDefault();
      lb.open(document.activeElement);
    }
  });
  Array.prototype.forEach.call(document.querySelectorAll(ZOOM_SELECTOR), function (fig) {
    if (!fig.hasAttribute('tabindex')) fig.setAttribute('tabindex', '0');
    if (!fig.hasAttribute('role')) fig.setAttribute('role', 'button');
    if (!fig.hasAttribute('aria-label')) {
      var img = fig.querySelector('img');
      if (img && img.alt) fig.setAttribute('aria-label', 'Enlarge screenshot: ' + img.alt.split('.')[0]);
    }
    fig.classList.add('is-zoomable');
  });

})();

/* ------------------------------------------------------------------ */
/* Guided Setup toggle                                                */
/* ------------------------------------------------------------------ */
(function () {
  var roots = document.querySelectorAll('[data-gs-toggle-root]');
  if (!roots.length) return;

  roots.forEach(function (root) {
    var sw = root.querySelector('[data-gs-switch]');
    if (!sw) return;

    // Find the associated .plans grid. Prefer the closest .plans that shares a
    // parent container with the toggle. This keeps the homepage and pricing
    // page independent.
    var container = root.closest('.container, section') || document;
    var priceEls = container.querySelectorAll('[data-gs-price]');
    var addons   = container.querySelectorAll('[data-gs-addon]');
    if (!priceEls.length) return;

    var isCheckbox = sw.tagName === 'INPUT' && sw.type === 'checkbox';

    function apply(on) {
      if (isCheckbox) {
        if (sw.checked !== !!on) sw.checked = !!on;
      } else {
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
      }

      Array.prototype.forEach.call(priceEls, function (el) {
        var target = on ? el.getAttribute('data-guided') : el.getAttribute('data-base');
        if (target === null) return;
        if (el.textContent === target) return;
        // Subtle fade-swap
        el.classList.add('is-gs-changing');
        setTimeout(function () {
          el.textContent = target;
          el.classList.remove('is-gs-changing');
        }, 160);
      });

      Array.prototype.forEach.call(addons, function (el) {
        if (on) el.removeAttribute('hidden');
        else    el.setAttribute('hidden', '');
      });
    }

    if (isCheckbox) {
      sw.addEventListener('change', function () {
        apply(sw.checked);
      });
    } else {
      sw.addEventListener('click', function (e) {
        e.preventDefault();
        apply(sw.getAttribute('aria-checked') !== 'true');
      });
      sw.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          apply(sw.getAttribute('aria-checked') !== 'true');
        }
      });
    }

    // Explicit default OFF
    apply(false);
  });
})();
