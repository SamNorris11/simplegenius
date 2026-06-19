/* =============================================
   SIMPLE GENIUS — Rebuild Enhancements JS
   Vanilla, no dependencies. Loaded with defer on all pages.
   - Interactive 8-step stepper (desktop hover/click, mobile accordion)
   - Cursor-aware radial glow on dark CTA / panels
   Cursor-reactive lift is pure CSS ([data-lift]); no JS needed.
   ============================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Interactive Stepper ---------- */
  function initStepper() {
    var stepper = document.querySelector('[data-stepper]');
    if (!stepper) return;

    var nodes = Array.prototype.slice.call(stepper.querySelectorAll('.stepper__node'));
    var panels = Array.prototype.slice.call(stepper.querySelectorAll('.stepper__panel'));
    var accHeads = Array.prototype.slice.call(stepper.querySelectorAll('.stepper__accordion-head'));

    function activate(index) {
      nodes.forEach(function (n, i) {
        n.setAttribute('aria-selected', i === index ? 'true' : 'false');
        n.tabIndex = i === index ? 0 : -1;
      });
      panels.forEach(function (p, i) {
        p.classList.toggle('is-active', i === index);
      });
      accHeads.forEach(function (h, i) {
        h.setAttribute('aria-expanded', i === index ? 'true' : 'false');
      });
    }

    nodes.forEach(function (node, i) {
      node.addEventListener('click', function () { activate(i); });
      node.addEventListener('mouseenter', function () {
        if (!reduceMotion && window.matchMedia('(min-width: 769px)').matches) activate(i);
      });
      node.addEventListener('keydown', function (e) {
        var next;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % nodes.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + nodes.length) % nodes.length;
        else return;
        e.preventDefault();
        activate(next);
        nodes[next].focus();
      });
    });

    // Mobile accordion heads toggle their panel
    accHeads.forEach(function (head, i) {
      head.addEventListener('click', function () {
        var isOpen = head.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          // collapse all
          panels.forEach(function (p) { p.classList.remove('is-active'); });
          accHeads.forEach(function (h) { h.setAttribute('aria-expanded', 'false'); });
        } else {
          activate(i);
        }
      });
    });

    activate(0); // default Step 1 expanded
  }

  /* ---------- Cursor-aware radial glow on dark panels ---------- */
  function initGlow() {
    if (reduceMotion) return;
    var panels = document.querySelectorAll('.glow-panel');
    panels.forEach(function (panel) {
      panel.addEventListener('pointermove', function (e) {
        var rect = panel.getBoundingClientRect();
        var x = ((e.clientX - rect.left) / rect.width) * 100;
        var y = ((e.clientY - rect.top) / rect.height) * 100;
        panel.style.setProperty('--gx', x + '%');
        panel.style.setProperty('--gy', y + '%');
        panel.classList.add('is-glowing');
      });
      panel.addEventListener('pointerleave', function () {
        panel.classList.remove('is-glowing');
      });
    });
  }

  /* ---------- "Pattern We Kept Seeing" cards ----------
     R4: removed the expand-on-hover / expand-on-click behavior. All three
     cards now display their full content at all times (static 3-up grid).
     No JS interaction governs content visibility anymore. */
  function initPattern() {
    var list = document.querySelector('[data-pattern]');
    if (!list) return;
    // Ensure every card shows its full content from page load.
    Array.prototype.slice.call(list.querySelectorAll('.pattern-x__item'))
      .forEach(function (item) { item.setAttribute('aria-expanded', 'true'); });
  }

  /* ---------- R4: scroll-in reveal for "Why Simple Genius Exists" cards ----------
     Staggered 80ms each. Scoped to .why-reveal so it does not collide with the
     site-wide (disabled) .fade-up rule. */
  function initWhyReveal() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.why-card.why-reveal'));
    if (!cards.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      cards.forEach(function (c) { c.classList.add('is-revealed'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var card = entry.target;
        var idx = cards.indexOf(card);
        setTimeout(function () { card.classList.add('is-revealed'); }, Math.max(0, idx) * 80);
        obs.unobserve(card);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    cards.forEach(function (c) { obs.observe(c); });
  }

  function boot() {
    initStepper();
    initGlow();
    initPattern();
    initWhyReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
