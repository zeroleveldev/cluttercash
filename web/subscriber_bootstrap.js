// Runs synchronously before Flutter routing or resource loading.
(() => {
  'use strict';
  let landing = null;
  const hash = location.hash;
  if (hash.startsWith('#subscriber_verify') || hash === '#billing_return') {
    history.replaceState(null, '', location.pathname);
    landing = hash === '#billing_return' ? 'billing_return' : (/^#subscriber_verify=[a-f0-9]{64}$/.test(hash) ? hash.slice(19) : 'invalid');
  }
  window.cluttercashSubscriberTake = () => { const result = landing; landing = null; return result; };
  const intentName = 'cluttercash.subscriber.intent';
  let intent = false;
  function requireIntent() {
    intent = true;
    localStorage.setItem(intentName, 'required');
  }
  window.cluttercashSubscriberRead = key => {
    if (key === 'intent') {
      try {
        return intent || localStorage.getItem(intentName) != null || sessionStorage.getItem('cluttercash.subscriber.session') != null ? 'required' : null;
      } catch (_) { return 'required'; }
    }
    try {
      const store = key === 'proof' ? localStorage : sessionStorage;
      const stored = store.getItem('cluttercash.subscriber.' + key);
      // Migrate legacy sessions before deleting even malformed/expired bytes.
      // If marker persistence fails, retain those bytes as reload evidence.
      if (key === 'session' && stored != null) requireIntent();
      let raw;
      try { raw = JSON.parse(stored || 'null'); }
      catch (_) { store.removeItem('cluttercash.subscriber.' + key); return null; }
      if (!raw || !Number.isSafeInteger(raw.expires) || raw.expires <= Date.now() || raw.expires > Date.now() + (key === 'proof' ? 600000 : 86400000) || !/^[a-f0-9]{64}$/.test(raw.value)) { store.removeItem('cluttercash.subscriber.' + key); return null; }
      return raw.value;
    } catch (_) { return null; }
  };
  window.cluttercashSubscriberWrite = (key, value) => {
    if (key === 'intent') {
      if (value === null) { localStorage.removeItem(intentName); intent = false; }
      else requireIntent();
      return;
    }
    if (key === 'session' && value !== null) requireIntent();
    const store = key === 'proof' ? localStorage : sessionStorage;
    const name = 'cluttercash.subscriber.' + key;
    if (value === null) store.removeItem(name);
    else store.setItem(name, JSON.stringify({ value, expires: Date.now() + (key === 'proof' ? 600000 : 86400000) }));
  };
})();
