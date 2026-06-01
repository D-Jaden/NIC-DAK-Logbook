// ─────────────────────────────────────────────
//  acquired/main.js  — Entry point
//  Talks to /api/acquired/* routes
// ─────────────────────────────────────────────

const TOKEN = () => localStorage.getItem('dak_token');
const AUTH  = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN() });

const TAB_MAP = { entry: 0, dashboard: 1, search: 2, pending: 3 };
let allRows = [];

// ── Navigation ────────────────────────────────────────────────────────────────
window.showPage = function(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const pg = document.getElementById('page-' + name);
    if (pg) pg.classList.add('active');
    const tabs = document.querySelectorAll('.nav-tab');
    if (TAB_MAP[name] !== undefined) tabs[TAB_MAP[name]]?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'dashboard') loadDashboard();
    if (name === 'search')    loadSearchTable();
    if (name === 'pending')   renderPendingTable();
};

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    ['acquiredDate','letterDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = today;
    });
    const sn = document.getElementById('headerSerial');
    if (sn) sn.textContent = 'NEW';
});

// ── Save entry ────────────────────────────────────────────────────────────────
window.submitEntry = async function() {
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        const payload = buildPayload();
        const res  = await fetch('/api/acquired/save', { method: 'POST', headers: AUTH(), body: JSON.stringify({ data: [payload] }) });
        const json = await res.json();
        if (json.success) { showToast('Entry saved successfully ✓', 'success'); clearForm(); }
        else               showToast(json.error || 'Save failed', 'error');
    } catch(e) { showToast('Network error: ' + e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save & Submit'; }
};

window.saveDraft = function() {
    sessionStorage.setItem('acquiredDraft', JSON.stringify(buildPayload()));
    showToast('Draft saved locally', 'info');
};

window.forwardToSection = function() {
    showToast('Forward to section — connect to your section workflow API', 'info');
};

function buildPayload() {
    const modes = [...document.querySelectorAll('#modeRow .mode-opt.selected')].map(el => el.dataset.mode);
    const stateVal = document.getElementById('addrState')?.value || '';
    const stateParts = stateVal.split('|');
    return {
        serialNo:            null,
        letterDate:          formatDateForAPI(document.getElementById('letterDate')?.value),
        acquiredOn:          formatDateForAPI(document.getElementById('acquiredDate')?.value),
        officeName:          document.getElementById('officeName')?.value || '',
        officeNameHindi:     document.getElementById('officeNameHi')?.textContent || '',
        specificPerson:      document.getElementById('specificPerson')?.value || '',
        specificPersonHindi: document.getElementById('specificPersonHi')?.textContent || '',
        letterNo:            document.getElementById('letterNo')?.value || '',
        subject:             document.getElementById('subjectEn')?.value || '',
        subjectHindi:        document.getElementById('subjectHi')?.textContent || '',
        letterLanguage:      document.getElementById('langValue')?.value || 'hi',
        zone:                stateParts[1] || '',
        modes,
        acquisitionMethod:   modes.join(', '),
        // Address fields (stored in receivedFrom for context)
        city:    document.getElementById('addrCity')?.value || '',
        district:document.getElementById('addrDistrict')?.value || '',
        block:   document.getElementById('addrBlock')?.value || '',
        state:   stateParts[0] || '',
        pincode: document.getElementById('addrPin')?.value || '',
    };
}

function formatDateForAPI(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

// ── Load data ─────────────────────────────────────────────────────────────────
window.loadData = async function() {
    try {
        const res  = await fetch('/api/acquired/load', { headers: AUTH() });
        const json = await res.json();
        if (json.success) { allRows = json.data; showToast(`Loaded ${allRows.length} records`, 'info'); showPage('search'); }
        else showToast(json.error || 'Load failed', 'error');
    } catch(e) { showToast('Network error', 'error'); }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res = await fetch('/api/acquired/stats', { headers: AUTH() });
        const json = await res.json();
        if (!json.success) return;
        document.getElementById('statTotal').textContent  = String(json.total).padStart(3,'0');
        document.getElementById('statZones').textContent  = json.byZone?.length || 0;
        // Load recent
        const res2  = await fetch('/api/acquired/load', { headers: AUTH() });
        const json2 = await res2.json();
        if (json2.success) { allRows = json2.data; renderRecentTable(json2.data.slice(-10).reverse()); }
    } catch(e) { console.error('[dashboard]', e); }
}

function renderRecentTable(rows) {
    const c = document.getElementById('recentTableBody');
    if (!rows.length) { c.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No entries yet.</p>'; return; }
    c.innerHTML = `<table><thead><tr><th>S.No.</th><th>Date</th><th>Letter No.</th><th>Subject</th><th>From / Zone</th><th>Mode</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
        <td class="td-serial">${r.serialNo||'—'}</td>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate||'—'}</td>
        <td style="font-size:11.5px;color:var(--text2)">${r.letterNo||'—'}</td>
        <td><div class="td-subject-en">${r.subject||'—'}</div><span class="td-subject-hi">${r.subjectHindi||''}</span></td>
        <td style="font-size:12px">${r.officeName||'—'}<br><span class="zone-pill">${r.zone||''}</span></td>
        <td><div class="mode-tags">${(r.acquisitionMethod||'').split(', ').filter(Boolean).map(m=>`<span class="mode-tag">${m}</span>`).join('')}</div></td>
    </tr>`).join('')}</tbody></table>`;
}

// ── Search ────────────────────────────────────────────────────────────────────
async function loadSearchTable() {
    if (!allRows.length) {
        const res = await fetch('/api/acquired/load', { headers: AUTH() }).catch(()=>null);
        if (res?.ok) { const j = await res.json(); if (j.success) allRows = j.data; }
    }
    renderSearchTable(allRows);
}

window.filterTable = function(q) {
    const query = (q || document.getElementById('searchInput')?.value || '').toLowerCase();
    const zone  = document.getElementById('filterZone')?.value || '';
    const prio  = document.getElementById('filterPriority')?.value || '';
    const mode  = document.getElementById('filterMode')?.value || '';
    const lang  = document.getElementById('filterLang')?.value || '';
    let rows = allRows;
    if (query) rows = rows.filter(r => [r.subject, r.letterNo, r.officeName, r.specificPerson].some(f=>(f||'').toLowerCase().includes(query)));
    if (zone)  rows = rows.filter(r => (r.zone||'').toLowerCase().includes(zone.toLowerCase()));
    if (mode)  rows = rows.filter(r => (r.acquisitionMethod||'').toLowerCase().includes(mode));
    if (lang)  rows = rows.filter(r => (r.letterLanguage||'') === lang);
    renderSearchTable(rows);
};

function renderSearchTable(rows) {
    document.getElementById('searchResultCount').textContent = `${rows.length} Results`;
    const c = document.getElementById('searchTableBody');
    if (!rows.length) { c.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No matching records.</p>'; return; }
    c.innerHTML = `<table><thead><tr><th>S.No.</th><th>Date</th><th>Letter No.</th><th>Subject</th><th>From</th><th>Zone</th><th>Mode</th><th>Lang</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
        <td class="td-serial">${r.serialNo||'—'}</td>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate||'—'}</td>
        <td style="font-size:11.5px;color:var(--text2)">${r.letterNo||'—'}</td>
        <td><div class="td-subject-en">${r.subject||'—'}</div><span class="td-subject-hi">${r.subjectHindi||''}</span></td>
        <td style="font-size:12px">${r.officeName||'—'}</td>
        <td><span class="zone-pill">${r.zone||'—'}</span></td>
        <td><div class="mode-tags">${(r.acquisitionMethod||'').split(', ').filter(Boolean).map(m=>`<span class="mode-tag">${m}</span>`).join('')}</div></td>
        <td style="font-size:12px">${r.letterLanguage||'—'}</td>
    </tr>`).join('')}</tbody></table>`;
}

// ── Pending ───────────────────────────────────────────────────────────────────
function renderPendingTable() {
    // Pending = entries loaded but not yet "forwarded" (no forwarded_at column yet — placeholder)
    const pending = allRows.filter(r => !r.forwardedAt);
    const c = document.getElementById('pendingTableBody');
    if (!pending.length) { c.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No pending letters.</p>'; return; }
    c.innerHTML = `<table><thead><tr><th>S.No.</th><th>Received</th><th>Letter No.</th><th>Subject</th><th>From / Zone</th><th>Priority</th><th>Action</th></tr></thead><tbody>
    ${pending.slice(0,20).map(r=>`<tr>
        <td class="td-serial">${r.serialNo||'—'}</td>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate||'—'}</td>
        <td style="font-size:11.5px;color:var(--text2)">${r.letterNo||'—'}</td>
        <td><div class="td-subject-en">${r.subject||'—'}</div></td>
        <td style="font-size:12px">${r.officeName||'—'}<br><span class="zone-pill">${r.zone||''}</span></td>
        <td><span class="forward-badge">⏳ Pending</span></td>
        <td><div class="btn-group"><button class="btn btn-dispatch btn-sm">Forward</button><button class="btn btn-secondary btn-sm">View</button></div></td>
    </tr>`).join('')}</tbody></table>`;
}

// ── Zone auto-detect ──────────────────────────────────────────────────────────
const stateZoneHindi = {
    North:   ['उत्तर क्षेत्र', '#d6e9f8'],
    South:   ['दक्षिण क्षेत्र', '#e8f5e9'],
    East:    ['पूर्व क्षेत्र', '#fff3e0'],
    West:    ['पश्चिम क्षेत्र', '#fce4ec'],
    Central: ['मध्य क्षेत्र', '#f3e5f5'],
    HQ:      ['मुख्यालय', '#e8f3fc'],
    Foreign: ['विदेश', '#f5f5f5'],
};

window.onStateChange = function() {
    const sel   = document.getElementById('addrState');
    const parts = (sel?.value || '').split('|');
    const zone  = parts[1] || '';
    const disp  = document.getElementById('zoneDisplay');
    if (!zone) { disp?.classList.add('hidden'); return; }
    const data  = stateZoneHindi[zone];
    document.getElementById('zoneLabel').textContent = zone + ' Zone';
    document.getElementById('zoneHi').textContent    = data ? data[0] : '';
    disp?.classList.remove('hidden');
};

window.onAddressChange = function() { /* hook for future geocoding */ };

window.onPincodeInput = function(el) {
    el.value = el.value.replace(/\D/g, '');
    if (el.value.length === 6) el.style.borderColor = 'var(--inward)';
    else el.style.borderColor = '';
};

// ── Translation ───────────────────────────────────────────────────────────────
const _timers = {};
window.triggerTranslate = function(srcId, destId) {
    const srcEl  = document.getElementById(srcId);
    const destEl = document.getElementById(destId);
    const spinner = document.getElementById('spinner-' + destId);
    if (!srcEl || !destEl) return;
    const text = srcEl.tagName === 'SELECT'
        ? (srcEl.options[srcEl.selectedIndex]?.value || '').split('|')[0]
        : srcEl.value.trim();
    if (!text) { destEl.textContent = '—'; return; }
    if (spinner) spinner.style.display = 'inline-block';
    clearTimeout(_timers[destId]);
    _timers[destId] = setTimeout(async () => {
        try {
            const res  = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
            const json = await res.json();
            destEl.textContent = json.translation || text;
        } catch { destEl.textContent = text; }
        if (spinner) spinner.style.display = 'none';
    }, 600);
};

// ── Mode / Priority / Lang toggles ────────────────────────────────────────────
window.toggleMode = function(el) {
    const row = document.getElementById('modeRow');
    const sel = row.querySelectorAll('.mode-opt.selected');
    if (el.classList.contains('selected')) { el.classList.remove('selected'); }
    else {
        if (sel.length >= 2) { el.style.animation = 'shake 0.3s'; setTimeout(() => el.style.animation='',300); return; }
        el.classList.add('selected');
    }
    const n = row.querySelectorAll('.mode-opt.selected').length;
    const cnt = document.getElementById('modeCount');
    if (cnt) { cnt.textContent = `${n} of 2 selected — maximum 2 modes`; cnt.style.color = n===2?'var(--tertiary)':'var(--text3)'; }
};

window.selectPriority = function(el, type) {
    document.querySelectorAll('.priority-opt').forEach(p => p.classList.remove('sel-immediate','sel-priority'));
    el.classList.add('sel-' + type);
    const h = document.getElementById('priorityValue'); if (h) h.value = type;
};

window.selectLang = function(el) {
    document.querySelectorAll('#langRow .lang-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    const h = document.getElementById('langValue'); if (h) h.value = el.dataset.lang || '';
};

// ── Utility ───────────────────────────────────────────────────────────────────
window.clearForm = function() {
    ['letterNo','subjectEn','officeName','specificPerson','addrCity','addrDistrict','addrBlock','addrPin','recByName','recByDsgn','recByDept','remarksEn']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['subjectHi','officeNameHi','specificPersonHi','recByNameHi','recByDsgnHi','recByDeptHi','remarksHi']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    document.getElementById('zoneDisplay')?.classList.add('hidden');
    document.querySelectorAll('#modeRow .mode-opt').forEach((el,i) => el.classList.toggle('selected', i===0));
    showToast('Form cleared', 'info');
};

window.exportCSV = function() {
    if (!allRows.length) { showToast('No data to export', 'info'); return; }
    const cols = ['serialNo','letterDate','letterNo','subject','officeName','zone','acquisitionMethod','letterLanguage'];
    const csv  = [cols.join(','), ...allRows.map(r=>cols.map(c=>`"${(r[c]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='acquired_export.csv'; a.click();
};

window.handleQuickSearch = function(v) {
    if (v.length>1) { showPage('search'); document.getElementById('searchInput').value=v; filterTable(v); }
};

function showToast(msg, type='info') {
    const t = document.createElement('div'); t.className='toast toast-'+type; t.textContent=msg;
    document.body.appendChild(t); setTimeout(()=>t.remove(), 3500);
}

const s = document.createElement('style');
s.textContent='@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}';
document.head.appendChild(s);