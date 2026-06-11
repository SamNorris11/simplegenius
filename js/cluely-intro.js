// === Cluely-style intro animation — pure CSS-transition based, no animation library ===
// More reliable than Motion's animate() across environments. Each word gets a
// CSS transition, then we toggle its transform from "down" to "up" with a per-word
// stagger via setTimeout. The hero graphic does the same in 3D.

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // Cluely's expo-out

// Mobile detection — used to tune intro params for gentler feel on phones.
// Desktop keeps the full original Cluely intro tuning.
const IS_MOBILE = window.matchMedia("(max-width: 768px)").matches;

document.documentElement.classList.add("cluely-ready");

function splitWords(el) {
  if (el.dataset.clSplit === "1") return Array.from(el.querySelectorAll(".cl-word"));
  const fullText = el.textContent.trim();
  el.setAttribute("aria-label", fullText);

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    const text = node.nodeValue;
    if (!text || !text.trim()) return;
    const frag = document.createDocumentFragment();
    const parts = text.split(/(\s+)/);
    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        return;
      }
      const mask = document.createElement("span");
      mask.className = "cl-word-mask";
      mask.setAttribute("aria-hidden", "true");
      const inner = document.createElement("span");
      inner.className = "cl-word";
      inner.textContent = part;
      mask.appendChild(inner);
      frag.appendChild(mask);
    });
    node.parentNode.replaceChild(frag, node);
  });

  el.dataset.clSplit = "1";
  return Array.from(el.querySelectorAll(".cl-word"));
}

/**
 * Animate split words upward into view using CSS transitions.
 * Returns the total duration in ms (for chaining).
 */
function animateWords(el, { stagger = 0.12, delay = 0, duration = 0.95, fromEm = 1.25 } = {}) {
  const words = splitWords(el);

  // Step 1: paint each word in its initial DOWN position with no transition yet
  words.forEach((w) => {
    const fontPx = parseFloat(getComputedStyle(w).fontSize) || 16;
    const fromPx = fromEm * fontPx;
    w.style.transition = "none";
    w.style.transform = `translateY(${fromPx}px)`;
  });

  // Force browser to commit the initial state (a real paint) BEFORE we change it
  // This guarantees the transition has something to animate FROM.
  // Reading offsetHeight is the classic flush trick.
  if (words[0]) void words[0].offsetHeight;

  // Step 2: in the next frame, enable transitions and trigger the move to 0
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      words.forEach((w, i) => {
        const wordDelay = (delay + i * stagger) * 1000;
        w.style.transition = `transform ${duration}s ${EASE} ${wordDelay}ms`;
        w.style.transform = "translateY(0)";
      });
    });
  });

  return (delay + words.length * stagger + duration) * 1000;
}

function fadeSlide(el, { fromY = 16, delay = 0, duration = 0.75 } = {}) {
  el.style.transition = "none";
  el.style.opacity = "0";
  el.style.transform = `translateY(${fromY}px)`;
  void el.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${duration}s ${EASE} ${delay * 1000}ms, transform ${duration}s ${EASE} ${delay * 1000}ms`;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  });
}

function flyInZ(el, { fromZ = 350, delay = 0, duration = 1.2 } = {}) {
  el.style.transition = "none";
  el.style.opacity = "0";
  el.style.transform = `translateZ(${fromZ}px)`;
  void el.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${duration}s ${EASE} ${delay * 1000}ms, transform ${duration}s ${EASE} ${delay * 1000}ms`;
      el.style.opacity = "1";
      el.style.transform = "translateZ(0)";
    });
  });
}

function runHeroIntro() {
  const h1 = document.querySelector(".hero__heading");
  const sub = document.querySelector(".hero__sub");
  const cta = document.querySelector(".hero__cta");
  const graphic = document.querySelector(".hero > .sgui");

  if (!h1) return;

  // Mobile gets gentler params: shorter travel, slightly longer duration,
  // tighter stagger — reads as smooth, not stiff or jumpy.
  const h1Params = IS_MOBILE
    ? { stagger: 0.07, delay: 0.05, duration: 0.9,  fromEm: 0.45 }
    : { stagger: 0.11, delay: 0.05, duration: 0.85, fromEm: 1.0  };

  const subParams = IS_MOBILE
    ? { stagger: 0.03, delay: 0.32, duration: 0.75, fromEm: 0.3 }
    : { stagger: 0.04, delay: 0.38, duration: 0.7,  fromEm: 0.5 };

  const ctaDur     = IS_MOBILE ? 0.7  : 0.6;
  const ctaFromY   = IS_MOBILE ? 10   : 14;
  const graphicZ   = IS_MOBILE ? 90   : 180;
  const graphicDur = IS_MOBILE ? 1.0  : 0.95;

  // H1 — per-word rise
  const h1Ms = animateWords(h1, h1Params);

  // Subhead — starts mid-H1
  if (sub) animateWords(sub, subParams);

  // CTA — lands as last H1 word settles
  if (cta) fadeSlide(cta, { fromY: ctaFromY, delay: (h1Ms / 1000) - 0.2, duration: ctaDur });

  // Hero graphic — desktop uses Z-fly; mobile skips so CSS scale transform applies cleanly.
  if (graphic) {
    if (IS_MOBILE) {
      // Just fade in; no transform override so the CSS scale-down on mobile works.
      graphic.style.opacity = "0";
      graphic.style.transition = `opacity ${graphicDur}s ${EASE} ${(h1Ms / 1000) - 0.05}s`;
      requestAnimationFrame(() => { graphic.style.opacity = "1"; });
    } else {
      flyInZ(graphic, { fromZ: graphicZ, delay: (h1Ms / 1000) - 0.05, duration: graphicDur });
    }
  }
}

function setupScrollReveals() {
  // On mobile, scroll-reveal animations on section headings feel like too much.
  // Disable entirely — desktop keeps the full intro feel.
  if (IS_MOBILE) {
    // Mobile bails on the reveal animation, but the global rule
    // `html.cluely-ready h2 { opacity:0 }` would leave headings invisible.
    // Set every h2 to fully visible so nothing is hidden.
    document.querySelectorAll("h2").forEach((h) => { h.style.opacity = "1"; });
    return;
  }

  const headings = document.querySelectorAll("h2");
  if (!headings.length || !("IntersectionObserver" in window)) {
    headings.forEach((h) => h.setAttribute("data-cl-split", "1"));
    return;
  }
  // Mobile: slower, shorter, tighter — feels like text gently settling, not jumping.
  const params = IS_MOBILE
    ? { stagger: 0.025, delay: 0, duration: 0.75, fromEm: 0.25 }
    : { stagger: 0.06,  delay: 0, duration: 0.65, fromEm: 0.6  };
  // Mobile also triggers EARLIER (more rootMargin) so the animation completes
  // before the heading is fully on screen — user sees a settled heading, not motion.
  const ioOptions = IS_MOBILE
    ? { rootMargin: "0px 0px -20% 0px", threshold: 0.05 }
    : { rootMargin: "0px 0px -100px 0px", threshold: 0.1 };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.clRevealed === "1") return;
        el.dataset.clRevealed = "1";
        animateWords(el, params);
        io.unobserve(el);
      });
    },
    ioOptions
  );
  headings.forEach((h) => io.observe(h));
}

function boot() {
  const start = () => {
    runHeroIntro();
    setupScrollReveals();
  };
  if (document.fonts && document.fonts.ready) {
    const fallback = setTimeout(start, 400);
    document.fonts.ready.then(() => { clearTimeout(fallback); start(); });
  } else {
    start();
  }
}

// Reduced motion — set everything to final state immediately
if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.classList.remove("cluely-ready");
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}


