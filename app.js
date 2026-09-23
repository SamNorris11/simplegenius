(function () {
  const root = document.documentElement;
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navPanel = document.getElementById('mobile-nav');
  const header = document.querySelector('.site-header');
  const modal = document.getElementById('video-modal');
  const frame = document.querySelector('[data-modal-frame]');
  const year = document.querySelector('[data-year]');
  const form = document.querySelector('[data-talk-form]');


  function setNav(open) {
    if (!navPanel || !navToggle) return;
    navPanel.hidden = !open;
    navPanel.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  navToggle && navToggle.addEventListener('click', () => setNav(navPanel.hidden));
  navPanel &&
    navPanel.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setNav(false));
    });

  window.addEventListener(
    'scroll',
    () => {
      header && header.classList.toggle('is-scrolled', window.scrollY > 8);
    },
    { passive: true }
  );

  if (year) year.textContent = String(new Date().getFullYear());

  function closeModal() {
    if (!modal || !frame) return;
    modal.hidden = true;
    frame.replaceChildren();
  }

  function openVideo(id) {
    if (!modal || !frame || !id) return;
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1';
    iframe.title = 'Trent Hiott video';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    frame.replaceChildren(iframe);
    modal.hidden = false;
  }

  document.querySelectorAll('[data-video]').forEach((el) => {
    el.addEventListener('click', () => openVideo(el.getAttribute('data-video')));
  });
  const closer = document.querySelector('[data-modal-close]');
  closer && closer.addEventListener('click', closeModal);
  modal &&
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      setNav(false);
    }
  });

  form &&
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const lines = [
        'First name: ' + data.get('first'),
        'Last name: ' + data.get('last'),
        'Email: ' + data.get('email'),
        'Phone: ' + data.get('phone'),
        'Company: ' + data.get('company'),
        'Website: ' + data.get('website'),
        'Approximate company revenue: ' + data.get('revenue'),
        '',
        'What are you trying to accomplish right now?',
        data.get('goal'),
        '',
        "What's getting in the way?",
        data.get('block'),
      ];
      const href =
        'mailto:sam@simplegenius.com?subject=' +
        encodeURIComponent("Let's Talk") +
        '&body=' +
        encodeURIComponent(lines.join('\n'));
      window.location.href = href;
      const note = document.querySelector('[data-form-success]');
      if (note) note.hidden = false;
    });
})();
