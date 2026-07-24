// phntm-supabase.js — cloud sync + auth for PHNTM.
// Backs the app's existing localStorage keys with a single Supabase key-value table
// (one row per user per key), so data is identical on any device you sign in from.
// Loads the Supabase client from a CDN as an ES module; if that fails, the app keeps
// working from localStorage (offline mode) and simply doesn't sync.
(function () {
  var SUPABASE_URL = 'https://gpprkhckltrcqjdnhpbl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_mBsR_F44Nsf7SZ6bT1PAFA_2fqUaabx';

  var _client = null;
  var _readyP = (async function () {
    try {
      var mod = await import('https://esm.sh/@supabase/supabase-js@2');
      _client = mod.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'phntm-sb-auth' }
      });
      return _client;
    } catch (e) {
      console.warn('[PHNTM] Supabase client unavailable — running offline (localStorage only).', e);
      return null;
    }
  })();

  async function ready() { return _readyP; }

  async function currentUser() {
    var c = await ready(); if (!c) return null;
    try { var r = await c.auth.getUser(); return (r && r.data && r.data.user) || null; }
    catch (e) { return null; }
  }

  var auth = {
    ready: ready,
    currentUser: currentUser,
    async signIn(email, password) {
      var c = await ready(); if (!c) throw new Error('Auth unavailable.');
      var r = await c.auth.signInWithPassword({ email: email, password: password });
      if (r.error) throw r.error;
      return r.data;
    },
    async signUp(email, password, name) {
      var c = await ready(); if (!c) throw new Error('Auth unavailable.');
      var r = await c.auth.signUp({ email: email, password: password, options: { data: { name: name || '' } } });
      if (r.error) throw r.error;
      try { if (r.data && r.data.session) await cloud.set('phntm-name', name || ''); } catch (e) {}
      return r.data; // r.data.session is null when email confirmation is required
    },
    async resetPassword(email) {
      var c = await ready(); if (!c) throw new Error('Auth unavailable.');
      var r = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (r.error) throw r.error;
      return true;
    },
    async signOut() { var c = await ready(); if (c) { try { await c.auth.signOut(); } catch (e) {} } }
  };

  var cloud = {
    ready: ready,
    currentUser: currentUser,
    // value may be a JSON string (as passed to localStorage.setItem) or a raw value.
    async set(key, value) {
      var c = await ready(); if (!c) return false;
      var u = await currentUser(); if (!u) return false;
      var v = value;
      if (typeof value === 'string') { try { v = JSON.parse(value); } catch (e) { v = value; } }
      var r = await c.from('kv').upsert(
        { user_id: u.id, k: key, v: v, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,k' }
      );
      if (r.error) console.warn('[PHNTM] cloud save failed for ' + key, r.error);
      return !r.error;
    },
    // returns { key: value } for every stored key, or null when offline / signed out.
    async loadAll() {
      var c = await ready(); if (!c) return null;
      var u = await currentUser(); if (!u) return null;
      var r = await c.from('kv').select('k,v').eq('user_id', u.id);
      if (r.error) { console.warn('[PHNTM] cloud load failed', r.error); return null; }
      var out = {};
      (r.data || []).forEach(function (row) { out[row.k] = row.v; });
      return out;
    }
  };

  window.PHNTM = window.PHNTM || {};
  window.PHNTM.auth = auth;
  window.PHNTM.cloud = cloud;
})();
