/* Simple Genius — video.js  (homepage film unit only)
   REVISION-03 §2.2. Progressive enhancement, exactly like site.js:
     · with JavaScript off the poster plate, the question and the caption are
       all still there and readable; the play control is hidden by CSS
     · the film autoplays when it is scrolled into view, muted
     · scrolling it out of view pauses it. back within 10 seconds, it resumes
       right where it left off; away 10 seconds or longer, it starts over from
       0:00 the next time it comes into view
     · clicking anywhere on the film toggles sound on/off, and the "click to
       unmute" prompt shows or hides to match — playback never restarts, it
       just keeps going from where the click caught it
     · prefers-reduced-motion: no autoplay at all, play stays a deliberate act
     · until the MP4 exists there is no data-src, so the composed plate stays
       and the control declares itself unavailable rather than lying

   To go live: add data-src="video/…mp4" (and optionally data-poster="img/…jpg")
   to .film__stage. The <video> element is built here, at that point, and never
   before: shipping an empty media element leaves the browser holding a source
   it can never resolve. Nothing else on the page has to change. */
(function () {
  'use strict';

  var film = document.querySelector('.film');
  if (!film) return;

  var stage = film.querySelector('.film__stage');
  var btn = film.querySelector('.film__unmute');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var src = stage ? stage.getAttribute('data-src') : null;
  var video = null;

  /* ---- no file yet: the placeholder is the whole behaviour --------------
     Nothing is inserted into the stage. An empty <video> with no src and no
     <source> is a media element the browser can never resolve, so it is never
     shipped: the plate, the question and the caption are the whole unit until
     a file exists. */
  if (!stage || !src) {
    if (btn) btn.remove();
    return;
  }

  /* ---- a file exists: become a real player ----------------------------- */
  film.classList.add('is-live');
  video = document.createElement('video');
  video.className = 'film__video';
  video.muted = true;
  video.loop = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  var poster = stage.getAttribute('data-poster');
  if (poster) video.poster = poster;
  var q = film.querySelector('.film__q');
  if (q && q.id) video.setAttribute('aria-describedby', q.id);
  video.src = src;
  stage.insertBefore(video, stage.firstChild);

  var start = function () {
    var p = video.play();
    if (p && typeof p.catch === 'function') p.catch(function () { /* blocked; the control still works */ });
  };

  var AWAY_RESET_MS = 10000;
  var awaySince = null;

  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (awaySince !== null && Date.now() - awaySince >= AWAY_RESET_MS) {
            video.currentTime = 0;
          }
          awaySince = null;
          start();
        } else if (!video.paused) {
          video.pause();
          awaySince = Date.now();
        }
      });
    }, { threshold: 0.4 });
    io.observe(video);
  }

  /* the prompt shows exactly when the film is muted, hides exactly when it
     is not — no separate on/off markup needed, one state drives both. */
  var syncPrompt = function () {
    if (btn) btn.classList.toggle('film__unmute--hidden', !video.muted);
  };
  syncPrompt();

  /* click anywhere on the film: toggle sound, sync the prompt, keep playing
     from the current position. Never resets the clock. */
  film.addEventListener('click', function () {
    video.muted = !video.muted;
    syncPrompt();
    start();
  });
})();
