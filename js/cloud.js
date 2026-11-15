/* ============================================================
   cloud.js — storage layer.

   Two modes, decided at start-up:
     cloud  — Firebase Authentication + Cloud Firestore. Records
              live in the project, sync to every signed-in device
              in real time, and keep working without internet
              (writes queue and go up when the line returns).
     local  — everything in this browser only, as before. Used
              when firebase-config.js is empty, when the Firebase
              scripts cannot be reached, or when the user chooses
              "use this device only".
   ============================================================ */
(function (global) {
  'use strict';

  var LOCAL_KEY = 'skp_advocate_billing_v1';
  var MODE_KEY = 'skp_billing_mode';
  var COLLS = ['clients', 'quotes', 'invoices', 'receipts', 'adjustments'];

  var cfg = global.FIREBASE_CONFIG || {};
  var hasSdk = (typeof firebase !== 'undefined' && firebase && firebase.initializeApp);
  var configured = !!(cfg.apiKey && cfg.projectId && hasSdk);

  var H = {};            // handlers supplied by app.js
  var auth = null, fs = null, unsub = [], loaded = {}, readySent = false;
  var pendingWrites = 0, fromCache = false;

  var Store = {
    mode: 'local',
    user: null,
    configured: configured,
    sdkMissing: !!(cfg.apiKey && !hasSdk)
  };

  /* ---------------- local mode ---------------- */
  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || null; }
    catch (e) { return null; }
  }
  function writeLocal(db) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(db)); return true; }
    catch (e) { return false; }
  }

  /* ---------------- status ---------------- */
  function status() {
    if (!H.onStatus) return;
    if (Store.mode === 'local') return H.onStatus('This device only', 'local');
    if (!navigator.onLine) return H.onStatus('Offline — saved here, will sync', 'off');
    if (pendingWrites) return H.onStatus('Saving…', 'wait');
    return H.onStatus('Synced', 'ok');
  }

  /* ---------------- cloud plumbing ---------------- */
  // All records sit under one "office" document. By default that is the
  // signed-in account itself. Set OFFICE_ID in firebase-config.js when a
  // second person (junior, clerk) must see the same records.
  function root() {
    return fs.collection('offices').doc(global.OFFICE_ID || Store.user.uid);
  }

  function detach() { unsub.forEach(function (u) { try { u(); } catch (e) { } }); unsub = []; }

  function attach() {
    detach();
    loaded = {}; readySent = false;

    COLLS.forEach(function (coll) {
      var u = root().collection(coll).onSnapshot(function (snap) {
        var arr = [];
        snap.forEach(function (doc) { arr.push(doc.data()); });
        pendingWrites = snap.metadata.hasPendingWrites ? 1 : 0;
        fromCache = snap.metadata.fromCache;
        loaded[coll] = true;
        if (H.onData) H.onData(coll, arr);
        maybeReady();
        status();
      }, function (err) {
        console.error('Firestore listener failed for ' + coll, err);
        if (H.onError) H.onError(err.code === 'permission-denied'
          ? 'Permission denied by the database rules. Check the rules in the Firebase console.'
          : 'Could not read ' + coll + ': ' + err.message);
      });
      unsub.push(u);
    });

    var us = root().collection('meta').doc('settings').onSnapshot(function (doc) {
      loaded.settings = true;
      if (H.onSettings) H.onSettings(doc.exists ? doc.data() : null);
      maybeReady();
      status();
    }, function (err) { console.error('settings listener', err); loaded.settings = true; maybeReady(); });
    unsub.push(us);
  }

  function maybeReady() {
    if (readySent) return;
    if (!loaded.settings) return;
    for (var i = 0; i < COLLS.length; i++) if (!loaded[COLLS[i]]) return;
    readySent = true;
    if (H.onReady) H.onReady();
  }

  /* ---------------- public API ---------------- */

  Store.start = function (handlers) {
    H = handlers || {};

    window.addEventListener('online', status);
    window.addEventListener('offline', status);

    var forcedLocal = localStorage.getItem(MODE_KEY) === 'local';

    if (!configured || forcedLocal) {
      Store.mode = 'local';
      if (H.onLocalData) H.onLocalData(readLocal());
      status();
      if (H.onReady) H.onReady();
      return;
    }

    try {
      firebase.initializeApp(cfg);
      auth = firebase.auth();
      fs = firebase.firestore();
      // keep a copy on the device so the office keeps working without internet
      fs.enablePersistence({ synchronizeTabs: true }).catch(function (e) {
        console.warn('Offline cache unavailable:', e && e.code);
      });
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () { });
    } catch (e) {
      console.error('Firebase did not start', e);
      Store.mode = 'local';
      if (H.onLocalData) H.onLocalData(readLocal());
      if (H.onError) H.onError('Firebase did not start, so this device is working on its own copy.');
      status();
      if (H.onReady) H.onReady();
      return;
    }

    Store.mode = 'cloud';
    auth.onAuthStateChanged(function (user) {
      if (user) {
        Store.user = user;
        if (H.onSignedIn) H.onSignedIn(user);
        attach();
      } else {
        Store.user = null;
        detach();
        readySent = false;
        if (H.onSignedOut) H.onSignedOut();
      }
      status();
    });
  };

  Store.signIn = function (email, password) {
    return auth.signInWithEmailAndPassword(email.trim(), password);
  };
  Store.resetPassword = function (email) {
    return auth.sendPasswordResetEmail(email.trim());
  };
  Store.signOut = function () {
    return auth.signOut();
  };
  Store.useLocalOnly = function () {
    localStorage.setItem(MODE_KEY, 'local');
    location.reload();
  };
  Store.useCloud = function () {
    localStorage.removeItem(MODE_KEY);
    location.reload();
  };

  /** Write one record. In local mode the caller passes the whole DB to mirror. */
  Store.put = function (coll, rec, wholeDb) {
    if (Store.mode === 'local') return writeLocal(wholeDb);
    pendingWrites++; status();
    root().collection(coll).doc(rec.id).set(rec)
      .then(function () { pendingWrites = Math.max(0, pendingWrites - 1); status(); })
      .catch(function (e) {
        pendingWrites = Math.max(0, pendingWrites - 1); status();
        if (H.onError) H.onError('Could not save: ' + e.message);
      });
    return true;
  };

  Store.remove = function (coll, id, wholeDb) {
    if (Store.mode === 'local') return writeLocal(wholeDb);
    pendingWrites++; status();
    root().collection(coll).doc(id).delete()
      .then(function () { pendingWrites = Math.max(0, pendingWrites - 1); status(); })
      .catch(function (e) {
        pendingWrites = Math.max(0, pendingWrites - 1); status();
        if (H.onError) H.onError('Could not delete: ' + e.message);
      });
    return true;
  };

  Store.saveSettings = function (settings, wholeDb) {
    if (Store.mode === 'local') return writeLocal(wholeDb);
    pendingWrites++; status();
    root().collection('meta').doc('settings').set(settings)
      .then(function () { pendingWrites = Math.max(0, pendingWrites - 1); status(); })
      .catch(function (e) {
        pendingWrites = Math.max(0, pendingWrites - 1); status();
        if (H.onError) H.onError('Could not save settings: ' + e.message);
      });
    return true;
  };

  /** Restore from a backup file: replace everything. */
  Store.replaceAll = function (db) {
    if (Store.mode === 'local') { writeLocal(db); return Promise.resolve(); }
    return wipeCloud().then(function () {
      var ops = [];
      COLLS.forEach(function (coll) {
        (db[coll] || []).forEach(function (rec) {
          if (rec && rec.id) ops.push({ ref: root().collection(coll).doc(rec.id), data: rec });
        });
      });
      ops.push({ ref: root().collection('meta').doc('settings'), data: db.settings || {} });
      return commitChunks(ops);
    });
  };

  function commitChunks(ops) {
    var chunks = [], i;
    for (i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
    return chunks.reduce(function (p, chunk) {
      return p.then(function () {
        var batch = fs.batch();
        chunk.forEach(function (o) { batch.set(o.ref, o.data); });
        return batch.commit();
      });
    }, Promise.resolve());
  }

  function wipeCloud() {
    var all = COLLS.concat(['meta']);
    return all.reduce(function (p, coll) {
      return p.then(function () {
        return root().collection(coll).get().then(function (snap) {
          if (snap.empty) return;
          var batch = fs.batch(), n = 0, chain = Promise.resolve();
          snap.forEach(function (doc) {
            batch.delete(doc.ref); n++;
            if (n % 400 === 0) { var b = batch; chain = chain.then(function () { return b.commit(); }); batch = fs.batch(); }
          });
          return chain.then(function () { return batch.commit(); });
        });
      });
    }, Promise.resolve());
  }

  /** the records this browser holds from offline use, if any */
  Store.localSnapshot = function () { return readLocal(); };

  Store.localRecordCount = function () {
    var d = readLocal(), n = 0;
    if (!d) return 0;
    COLLS.forEach(function (c) { n += (d[c] || []).length; });
    return n;
  };

  /** copy this device's offline records up without removing what is already there */
  Store.importLocal = function () {
    if (Store.mode !== 'cloud') return Promise.reject(new Error('Not signed in'));
    var d = readLocal();
    if (!d) return Promise.resolve(0);
    var ops = [], n = 0;
    COLLS.forEach(function (coll) {
      (d[coll] || []).forEach(function (rec) {
        if (rec && rec.id) { ops.push({ ref: root().collection(coll).doc(rec.id), data: rec }); n++; }
      });
    });
    if (d.settings) ops.push({ ref: root().collection('meta').doc('settings'), data: d.settings });
    return commitChunks(ops).then(function () { return n; });
  };

  Store.wipe = function () {
    if (Store.mode === 'local') { localStorage.removeItem(LOCAL_KEY); return Promise.resolve(); }
    return wipeCloud();
  };

  Store.refreshStatus = status;

  global.Store = Store;
})(window);
