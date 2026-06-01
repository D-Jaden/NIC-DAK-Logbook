// ─────────────────────────────────────────────
//  despatch/main.js  — Entry point
//  Talks to /api/despatch/* routes
// ─────────────────────────────────────────────

const TOKEN = () => localStorage.getItem('dak_token');
const AUTH  = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN() });

const TAB_MAP = { entry: 0, dashboard: 1, search: 2, reports: 3 };
let allRows = [];      // cached loaded data
let copyCount = 2;     // tracks dynamic copy entries

// ── Page navigation ──────────────────────────────────────────────────────────
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
    if (name === 'reports')   loadReports();
};

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Populate state dropdowns in pre-rendered copy entries
    ['c1state','c2state'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = stateOptionsHTML();
    });
    // Default dates to today
    const today = new Date().toISOString().split('T')[0];
    ['registrationDate','letterDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = today;
    });
    // Auto serial display
    const sn = document.getElementById('headerSerial');
    if (sn) sn.textContent = 'NEW';
});

// ── Save entry ────────────────────────────────────────────────────────────────
window.submitEntry = async function() {
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        const payload = buildPayload();
        const res  = await fetch('/api/despatch/save', { method: 'POST', headers: AUTH(), body: JSON.stringify({ data: [payload] }) });
        const json = await res.json();
        if (json.success) { showToast('Entry saved successfully ✓', 'success'); clearForm(); }
        else               showToast(json.error || 'Save failed', 'error');
    } catch(e) {
        showToast('Network error: ' + e.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Save & Submit';
    }
};

window.saveDraft = async function() {
    const payload = buildPayload();
    sessionStorage.setItem('despatchDraft', JSON.stringify(payload));
    showToast('Draft saved locally', 'info');
};

function buildPayload() {
    const modes = [...document.querySelectorAll('#modeRow .mode-opt.selected')].map(el => el.dataset.mode);
    const copies = [];
    document.querySelectorAll('[id^="copy-entry-"]').forEach(entry => {
        const n = entry.id.replace('copy-entry-', '');
        const stateEl = document.getElementById('c' + n + 'state');
        const stateVal = stateEl?.value || '';
        const parts = stateVal.split('|');
        copies.push({
            name:   document.getElementById('c' + n + 'name')?.value || '',
            office: document.getElementById('c' + n + 'office')?.value || '',
            city:   document.getElementById('c' + n + 'city')?.value || '',
            district:document.getElementById('c' + n + 'district')?.value || '',
            state:  parts[0] || '',
            zone:   parts[1] || '',
            pin:    document.getElementById('c' + n + 'pin')?.value || '',
        });
    });
    return {
        serialNo:         null,   // auto-assigned by DB
        letterDate:       formatDateForAPI(document.getElementById('letterDate')?.value),
        registrationDate: formatDateForAPI(document.getElementById('registrationDate')?.value),
        letterNo:         document.getElementById('letterNo')?.value || '',
        modes,
        // Sent By
        sentByName:       document.getElementById('sentByName')?.value || '',
        sentByDesignation:document.getElementById('sentByDsgn')?.value || '',
        sentByDepartment: document.getElementById('sentByDept')?.value || '',
        sentByNameHi:     document.getElementById('sentByNameHi')?.textContent || '',
        sentByDesignationHi:document.getElementById('sentByDsgnHi')?.textContent || '',
        sentByDepartmentHi: document.getElementById('sentByDeptHi')?.textContent || '',
        // Sent To
        sentToName:       document.getElementById('sentToName')?.value || '',
        sentToNameHi:     document.getElementById('sentToNameHi')?.textContent || '',
        sentToAddress:    document.getElementById('sentToAddr')?.value || '',
        sentToAddressHi:  document.getElementById('sentToAddrHi')?.textContent || '',
        sentToZone:       document.getElementById('sentToZone')?.value || '',
        // Subject
        subject:          document.getElementById('subjectEn')?.value || '',
        subjectHindi:     document.getElementById('subjectHi')?.textContent || '',
        // Copy
        copies,
        // Meta
        letterLanguage:   document.getElementById('langValue')?.value || 'hi',
        priority:         document.getElementById('priorityValue')?.value || 'priority',
        zone:             document.getElementById('sentToZone')?.value?.replace(' Zone','') || '',
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
        const res  = await fetch('/api/despatch/load', { headers: AUTH() });
        const json = await res.json();
        if (json.success) {
            allRows = json.data;
            showToast(`Loaded ${allRows.length} records`, 'info');
            showPage('search');
        } else showToast(json.error || 'Load failed', 'error');
    } catch(e) { showToast('Network error', 'error'); }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res  = await fetch('/api/despatch/stats', { headers: AUTH() });
        const json = await res.json();
        if (!json.success) return;
        document.getElementById('statTotal')?.setAttribute('innerText', json.total);
        document.getElementById('statTotal').textContent = String(json.total).padStart(3, '0');
        document.getElementById('statZones').textContent = json.byZone?.length || 0;
        document.getElementById('statLangs').textContent = json.byLanguage?.length || 0;
        // Load recent entries for the table
        const res2  = await fetch('/api/despatch/load', { headers: AUTH() });
        const json2 = await res2.json();
        if (json2.success) {
            allRows = json2.data;
            renderRecentTable(json2.data.slice(-10).reverse());
        }
    } catch(e) { console.error('[dashboard]', e); }
}

function renderRecentTable(rows) {
    const container = document.getElementById('recentTableBody');
    if (!rows.length) { container.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No entries yet.</p>'; return; }
    container.innerHTML = `<table><thead><tr><th>S.No.</th><th>Date</th><th>Letter No.</th><th>Subject</th><th>Sent To</th><th>Mode(s)</th></tr></thead><tbody>
    ${rows.map(r => `<tr>
        <td class="td-serial">${r.serialNo || '—'}</td>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate || '—'}</td>
        <td style="font-size:11.5px;color:var(--text2)">${r.letterNo || '—'}</td>
        <td><div class="td-subject-en">${r.subject || '—'}</div><span class="td-subject-hi">${r.subjectHindi || ''}</span></td>
        <td style="font-size:12px">${r.sentToName || '—'}</td>
        <td><div class="mode-tags">${(r.deliveryMethod || '').split(', ').filter(Boolean).map(m => `<span class="mode-tag">${m}</span>`).join('')}</div></td>
    </tr>`).join('')}
    </tbody></table>`;
}

// ── Search ────────────────────────────────────────────────────────────────────
async function loadSearchTable() {
    if (!allRows.length) {
        const res = await fetch('/api/despatch/load', { headers: AUTH() }).catch(() => null);
        if (res?.ok) { const j = await res.json(); if (j.success) allRows = j.data; }
    }
    renderSearchTable(allRows);
}

window.filterTable = function(q) {
    const query = (q || document.getElementById('searchInput')?.value || '').toLowerCase();
    const zone  = document.getElementById('filterZone')?.value || '';
    const prio  = document.getElementById('filterPriority')?.value || '';
    const mode  = document.getElementById('filterMode')?.value || '';
    const from  = document.getElementById('filterFrom')?.value || '';
    const to    = document.getElementById('filterTo')?.value || '';
    let rows = allRows;
    if (query) rows = rows.filter(r => [r.subject, r.letterNo, r.sentToName, r.sentBy].some(f => (f||'').toLowerCase().includes(query)));
    if (zone)  rows = rows.filter(r => (r.sentToZone||'').includes(zone));
    if (prio)  rows = rows.filter(r => (r.priority||'') === prio);
    if (mode)  rows = rows.filter(r => (r.deliveryMethod||'').toLowerCase().includes(mode));
    renderSearchTable(rows);
};

function renderSearchTable(rows) {
    document.getElementById('searchResultCount').textContent = `${rows.length} Results`;
    const container = document.getElementById('searchTableBody');
    if (!rows.length) { container.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No matching records.</p>'; return; }
    container.innerHTML = `<table><thead><tr><th>S.No.</th><th>Date</th><th>Letter No.</th><th>Subject</th><th>Sent To / Zone</th><th>Mode(s)</th><th>Lang</th></tr></thead><tbody>
    ${rows.map(r => `<tr>
        <td class="td-serial">${r.serialNo || '—'}</td>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate || '—'}</td>
        <td style="font-size:11.5px;color:var(--text2)">${r.letterNo || '—'}</td>
        <td><div class="td-subject-en">${r.subject || '—'}</div><span class="td-subject-hi">${r.subjectHindi || ''}</span></td>
        <td style="font-size:12px">${r.sentToName || '—'}<br><span style="color:var(--text3);font-size:11px">${r.sentToZone || ''}</span></td>
        <td><div class="mode-tags">${(r.deliveryMethod||'').split(', ').filter(Boolean).map(m => `<span class="mode-tag">${m}</span>`).join('')}</div></td>
        <td style="font-size:12px">${r.letterLanguage || '—'}</td>
    </tr>`).join('')}
    </tbody></table>`;
}

// ── Reports ───────────────────────────────────────────────────────────────────
async function loadReports() {
    const container = document.getElementById('reportsContent');
    try {
        const res  = await fetch('/api/despatch/stats', { headers: AUTH() });
        const json = await res.json();
        if (!json.success) { container.innerHTML = '<p style="padding:20px;color:var(--text3)">Could not load statistics.</p>'; return; }
        container.innerHTML = renderReportCharts(json);
    } catch(e) { container.innerHTML = '<p style="padding:20px;color:var(--text3)">Error loading reports.</p>'; }
}

function renderReportCharts(json) {
    const bar = (label, count, max, color) =>
        `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:110px;font-size:12px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</div>
            <div style="flex:1;background:var(--surface3);border-radius:4px;height:8px;overflow:hidden">
                <div style="width:${max ? Math.round(count/max*100) : 0}%;height:100%;background:${color};border-radius:4px"></div>
            </div>
            <div style="font-family:var(--mono);font-size:12px;color:var(--text2);min-width:24px;text-align:right">${count}</div>
        </div>`;

    const maxZone  = Math.max(...(json.byZone||[]).map(r=>r.count), 1);
    const maxLang  = Math.max(...(json.byLanguage||[]).map(r=>r.count), 1);
    const maxMeth  = Math.max(...(json.byMethod||[]).map(r=>r.count), 1);

    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="card"><div class="card-header"><div class="card-dot"></div><span class="card-title-en">By Zone</span><span class="card-title-hi">क्षेत्र अनुसार</span></div>
            <div class="card-body">${(json.byZone||[]).map(r => bar(r.label, r.count, maxZone, 'var(--primary)')).join('') || '<p style="color:var(--text3);font-size:12px">No data</p>'}</div></div>
        <div class="card"><div class="card-header"><div class="card-dot"></div><span class="card-title-en">By Language</span><span class="card-title-hi">भाषा अनुसार</span></div>
            <div class="card-body">${(json.byLanguage||[]).map(r => bar(r.label, r.count, maxLang, 'var(--tertiary)')).join('') || '<p style="color:var(--text3);font-size:12px">No data</p>'}</div></div>
        <div class="card" style="grid-column:1/-1"><div class="card-header"><div class="card-dot"></div><span class="card-title-en">By Mode of Despatch</span><span class="card-title-hi">प्रेषण माध्यम अनुसार</span></div>
            <div class="card-body">${(json.byMethod||[]).map(r => bar(r.label, r.count, maxMeth, 'var(--secondary)')).join('') || '<p style="color:var(--text3);font-size:12px">No data</p>'}</div></div>
    </div>`;
}

// ── Utility: translation ──────────────────────────────────────────────────────
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
            const res  = await fetch('https://d-jaden02-pys-deep-transalator.hf.space', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
            const json = await res.json();
            destEl.textContent = json.translation || text;
        } catch { destEl.textContent = text; }
        if (spinner) spinner.style.display = 'none';
    }, 600);
};

// ── Utility: mode toggle ──────────────────────────────────────────────────────
window.toggleMode = function(el) {
    const row = document.getElementById('modeRow');
    const sel = row.querySelectorAll('.mode-opt.selected');
    if (el.classList.contains('selected')) { el.classList.remove('selected'); }
    else {
        if (sel.length >= 3) { el.style.animation = 'shake 0.3s'; setTimeout(() => el.style.animation = '', 300); return; }
        el.classList.add('selected');
    }
    const n = row.querySelectorAll('.mode-opt.selected').length;
    const cnt = document.getElementById('modeCount');
    if (cnt) { cnt.textContent = `${n} of 3 selected — maximum 3 modes allowed`; cnt.style.color = n === 3 ? 'var(--tertiary)' : 'var(--text3)'; }
};

// ── Utility: priority / lang ──────────────────────────────────────────────────
window.selectPriority = function(el, type) {
    document.querySelectorAll('.priority-opt').forEach(p => p.classList.remove('sel-immediate','sel-priority'));
    el.classList.add('sel-' + type);
    const h = document.getElementById('priorityValue'); if (h) h.value = type;
};
window.selectLang = function(el) {
    document.querySelectorAll('#langRow .mode-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    const h = document.getElementById('langValue'); if (h) h.value = el.dataset.lang || '';
};

// ── Utility: copy recipients ──────────────────────────────────────────────────
const zoneHindiMap = {
    North: ['उत्तर क्षेत्र','North Zone'], South: ['दक्षिण क्षेत्र','South Zone'],
    East:  ['पूर्व क्षेत्र','East Zone'],  West:  ['पश्चिम क्षेत्र','West Zone'],
    Central:['मध्य क्षेत्र','Central Zone'],HQ:   ['मुख्यालय','HQ'],
    Foreign:['विदेश','Foreign'],
};

window.onCopyStateChange = function(n) {
    const sel = document.getElementById('c' + n + 'state');
    const parts = (sel?.value || '').split('|');
    const zone  = parts[1] || '';
    const tag   = document.getElementById('c' + n + 'zone');
    const lbl   = document.getElementById('c' + n + 'zoneLabel');
    const hi    = document.getElementById('c' + n + 'zoneHi');
    const data  = zoneHindiMap[zone];
    if (data && tag && lbl && hi) {
        lbl.textContent = data[1]; hi.textContent = ' — ' + data[0];
        tag.classList.add('visible');
    } else if (tag) tag.classList.remove('visible');
};

window.onCopyPin = function(el) { el.value = el.value.replace(/\D/g, ''); };

window.addCopyEntry = function() {
    if (copyCount >= 8) { showToast('Maximum 8 copy recipients', 'info'); return; }
    copyCount++;
    const n    = copyCount;
    const grid = document.getElementById('copyGrid');
    const div  = document.createElement('div');
    div.className = 'copy-entry'; div.id = 'copy-entry-' + n;
    div.innerHTML = `
    <div class="copy-entry-header">
      <span class="copy-entry-no">Copy #${n}</span>
      <span class="copy-zone-tag" id="c${n}zone"><span class="zdot"></span><span id="c${n}zoneLabel">—</span><span class="zhi" id="c${n}zoneHi"></span></span>
    </div>
    <div class="field" style="margin-bottom:7px"><span class="field-label">Name <span class="field-label-hi">/ नाम</span></span><input type="text" id="c${n}name" placeholder="Name…" oninput="triggerTranslate('c${n}name','c${n}nameHi')"></div>
    <div class="field" style="margin-bottom:7px"><span class="field-label">Office / Room No.</span><input type="text" id="c${n}office" placeholder="e.g. Room 201"></div>
    <div class="copy-addr-row">
      <div class="field"><span class="field-label" style="font-size:10px">City</span><input type="text" id="c${n}city" placeholder="City…"></div>
      <div class="field"><span class="field-label" style="font-size:10px">District</span><input type="text" id="c${n}district" placeholder="District…"></div>
    </div>
    <div class="copy-addr-row">
      <div class="field"><span class="field-label" style="font-size:10px">State</span><select id="c${n}state" onchange="onCopyStateChange(${n})">${stateOptionsHTML()}</select></div>
      <div class="field"><span class="field-label" style="font-size:10px">Pincode</span><input type="text" id="c${n}pin" placeholder="6-digit" maxlength="6" oninput="onCopyPin(this)"></div>
    </div>
    <div class="field-hindi" id="c${n}nameHi" style="margin-top:6px">नाम • कार्यालय • पता</div>`;
    grid.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function stateOptionsHTML() {
    return `<option value="">— State —</option>
    <optgroup label="North Zone"><option value="Delhi|North">Delhi</option><option value="Haryana|North">Haryana</option><option value="Himachal Pradesh|North">Himachal Pradesh</option><option value="Jammu &amp; Kashmir|North">Jammu &amp; Kashmir</option><option value="Punjab|North">Punjab</option><option value="Uttarakhand|North">Uttarakhand</option><option value="Uttar Pradesh|North">Uttar Pradesh</option></optgroup>
    <optgroup label="South Zone"><option value="Andhra Pradesh|South">Andhra Pradesh</option><option value="Karnataka|South">Karnataka</option><option value="Kerala|South">Kerala</option><option value="Tamil Nadu|South">Tamil Nadu</option><option value="Telangana|South">Telangana</option></optgroup>
    <optgroup label="East Zone"><option value="Bihar|East">Bihar</option><option value="Jharkhand|East">Jharkhand</option><option value="Odisha|East">Odisha</option><option value="West Bengal|East">West Bengal</option><option value="Assam|East">Assam</option><option value="Tripura|East">Tripura</option><option value="Manipur|East">Manipur</option><option value="Meghalaya|East">Meghalaya</option><option value="Nagaland|East">Nagaland</option><option value="Mizoram|East">Mizoram</option><option value="Arunachal Pradesh|East">Arunachal Pradesh</option><option value="Sikkim|East">Sikkim</option></optgroup>
    <optgroup label="West Zone"><option value="Goa|West">Goa</option><option value="Gujarat|West">Gujarat</option><option value="Maharashtra|West">Maharashtra</option><option value="Rajasthan|West">Rajasthan</option></optgroup>
    <optgroup label="Central Zone"><option value="Chhattisgarh|Central">Chhattisgarh</option><option value="Madhya Pradesh|Central">Madhya Pradesh</option></optgroup>
    <optgroup label="HQ / Other"><option value="New Delhi HQ|HQ">New Delhi (HQ)</option><option value="Foreign|Foreign">Foreign / International</option></optgroup>`;
}

// ── Utility: form helpers ─────────────────────────────────────────────────────
window.clearForm = function() {
    ['letterNo','subjectEn','sentByName','sentByDsgn','sentByDept',
     'sentToName','sentToAddr','remarksEn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['subjectHi','sentByNameHi','sentByDsgnHi','sentByDeptHi','sentToNameHi','sentToAddrHi','sentToZoneHi','remarksHi']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    document.querySelectorAll('#modeRow .mode-opt').forEach((el,i) => { el.classList.toggle('selected', i === 0); });
    showToast('Form cleared', 'info');
};

window.exportCSV = function() {
    if (!allRows.length) { showToast('No data to export', 'info'); return; }
    const cols = ['serialNo','letterDate','letterNo','subject','sentToName','sentToZone','deliveryMethod','letterLanguage'];
    const csv  = [cols.join(','), ...allRows.map(r => cols.map(c => `"${(r[c]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const a    = document.createElement('a');
    a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'despatch_export.csv'; a.click();
};

window.handleQuickSearch = function(v) {
    if (v.length > 1) { showPage('search'); document.getElementById('searchInput').value = v; filterTable(v); }
};

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = 'toast toast-' + type; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// CSS animations
const s = document.createElement('style');
s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}`;
document.head.appendChild(s);