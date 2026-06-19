// Simple Genius — Shared JS
(function () {
  'use strict';

  // Safe storage shim: real sessionStorage on live domains, in-memory fallback
  // in sandboxed preview iframes where storage APIs are blocked.
  var sessionStorage = (function () {
    try {
      var t = '__sg_t__';
      window.sessionStorage.setItem(t, '1');
      window.sessionStorage.removeItem(t);
      return window.sessionStorage;
    } catch (e) {
      var mem = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  })();

  // Force light mode always
  document.documentElement.setAttribute('data-theme', 'light');

  // ── Scroll header ──
  var header = document.getElementById('site-header');
  if (header) {
    function updateHeader() {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
  }

  // ── Mobile menu ──
  var menuToggle = document.getElementById('menuToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  var menuClose  = document.getElementById('menuClose');
  if (menuToggle && mobileMenu && menuClose) {
    menuToggle.addEventListener('click', function () {
      mobileMenu.classList.add('is-open');
      menuToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    });
    function closeMenu() {
      mobileMenu.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    menuClose.addEventListener('click', closeMenu);
    mobileMenu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  }

  // ── Newsletter form (real submission handled inline in resources.html) ──
  // (left empty — page-level script POSTs to /api/newsletter-subscribe)

  // ── Attribution capture (runs every page) ──
  // Persists UTMs + click IDs + first-touch landing/referrer in sessionStorage so the
  // homepage form picks them up even if the user navigates around before submitting.
  (function captureAttribution() {
    try {
      var qp = new URLSearchParams(window.location.search);
      var trackKeys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','li_fat_id'];
      var store = JSON.parse(sessionStorage.getItem('sg_attr') || '{}');

      // First-touch landing page + referrer (only set once per session)
      if (!store.landing_page) store.landing_page = window.location.href;
      if (!store.referrer)     store.referrer     = document.referrer || '';
      if (!store.first_visit)  store.first_visit  = new Date().toISOString();

      // Last-touch UTMs / click IDs (overwrite if present in current URL)
      trackKeys.forEach(function (k) {
        var v = qp.get(k);
        if (v) store[k] = v;
      });

      sessionStorage.setItem('sg_attr', JSON.stringify(store));
    } catch (e) { /* sessionStorage blocked → silent */ }
  })();

  // GA4 client_id pulled from _ga cookie (format: GA1.1.<cid>.<ts>)
  function getGaClientId() {
    try {
      var m = document.cookie.match(/_ga=GA\d\.\d\.([0-9.]+)/);
      return m ? m[1] : '';
    } catch (e) { return ''; }
  }

  // ── Let's Talk form (home page) ──
  var lt = document.getElementById('letsTalkForm');
  if (lt) {
    // Build/find a status message element under the form
    var statusEl = document.getElementById('letsTalkMsg');
    if (!statusEl) {
      statusEl = document.createElement('p');
      statusEl.id = 'letsTalkMsg';
      statusEl.style.cssText = 'display:none;margin-top:16px;text-align:center;font-family:Inter,system-ui,sans-serif;font-size:15px;';
      lt.parentNode.appendChild(statusEl);
    }
    var ltBtn = lt.querySelector('[type="submit"]');
    var originalBtnText = ltBtn ? ltBtn.textContent : 'Schedule a Conversation';

    lt.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!lt.checkValidity()) {
        lt.reportValidity();
        return;
      }
      // Populate hidden tracking fields from sessionStorage + live cookies
      try {
        var attr = JSON.parse(sessionStorage.getItem('sg_attr') || '{}');
        ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','li_fat_id','landing_page','referrer','first_visit'].forEach(function (k) {
          var el = document.getElementById(k);
          if (el) el.value = attr[k] || '';
        });
        var pageUrlEl = document.getElementById('page_url');
        if (pageUrlEl) pageUrlEl.value = window.location.href;
        var gaEl = document.getElementById('ga_client_id');
        if (gaEl) gaEl.value = getGaClientId();
      } catch (e) { /* non-fatal */ }

      var fd = new FormData(lt);
      var payload = {};
      fd.forEach(function (v, k) { payload[k] = v; });

      if (ltBtn) { ltBtn.disabled = true; ltBtn.textContent = 'Submitting...'; }
      statusEl.style.display = 'none';

      fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (res.ok && res.data.ok) {
            // GTM: fire Lets Talk conversion event
            try {
              window.dataLayer = window.dataLayer || [];
              window.dataLayer.push({ event: 'lets_talk_submit', form_email: payload.email || '' });
            } catch (e) {}
            // Stash name+email so book.html can prefill Calendly
            try {
              sessionStorage.setItem('sg_lead', JSON.stringify({
                full_name: payload.fullName || '',
                email: payload.email || ''
              }));
            } catch (e) {}
            window.location.href = '/book.html';
          } else {
            throw new Error(res.data.error || 'Submission failed');
          }
        })
        .catch(function (err) {
          statusEl.textContent = 'Something went wrong. Please email sam@simplegenius.com or try again.';
          statusEl.style.color = '#c0392b';
          statusEl.style.display = 'block';
          if (ltBtn) { ltBtn.disabled = false; ltBtn.textContent = originalBtnText; }
          console.error('letsTalkForm error:', err);
        });
    });
  }

  // ── Scroll-triggered entrance animations (IntersectionObserver) ──
  if ('IntersectionObserver' in window) {
    var fadeEls = document.querySelectorAll('.fade-up');
    var fadeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.classList.add('is-visible');
          fadeObserver.unobserve(el);
          // Free GPU layer after the transition completes to reduce memory pressure on mobile
          setTimeout(function () { el.style.willChange = 'auto'; }, 800);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
    fadeEls.forEach(function (el) { fadeObserver.observe(el); });
  } else {
    // Fallback: show all immediately
    document.querySelectorAll('.fade-up').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // ── Hero typing animation ──
  var typingEl = document.getElementById('hero-typing-text');
  if (typingEl) {
    var phrases = [
      'What is our biggest competitive threat right now?',
      'Summarize our Q3 strategic position.',
      'Where are we losing deals and why?'
    ];
    var phraseIndex = 0;
    var charIndex = 0;
    var isDeleting = false;
    var typingSpeed = 52;   // ms per char while typing
    var deleteSpeed = 28;   // ms per char while deleting
    var pauseAfterType = 2200; // ms to show full phrase
    var pauseAfterDelete = 400; // ms before next phrase

    function typeLoop() {
      var currentPhrase = phrases[phraseIndex];

      if (!isDeleting) {
        // Add next character
        charIndex++;
        typingEl.textContent = currentPhrase.slice(0, charIndex);

        if (charIndex === currentPhrase.length) {
          // Finished typing — pause then start deleting
          isDeleting = true;
          setTimeout(typeLoop, pauseAfterType);
          return;
        }
        setTimeout(typeLoop, typingSpeed);
      } else {
        // Remove last character
        charIndex--;
        typingEl.textContent = currentPhrase.slice(0, charIndex);

        if (charIndex === 0) {
          // Finished deleting — move to next phrase
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          setTimeout(typeLoop, pauseAfterDelete);
          return;
        }
        setTimeout(typeLoop, deleteSpeed);
      }
    }

    // Start after a short initial delay
    setTimeout(typeLoop, 800);
  }

})();
