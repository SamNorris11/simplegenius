/* Simple Genius — video.js  (homepage film unit only)
   REVISION-03 §2.2. Progressive enhancement, exactly like site.js:
     · with JavaScript off the poster plate, the question and the caption are
       all still there and readable; the play control is hidden by CSS
     · the film autoplays when it is scrolled into view, muted
     · the control unmutes it, and native controls appear with sound
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
  var btn = film.querySelector('.film__play');
  var label = film.querySelector('.film__play-label');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var src = stage ? stage.getAttribute('data-src') : null;
  var video = null;

  var say = function (text, aria) {
    if (label) label.textContent = text;
    if (btn) btn.setAttribute('aria-label', aria);
  };

  /* ---- no file yet: the placeholder is the whole behaviour --------------
     Nothing is inserted into the stage. An empty <video> with no src and no
     <source> is a media element the browser can never resolve, so it is never
     shipped: the plate, the question and the caption are the whole unit until
     a file exists. */
  if (!stage || !src) {
    if (btn) {
      btn.disabled = true;
      say('Film coming', 'The film is not published yet');
    }
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

  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) start();
        else if (!video.paused && video.muted) video.pause();
      });
    }, { threshold: 0.4 });
    io.observe(video);
  }

  if (btn) {
    say('Sound', 'Play the film with sound');
    btn.addEventListener('click', function () {
      if (video.muted) {
        video.muted = false;
        say('Mute', 'Mute the film');
        start();
      } else {
        video.muted = true;
        say('Sound', 'Play the film with sound');
      }
    });
  }
})();
