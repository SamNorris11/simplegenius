/* Simple Genius — sg-track.js
   Tracking and attribution layer for the September 2026 site.
   Extracted verbatim from js/site.js (production, commit e6dfaf7) so GA4, GTM,
   Meta, Google Ads events, QA-traffic skip, and conversion dedupe behave
   exactly as before. It does NOT bind any form submit handler: the page's own
   form script (home.js) submits and calls window.sgTrack.formConversion()
   only after the backend returns success. Never add PII to events. */

(function () {
  'use strict';
  if (window.sgTrack) return;

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

  function formTrackingData(form) {
    function fieldValue(name) {
      var field = form.querySelector('[name="' + name + '"]');
      return field ? field.value || '' : '';
    }
    return {
      form_id: form.id || '',
      form_source: fieldValue('source'),
      lead_source: 'Website Direct',
      page_location: fieldValue('page_url') || window.location.href || '',
      page_referrer: fieldValue('referrer') || document.referrer || '',
      utm_source: fieldValue('utm_source'),
      utm_medium: fieldValue('utm_medium'),
      utm_campaign: fieldValue('utm_campaign'),
      utm_content: fieldValue('utm_content'),
      utm_term: fieldValue('utm_term')
    };
  }

  var CONVERSION_EVENTS = {
    call_scheduled: true,
    free_brief_start: true,
    free_brief_submit: true,
    waitlist_submit: true,
    generate_lead: true,
    conversation_start: true,
    conversation_request: true,
    demo_request: true,
    newsletter_signup: true
  };

  var GOOGLE_ADS_TAG_ID = 'AW-18116883985';
  var META_STANDARD_EVENTS = {
    free_brief_submit: {
      name: 'Lead',
      params: { content_name: 'Competitor Report', content_category: 'Lead Form' }
    },
    conversation_request: {
      name: 'Contact',
      params: { content_name: "Let's Talk", content_category: 'Lead Form' }
    },
    call_scheduled: {
      name: 'Schedule',
      params: { content_name: 'Booked Consultation', content_category: 'Booking' }
    }
  };
  var META_CUSTOM_EVENTS = {
    free_brief_start: 'competitor_report_start',
    conversation_start: 'lets_talk_start',
    dwell_5s: 'dwell_5s',
    dwell_120s: 'dwell_120s'
  };

  function configureGoogleAdsTag() {
    if (window.__sgAdsTag) return;
    if (typeof window.gtag !== 'function') return;
    window.__sgAdsTag = true;
    window.gtag('config', GOOGLE_ADS_TAG_ID, {
      linker: {
        domains: ['simplegenius.com', 'www.simplegenius.com', 'consulting.simplegenius.com']
      }
    });
  }

  function trackMetaEvent(eventName, params) {
    try {
      if (typeof window.fbq !== 'function') return;
      window.fbq('track', eventName, params || {});
    } catch (e) {}
  }

  function trackMetaCustom(eventName, params) {
    try {
      if (typeof window.fbq !== 'function') return;
      window.fbq('trackCustom', eventName, params || {});
    } catch (e) {}
  }

  function isQaTraffic() {
    var touch = {};
    try {
      var history = readVisitHistory() || visitHistory;
      if (history && history.lastTouch) {
        Object.keys(history.lastTouch).forEach(function (key) {
          touch[key] = history.lastTouch[key];
        });
      }
    } catch (e) {}
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (name) {
      var value = getQueryParam(name);
      if (value) touch[name] = value;
    });
    var source = String(touch.utm_source || '').toLowerCase();
    var medium = String(touch.utm_medium || '').toLowerCase();
    var campaign = String(touch.utm_campaign || '').toLowerCase();
    if (source === 'verification' || source === 'perplexity') return true;
    if (medium === 'qa' || medium === 'integration_test') return true;
    if (campaign === 'ga4_conversion_event' || campaign === 'funnel_events' ||
        campaign === 'free_brief_crm_validation') return true;
    return false;
  }

  function whenGtagReady(cb, tries) {
    if (typeof window.gtag === 'function') {
      cb();
      return;
    }
    if ((tries || 0) >= 40) {
      cb();
      return;
    }
    window.setTimeout(function () { whenGtagReady(cb, (tries || 0) + 1); }, 50);
  }

  function trackGaEvent(eventName, params, onDone) {
    var done = typeof onDone === 'function' ? onDone : function () {};
    var isConversion = !!CONVERSION_EVENTS[eventName];

    // QA UTMs (verification/qa, perplexity/integration_test) were landing in
    // GA4's Unassigned channel and inflating key-event counts. Skip those
    // conversions so test traffic does not show up as real pipeline.
    if (isConversion && isQaTraffic()) {
      done();
      return;
    }

    if (isConversion) {
      var dedupeKey = 'sg_evt_' + eventName;
      try {
        if (window.sessionStorage.getItem(dedupeKey)) {
          done();
          return;
        }
        window.sessionStorage.setItem(dedupeKey, '1');
      } catch (e) {}
    }

    var eventData = { event: eventName };
    Object.keys(params || {}).forEach(function (key) {
      eventData[key] = params[key];
    });

    // Analytics receives behavioral and attribution metadata only. Never add
    // names, email addresses, company details, messages, or other form PII.
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);

    var metaStandard = META_STANDARD_EVENTS[eventName];
    if (metaStandard) trackMetaEvent(metaStandard.name, metaStandard.params);
    var metaCustom = META_CUSTOM_EVENTS[eventName];
    if (metaCustom) trackMetaCustom(metaCustom, { content_name: eventName });

    whenGtagReady(function () {
      if (typeof window.gtag !== 'function') {
        done();
        return;
      }
      var gaParams = {};
      Object.keys(params || {}).forEach(function (key) {
        gaParams[key] = params[key];
      });
      // Do not pass send_to. GTM already loaded G-4Z4HG583H7; a second
      // collector is what created session-less Unassigned conversions.
      gaParams.engagement_time_msec = 1;
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        done();
      }
      gaParams.event_callback = finish;
      gaParams.event_timeout = 2000;
      window.gtag('event', eventName, gaParams);
      window.setTimeout(finish, 2000);
    });
  }

  function trackFormConversion(form, payload, onDone) {
    var eventName = formConversionEvent(form);
    var eventData = {
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
    trackGaEvent(eventName, eventData, onDone);
  }

  /* Start events: fire once on first real interaction with a form that has
     data-start-event (free_brief_start, conversation_start). */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-start-event]'), function (form) {
    var startEvent = form.getAttribute('data-start-event');
    var startTracked = false;
    function trackStartOnce(e) {
      if (startTracked || !startEvent) return;
      if (e && e.target && e.target.type === 'hidden') return;
      startTracked = true;
      refreshAttributionFields(form);
      trackGaEvent(startEvent, formTrackingData(form));
      form.removeEventListener('focusin', trackStartOnce);
      form.removeEventListener('input', trackStartOnce);
      form.removeEventListener('change', trackStartOnce);
    }
    form.addEventListener('focusin', trackStartOnce);
    form.addEventListener('input', trackStartOnce);
    form.addEventListener('change', trackStartOnce);
  });

  // Calendly's inline embed posts this message only after a booking is
  // completed. The listener is harmless until a Calendly embed is present.
  // Redirect AFTER the GA hit so call_scheduled stays on this session
  // instead of arriving as a session-less Unassigned conversion.
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://calendly.com') return;
    if (!e.data || e.data.event !== 'calendly.event_scheduled') return;
    if (window.__sgCallScheduled) return;
    window.__sgCallScheduled = true;

    function goConfirmed() {
      if (/talk-schedule/i.test(window.location.pathname || '')) {
        window.location.href = '/talk-confirmed';
      }
    }

    trackGaEvent('call_scheduled', {
      booking_platform: 'calendly',
      page_location: window.location.href || '',
      page_referrer: document.referrer || '',
      utm_source: storedAttribution('utm_source'),
      utm_medium: storedAttribution('utm_medium'),
      utm_campaign: storedAttribution('utm_campaign'),
      utm_content: storedAttribution('utm_content'),
      utm_term: storedAttribution('utm_term')
    }, goConfirmed);
  });


  function trackPageIntent() {
    if (isQaTraffic()) return;
    var path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    var gaEvent = '';
    var metaContent = '';
    var metaCategory = 'High Intent';
    if (path === '/pricing') {
      gaEvent = 'pricing_view';
      metaContent = 'Pricing';
    } else if (path === '/try' || path === '/scan' || path === '/report' || path === '/free-competitor-report') {
      gaEvent = 'competitor_report_view';
      metaContent = 'Competitor Report';
    } else if (path === '/talk' || path === '/talk-schedule' || path === '/free-consultation') {
      gaEvent = 'lets_talk_view';
      metaContent = "Let's Talk";
    } else if (['/business-brain', '/competition-hub', '/strategic-insights', '/workstreams', '/security'].indexOf(path) !== -1) {
      gaEvent = 'service_view';
      metaContent = path.slice(1);
      metaCategory = 'Service';
    }
    if (!gaEvent) return;
    trackGaEvent(gaEvent, {
      page_location: window.location.href || '',
      page_path: path
    });
    trackMetaEvent('ViewContent', {
      content_name: metaContent,
      content_category: metaCategory
    });
  }

  function trackDwell() {
    if (isQaTraffic()) return;
    var now = Date.now();
    var started = now;
    try {
      started = parseInt(sessionStorage.getItem('sg_session_start') || '0', 10) || now;
      if (started === now) sessionStorage.setItem('sg_session_start', String(now));
    } catch (e) {}

    function fireDwell(eventName, storageKey) {
      try {
        if (sessionStorage.getItem(storageKey)) return;
        sessionStorage.setItem(storageKey, '1');
      } catch (e) {}
      var path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
      trackGaEvent(eventName, {
        page_location: window.location.href || '',
        page_path: path
      });
    }

    setTimeout(function () { fireDwell('dwell_5s', 'sg_dwell_5s'); }, 5000);
    var remaining = 120000 - (now - started);
    if (remaining <= 0) fireDwell('dwell_120s', 'sg_dwell_120s');
    else setTimeout(function () { fireDwell('dwell_120s', 'sg_dwell_120s'); }, remaining);
  }

  whenGtagReady(configureGoogleAdsTag);
  trackPageIntent();
  trackDwell();

  /* The competitor report now lives in the home page #report section instead
     of /try. Fire the same competitor_report_view intent (GA4 + Meta
     ViewContent) once per page when that form is actually seen. */
  (function trackReportSectionView() {
    if (isQaTraffic()) return;
    var form = document.getElementById('try-form');
    if (!form) return;
    var here = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    if (here === '/free-competitor-report') return; // page view already fires competitor_report_view
    var fired = false;
    function fire() {
      if (fired) return;
      fired = true;
      trackGaEvent('competitor_report_view', {
        page_location: window.location.href || '',
        page_path: here + '#report'
      });
      trackMetaEvent('ViewContent', {
        content_name: 'Competitor Report',
        content_category: 'High Intent'
      });
    }
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { fire(); io.disconnect(); }
      });
    }, { threshold: 0.35 });
    io.observe(form);
  })();

  window.sgTrack = {
    refresh: refreshAttributionFields,
    attr: attrSource,
    event: trackGaEvent,
    formConversion: trackFormConversion
  };
})();
