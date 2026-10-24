/**
 * Read-only web app over the "[WH] Daily CPO EG" sheet for the CPO site.
 *
 * Reading the sheet takes a minute or more, so the script keeps a snapshot of the tabs it needs
 * (a gzipped file in the owner's Drive) and answers every request from it. refreshSnapshot runs
 * every hour from a trigger; a request rebuilds it only when it is missing or older than 3 hours.
 *
 * Setup (once): paste this file > Save > pick installTrigger in the toolbar > Run > allow access.
 * Then Deploy > New deployment (or Manage deployments > Edit > Version: New version), Web app,
 * Execute as: Me, Who has access: Anyone. The /exec URL goes in config.js.
 *
 * GET ?action=range&from=YYYY-MM-DD&to=YYYY-MM-DD  dashboard numbers + Box Lost totes + evidence rows
 *     (no from/to: the last 7 days up to the latest date in the Missing tab)
 * GET ?action=tote&q=TGI64D09XXXXEG_v12              every row for one tote (any version) or transfer (TR-...)
 * GET ?action=status                                 when the snapshot was built and how long each tab took
 * Add &fresh=1 to skip the 10-minute answer cache, &rebuild=1 to read the sheet again first.
 */
const CPO_SHEET_ID = '1v7iTcS4nE9mxWheZB7Iv-G2zLSGuyfEvripv_oImV4A';
const SNAPSHOT_NAME = 'CPO site snapshot (used by the CPO site, do not edit)';
const SNAPSHOT_MAX_AGE_MS = 3 * 60 * 60 * 1000;
// Keeps the snapshot file under Drive's 10 MB limit for text content as the tabs grow
const KEEP_DAYS = 62;
const CACHE_SECONDS = 600;
const CACHE_CHUNK = 45000;

let book = null;
let tz = 'Africa/Cairo';
let snap = null;

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    const action = p.action || 'range';
    if (p.rebuild) refreshSnapshot();
    if (action === 'status') return json_(JSON.stringify(status_()));
    const builtAt = PropertiesService.getScriptProperties().getProperty('SNAP_AT') || '';
    const key = ['cpo2', builtAt, action, p.from || '', p.to || '', String(p.q || '').trim().toUpperCase()].join('|');
    const hit = p.fresh ? null : cacheGet_(key);
    if (hit) return json_(hit);
    const out = action === 'tote' ? searchTote_(p.q) : rangeData_(p.from, p.to);
    out.ok = true;
    out.generatedAt = new Date().toISOString();
    out.snapshotAt = snapshot_().builtAt;
    const text = JSON.stringify(out);
    cachePut_(key, text);
    return json_(text);
  } catch (err) {
    return json_(JSON.stringify({ ok: false, error: String((err && err.message) || err) }));
  }
}

// ---------- snapshot ----------

// Trigger target: read the sheet and save a new snapshot.
function refreshSnapshot() {
  const lock = LockService.getScriptLock();
  lock.waitLock(5 * 60 * 1000);
  try {
    // another run may have just rebuilt it while this one waited for the lock
    const at = PropertiesService.getScriptProperties().getProperty('SNAP_AT');
    if (at && Date.now() - new Date(at).getTime() < 2 * 60 * 1000) {
      snap = loadSnapshot_();
      if (snap) return snap.builtAt;
    }
    snap = readSheet_();
    saveSnapshot_(snap);
  } finally {
    lock.releaseLock();
  }
  return snap.builtAt;
}

// Run once from the editor: hourly refresh plus a first snapshot.
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshSnapshot')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshSnapshot').timeBased().everyHours(1).create();
  return refreshSnapshot();
}

function snapshot_() {
  if (snap) return snap;
  snap = loadSnapshot_();
  if (!snap || Date.now() - new Date(snap.builtAt).getTime() > SNAPSHOT_MAX_AGE_MS) refreshSnapshot();
  return snap;
}

function status_() {
  const s = snapshot_();
  return { ok: true, builtAt: s.builtAt, buildMs: s.buildMs, timings: s.timings, latest: s.latest, since: s.since, updated: s.updated,
    rows: { lost: s.lost.length, missing: s.miss.length, mtd: s.mtd.length, wc: s.wc.length } };
}

function readSheet_() {
  const t0 = Date.now();
  const timings = {};
  const timed = (name, f) => { const s = Date.now(); const v = f(); timings[name] = Date.now() - s; return v; };
  const dsNames = {};
  // [awb, transfer, wh, ds, dsName, day, qty, user, value, lossType]
  // user (released_user) is left empty: the web app is public and the site never shows it
  const lost = timed('Tote Missing', () => values_('Tote Missing', 12)).filter(r => str_(r[0])).map(r => {
    const ds = str_(r[3]);
    let name = str_(r[4]);
    if (name.length >= 40) name = '';
    if (ds && name && !dsNames[ds]) dsNames[ds] = name;
    return [str_(r[0]), str_(r[1]), str_(r[2]), ds, name, day_(r[5]), num_(r[6]), '', num_(r[9]), str_(r[11])];
  });
  // [transfer, awb, day, wh, ds, category, barcode, missV, dmgV, excV, missQ, dmgQ, excQ]
  const miss = timed('Missing', () => values_('Missing', 14)).filter(r => str_(r[1])).map(r => [
    str_(r[0]), str_(r[1]), day_(r[2]), str_(r[4]), str_(r[5]), str_(r[6]), str_(r[7]),
    round4_(num_(r[8])), round4_(num_(r[9])), round4_(num_(r[10])), num_(r[11]), num_(r[12]), num_(r[13])]);
  // [transfer, awb, day, wh, ds, category, barcode, missV, expV, missQ, expQ, boxLostCheck, wholeSku]
  const mtd = timed('MTD Item level', () => values_('MTD Item level', 14)).filter(r => str_(r[1])).map(r => [
    str_(r[0]), str_(r[1]), day_(r[2]), str_(r[4]), str_(r[5]), str_(r[6]), str_(r[7]),
    round4_(num_(r[8])), round4_(num_(r[9])), num_(r[10]), num_(r[11]), str_(r[12]), String(r[13]).toUpperCase() === 'TRUE' ? 1 : 0]);
  const wc = timed('Wrong Connection', () => values_('Wrong Connection', 20)).filter(r => str_(r[4])).map(r => wcRow_(r, day_(r[16])));
  const info = timed('Summary', summaryInfo_);
  let latest = '';
  miss.forEach(r => { if (r[2] > latest) latest = r[2]; });
  const since = shift_(latest, -KEEP_DAYS);
  const recent = i => r => r[i] >= since;
  return { builtAt: new Date().toISOString(), buildMs: Date.now() - t0, timings: timings, latest: latest, since: since,
    updated: info.updated, cpo: info.cpo, dsNames: dsNames, lost: lost.filter(recent(5)), miss: miss.filter(recent(2)),
    mtd: mtd.filter(recent(2)), wc: wc.filter(recent(6)) };
}

function saveSnapshot_(s) {
  const gz = Utilities.gzip(Utilities.newBlob(JSON.stringify(s), 'application/json', 'snapshot.json'));
  const text = Utilities.base64Encode(gz.getBytes());
  const props = PropertiesService.getScriptProperties();
  let file = null;
  const id = props.getProperty('SNAP_ID');
  if (id) {
    try {
      file = DriveApp.getFileById(id);
      if (file.isTrashed()) file = null;
    } catch (err) {
      file = null;
    }
  }
  if (file) file.setContent(text);
  else props.setProperty('SNAP_ID', DriveApp.createFile(SNAPSHOT_NAME, text, MimeType.PLAIN_TEXT).getId());
  props.setProperty('SNAP_AT', s.builtAt);
}

function loadSnapshot_() {
  const id = PropertiesService.getScriptProperties().getProperty('SNAP_ID');
  if (!id) return null;
  try {
    const bytes = Utilities.base64Decode(DriveApp.getFileById(id).getBlob().getDataAsString());
    return JSON.parse(Utilities.ungzip(Utilities.newBlob(bytes, 'application/x-gzip')).getDataAsString());
  } catch (err) {
    return null;
  }
}

// ---------- answers ----------

function rangeData_(from, to) {
  const s = snapshot_();
  if (!isDay_(to)) to = s.latest;
  if (!isDay_(from)) from = shift_(to, -6);
  if (from > to) { const t = from; from = to; to = t; }
  const lo = shift_(from, -1);
  const hi = shift_(to, 2);

  const lost = s.lost.filter(r => r[5] >= from && r[5] <= to);
  const lostSet = {};
  lost.forEach(r => { lostSet[r[0]] = true; });

  // Missing tab: totals per day/WH/branch/category, plus the rows the evidence needs
  // (every row of a lost tote, and every excess row from the day before to two days after)
  const agg = {};
  const lines = [];
  s.miss.forEach(r => {
    const d = r[2];
    if (d >= from && d <= to) {
      const k = [d, r[3], r[4], r[5]].join('|');
      const a = agg[k] || (agg[k] = [0, 0, 0, 0, 0, 0, 0]);
      a[0] += r[7]; a[1] += r[8]; a[2] += r[9]; a[3] += r[10]; a[4] += r[11]; a[5] += r[12]; a[6] += 1;
    }
    if (lostSet[r[1]] || (r[12] > 0 && d >= lo && d <= hi)) {
      lines.push([r[0], r[1], d, r[3], r[4], r[5], r[6], r[7], r[9], r[10], r[12]]);
    }
  });
  const summary = Object.keys(agg).map(k => k.split('|').concat(agg[k].map(round2_)));

  // MTD Item level: the sheet's missing buckets (partial qty / whole SKU / whole tote)
  const bk = {};
  s.mtd.forEach(r => {
    if (r[2] < from || r[2] > to) return;
    const bucket = r[11] === 'Box Lost' ? 'full' : (r[12] ? 'sku' : 'partial');
    [bucket, 'all'].forEach(b => {
      const k = [r[2], r[3], b].join('|');
      const a = bk[k] || (bk[k] = { q: 0, v: 0, t: {}, s: {} });
      a.q += r[9]; a.v += r[7]; a.t[r[1]] = 1; a.s[r[6]] = 1;
    });
  });
  const buckets = Object.keys(bk).map(k => k.split('|').concat([
    round2_(bk[k].q), round2_(bk[k].v), Object.keys(bk[k].t).length, Object.keys(bk[k].s).length]));

  // Wrong Connection: box scans at branches, from two days before to three days after
  const wcLo = shift_(from, -2);
  const wcHi = shift_(to, 3);
  const wc = s.wc.filter(r => r[6] && r[6] >= wcLo && r[6] <= wcHi);

  return { from: from, to: to, latest: s.latest, updated: s.updated, cpo: s.cpo, dsNames: s.dsNames,
    lost: lost, summary: summary, buckets: buckets, lines: lines, wc: wc };
}

function searchTote_(q) {
  const s = snapshot_();
  const query = String(q || '').trim().toUpperCase();
  if (query.length < 6) throw new Error('اكتب رقم التوتة أو التحويل كامل');
  const isTransfer = query.indexOf('TR-') === 0;
  const base = query.replace(/_V\d+$/, '');
  const hit = v => {
    const t = String(v || '').toUpperCase();
    if (isTransfer) return t === query || t.indexOf(query + '/') === 0;
    return t === base || t.indexOf(base + '_V') === 0;
  };
  return {
    q: isTransfer ? query : base,
    kind: isTransfer ? 'transfer' : 'tote',
    lost: s.lost.filter(r => hit(isTransfer ? r[1] : r[0])),
    lines: s.miss.filter(r => hit(isTransfer ? r[0] : r[1]))
      .map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[9], r[10], r[12], r[8], r[11]]),
    wc: isTransfer ? [] : s.wc.filter(r => hit(r[0])),
    mtd: s.mtd.filter(r => hit(isTransfer ? r[0] : r[1]))
      .map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]]),
  };
}

// box, created_at (UTC as written), src WH, destination branch, scan branch, error, date, is tote missing, value, scan ok
function wcRow_(r, d) {
  return [str_(r[4]), stamp_(r[9]), str_(r[11]), str_(r[12]), str_(r[13]), str_(r[7]), d, str_(r[18]), num_(r[19]), str_(r[6])];
}

function summaryInfo_() {
  const sh = sheet_('Summary');
  const n = Math.min(sh.getLastRow(), 300);
  if (n < 2) return { updated: '', cpo: [] };
  const v = sh.getRange(1, 1, n, 2).getValues();
  const out = { updated: day_(v[1][1]), cpo: [] };
  const h = v.findIndex(r => str_(r[0]).toLowerCase() === 'daily cpo');
  if (h >= 0) {
    for (let i = h + 1; i < v.length; i++) {
      const d = day_(v[i][0]);
      if (!d) break;
      out.cpo.push([d, num_(v[i][1])]);
    }
  }
  return out;
}

// ---------- sheet reading ----------

function sheet_(name) {
  if (!book) {
    book = SpreadsheetApp.openById(CPO_SHEET_ID);
    tz = book.getSpreadsheetTimeZone() || tz;
  }
  const want = name.trim().toLowerCase();
  const sh = book.getSheets().find(s => s.getName().trim().toLowerCase() === want);
  if (!sh) throw new Error('Tab not found: ' + name);
  return sh;
}

// Data rows (header skipped), cut at the last filled cell of column A:
// some tabs carry formula columns far below the data.
function values_(name, ncol) {
  const sh = sheet_(name);
  let last = sh.getLastRow();
  const bottom = sh.getRange(sh.getMaxRows(), 1);
  if (bottom.isBlank()) last = Math.min(last, bottom.getNextDataCell(SpreadsheetApp.Direction.UP).getRow());
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, ncol).getValues();
}

function day_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = String(v == null ? '' : v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + pad_(m[1]) + '-' + pad_(m[2]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : '';
}

function stamp_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss');
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return m[3] + '-' + pad_(m[1]) + '-' + pad_(m[2]) + ' ' + pad_(m[4]) + ':' + m[5] + ':' + (m[6] || '00');
  return s;
}

function str_(v) {
  if (v instanceof Date) return day_(v);
  return String(v == null ? '' : v).trim();
}

function num_(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function round2_(n) { return typeof n === 'number' ? Math.round(n * 100) / 100 : n; }
function round4_(n) { return Math.round(n * 10000) / 10000; }
function pad_(n) { return ('0' + n).slice(-2); }
function isDay_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

function shift_(d, n) {
  const t = new Date(d + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

function json_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

// ---------- answer cache ----------

function cachePut_(key, text) {
  try {
    const n = Math.ceil(text.length / CACHE_CHUNK);
    if (n > 200) return;
    const m = {};
    for (let i = 0; i < n; i++) m[key + '#' + i] = text.substr(i * CACHE_CHUNK, CACHE_CHUNK);
    m[key] = String(n);
    CacheService.getScriptCache().putAll(m, CACHE_SECONDS);
  } catch (err) {
    // the cache is only a speed-up
  }
}

function cacheGet_(key) {
  try {
    const c = CacheService.getScriptCache();
    const n = Number(c.get(key));
    if (!n) return null;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(key + '#' + i);
    const m = c.getAll(keys);
    let s = '';
    for (let i = 0; i < keys.length; i++) {
      if (m[keys[i]] == null) return null;
      s += m[keys[i]];
    }
    return s;
  } catch (err) {
    return null;
  }
}
