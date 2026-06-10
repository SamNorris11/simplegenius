// Simple Genius — Shared JS
(function () {
  'use strict';

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
