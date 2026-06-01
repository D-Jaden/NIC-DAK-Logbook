// ─────────────────────────────────────────────
//  acquired/main.js  — Entry point
//  Talks to /api/acquired/* routes
// ─────────────────────────────────────────────

// add a monthly and yearly reports button to the report section and pdf print btn

import { stateOptionsHTML } from '../shared/zone.js';

const TOKEN = () => localStorage.getItem('dak_token');
const AUTH = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN() });

const TAB_MAP = { entry: 0, dashboard: 1, search: 2, pending: 3, reports: 4 };
let allRows = [];

// ── Navigation ────────────────────────────────────────────────────────────────
window.showPage = function (name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const pg = document.getElementById('page-' + name);
    if (pg) pg.classList.add('active');
    const tabs = document.querySelectorAll('.nav-tab');
    if (TAB_MAP[name] !== undefined) tabs[TAB_MAP[name]]?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name === 'dashboard') loadDashboard();
    if (name === 'search') loadSearchTable();
    if (name === 'pending') renderPendingTable();
    if (name === 'reports') loadReports();
};

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    ['acquiredDate', 'letterDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = today;
    });

    const stateSel = document.getElementById('addrState');
    if (stateSel) stateSel.innerHTML = stateOptionsHTML();

    const sn = document.getElementById('headerSerial');
    if (sn) sn.textContent = 'NEW';
    fetchNextSerial();
});

async function fetchNextSerial() {
    try {
        const res = await fetch('/api/acquired/next-serial', { headers: AUTH() });
        const json = await res.json();
        if (json.success) {
            const sn = document.getElementById('headerSerial');
            if (sn) sn.textContent = json.nextSerial;
        }
    } catch (e) {
        console.error('Failed to fetch next serial', e);
    }
}

// ── Save entry ────────────────────────────────────────────────────────────────
window.saveDraft = function () {
    submitEntry(true);
};

window.forwardToSection = function () {
    showToast('Forward to section — connect to your section workflow API', 'info');
};

function buildPayload() {
    const modes = [...document.querySelectorAll('#modeRow .mode-opt.selected')].map(el => el.dataset.mode);
    const stateVal = document.getElementById('addrState')?.value || '';
    const stateParts = stateVal.split('|');
    const city = document.getElementById('addrCity')?.value || '';
    const district = document.getElementById('addrDistrict')?.value || '';
    const block = document.getElementById('addrBlock')?.value || '';
    const stateName = stateParts[0] || '';
    const pincode = document.getElementById('addrPin')?.value || '';
    const address = [city, district, block, stateName, pincode].filter(Boolean).join(', ');

    return {
        serialNo: null,
        letterDate: formatDateForAPI(document.getElementById('letterDate')?.value),
        acquiredOn: formatDateForAPI(document.getElementById('acquiredDate')?.value),
        officeName: document.getElementById('officeName')?.value || '',
        officeNameHindi: document.getElementById('officeNameHi')?.textContent || '',
        specificPerson: document.getElementById('specificPerson')?.value || '',
        specificPersonHindi: document.getElementById('specificPersonHi')?.textContent || '',
        letterNo: document.getElementById('letterNo')?.value || '',
        subject: document.getElementById('subjectEn')?.value || '',
        subjectHindi: document.getElementById('subjectHi')?.textContent || '',
        letterLanguage: document.getElementById('langValue')?.value || 'hi',
        zone: stateParts[1] || '',
        priority: document.getElementById('priorityValue')?.value || 'priority',
        modes,
        acquisitionMethod: modes.join(', '),
        // Formatted address for saving
        address,
        addressHindi: '', // Not easily translatable on frontend, keep empty for now
        // Raw address fields for internal use
        city, district, block, state: stateName, pincode
    };
}

function formatDateForAPI(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

document.addEventListener('DOMContentLoaded', function () {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout? Remember To Save')) {
                window.location.href = '../signup/login/login.html';
            }
        });
    }
});

// ── Load data ─────────────────────────────────────────────────────────────────
window.loadData = async function () {
    try {
        const res = await fetch('/api/acquired/load', { headers: AUTH() });
        const json = await res.json();
        if (json.success) {
            allRows = json.data || [];
            const submittedRows = allRows.filter(r => r.status === 'submitted');
            const draftRows = allRows.filter(r => r.status === 'draft');
            showToast(`Loaded ${submittedRows.length} records, ${draftRows.length} drafts`, 'info');
            renderPendingTable();
            showPage('search');
        }
        else showToast(json.error || 'Load failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res = await fetch('/api/acquired/stats', { headers: AUTH() });
        const json = await res.json();
        if (!json.success) return;
        document.getElementById('statTotal').textContent = String(json.total).padStart(3, '0');
        document.getElementById('statZones').textContent = json.byZone?.length || 0;
        // Load recent
        const res2 = await fetch('/api/acquired/load', { headers: AUTH() });
        const json2 = await res2.json();
        if (json2.success) {
            allRows = json2.data || [];
            const submittedRows = allRows.filter(r => r.status === 'submitted');
            renderRecentTable(submittedRows.slice(-10).reverse());

            // Priority counts
            document.getElementById('statImmediate').textContent = submittedRows.filter(r => r.priority === 'immediate').length;
            document.getElementById('statPriority').textContent = submittedRows.filter(r => r.priority === 'priority').length;

            // Pending forward counts
            const statPending = document.getElementById('statPending');
            if (statPending) statPending.textContent = allRows.filter(r => r.status === 'draft').length;
        }
    } catch (e) { console.error('[dashboard]', e); }
}

function renderRecentTable(rows) {
    const c = document.getElementById('recentTableBody');
    if (!rows.length) { c.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No entries yet.</p>'; return; }
    c.innerHTML = `<table><thead><tr><th>S.No.</th><th>Date</th><th>Letter No.</th><th>Subject</th><th>From / Zone</th><th>Mode</th></tr></thead><tbody>
    ${rows.map(r => `<tr>
        <td class="td-serial">${r.serialNo || '—'}</td>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate || '—'}</td>
        <td style="font-size:11.5px;color:var(--text2)">${r.letterNo || '—'}</td>
        <td><div class="td-subject-en">${r.subject || '—'}</div><span class="td-subject-hi">${r.subjectHindi || ''}</span></td>
        <td style="font-size:12px">${r.officeName || '—'}<br><span class="zone-pill">${r.zone || ''}</span></td>
        <td><div class="mode-tags">${(r.acquisitionMethod || '').split(', ').filter(Boolean).map(m => `<span class="mode-tag">${m}</span>`).join('')}</div></td>
    </tr>`).join('')}</tbody></table>`;
}

// ── Search ────────────────────────────────────────────────────────────────────
async function loadSearchTable() {
    if (!allRows.length) {
        const res = await fetch('/api/acquired/load', { headers: AUTH() }).catch(() => null);
        if (res?.ok) { const j = await res.json(); if (j.success) allRows = j.data; }
    }
    renderSearchTable(allRows);
}

window.filterTable = function (q) {
    const query = (q || document.getElementById('searchInput')?.value || '').toLowerCase();
    const zone = document.getElementById('filterZone')?.value || '';
    const prio = document.getElementById('filterPriority')?.value || '';
    const mode = document.getElementById('filterMode')?.value || '';
    const lang = document.getElementById('filterLang')?.value || '';
    const from = document.getElementById('filterFrom')?.value || '';
    const to = document.getElementById('filterTo')?.value || '';

    let rows = allRows.filter(r => r.status === 'submitted');
    if (query) rows = rows.filter(r => [r.subject, r.letterNo, r.officeName, r.specificPerson].some(f => (f || '').toLowerCase().includes(query)));
    if (zone) rows = rows.filter(r => (r.zone || '').toLowerCase().includes(zone.toLowerCase()));
    if (mode) rows = rows.filter(r => (r.acquisitionMethod || '').toLowerCase().includes(mode));
    if (lang) rows = rows.filter(r => (r.letterLanguage || '') === lang);
    if (from || to) {
        const fromTime = from ? new Date(from).getTime() : 0;
        const toTime = to ? new Date(to).getTime() : Infinity;
        rows = rows.filter(r => {
            if (!r.letterDate) return false;
            const [d, m, y] = r.letterDate.split('/');
            const t = new Date(`${y}-${m}-${d}`).getTime();
            return t >= fromTime && t <= toTime;
        });
    }
    renderSearchTable(rows);
};

function renderSearchTable(rows) {
    document.getElementById('searchResultCount').textContent = `${rows.length} Results`;
    const c = document.getElementById('searchTableBody');
    if (!rows.length) { c.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No matching records.</p>'; return; }
    c.innerHTML = `<div class="table-responsive"><table><thead><tr><th>S.No.</th><th>Date</th><th>Letter No.</th><th>Subject</th><th>From</th><th>Zone</th><th>Mode</th><th>Lang</th><th>Actions</th></tr></thead><tbody>
    ${rows.map(r => `<tr>
        <td class="td-serial">${r.serialNo || '—'}</td>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate || '—'}</td>
        <td style="font-size:11.5px;color:var(--text2)">${r.letterNo || '—'}</td>
        <td><div class="td-subject-en">${r.subject || '—'}</div><span class="td-subject-hi">${r.subjectHindi || ''}</span></td>
        <td style="font-size:12px">${r.officeName || '—'}</td>
        <td><span class="zone-pill">${r.zone || '—'}</span></td>
        <td><div class="mode-tags">${(r.acquisitionMethod || '').split(', ').filter(Boolean).map(m => `<span class="mode-tag">${m}</span>`).join('')}</div></td>
        <td style="font-size:12px">${r.letterLanguage || '—'}</td>
        <td>
            <div class="btn-group" style="gap:4px">
                <button class="btn btn-secondary btn-sm" onclick="editEntry(${r.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteEntry(${r.id})">Delete</button>
            </div>
        </td>
    </tr>`).join('')}</tbody></table></div>`;
}

// ── Edit & Delete ─────────────────────────────────────────────────────────────
let currentEditId = null;

window.editEntry = function (id) {
    const row = allRows.find(r => r.id === id);
    if (!row) return;
    currentEditId = id;

    // Populate form
    document.getElementById('letterDate').value = (row.letterDate || '').split('/').reverse().join('-');
    document.getElementById('acquiredDate').value = (row.acquiredDate || '').split('/').reverse().join('-');
    document.getElementById('letterNumber').value = row.letterNo || '';
    document.getElementById('subjectEn').value = row.subject || '';
    document.getElementById('subjectHi').value = row.subjectHindi || '';
    document.getElementById('officeName').value = row.officeName || '';
    document.getElementById('officeNameHi').value = row.officeNameHindi || '';
    document.getElementById('specificPerson').value = row.specificPerson || '';
    document.getElementById('specificPersonHi').value = row.specificPersonHindi || '';

    const modes = (row.acquisitionMethod || '').split(', ');
    document.querySelectorAll('#modeRow .mode-opt').forEach(el => {
        if (modes.includes(el.dataset.mode)) el.classList.add('selected');
        else el.classList.remove('selected');
    });

    document.querySelectorAll('#langRow .lang-opt').forEach(el => {
        if (el.dataset.lang === row.letterLanguage) el.classList.add('selected');
        else el.classList.remove('selected');
    });
    document.getElementById('langValue').value = row.letterLanguage || 'hi';

    document.getElementById('addrState').value = Object.entries(zoneHindiMap).find(([z, meta]) => z === row.zone) ? `${row.zone}|${row.zone}` : ''; // Hack for state selection if state wasn't explicitly saved

    const btn = document.getElementById('submitBtn');
    btn.textContent = 'Update Entry';
    showPage('entry');
    showToast('Entry loaded for editing', 'info');
};

window.deleteEntry = async function (id) {
    if (!confirm('Are you sure you want to delete this entry? This cannot be undone.')) return;
    try {
        const res = await fetch(`/api/acquired/delete/${id}`, { method: 'DELETE', headers: AUTH() });
        const json = await res.json();
        if (json.success) {
            showToast('Entry deleted', 'success');
            loadData(); // reload table
        } else {
            showToast(json.error || 'Delete failed', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
};

window.submitEntry = async function (isDraft = false) {
    if (isDraft && isDraft.type) isDraft = false; // Ignore event object

    if (!isDraft) {
        const requiredIds = [
            'acquiredDate', 'letterDate', 'letterNo', 'subjectEn',
            'officeName', 'specificPerson',
            'addrPin', 'addrCity', 'addrDistrict', 'addrState',
            'recByName', 'recByDsgn', 'recByDept'
        ];

        const missing = requiredIds.some(id => {
            const el = document.getElementById(id);
            return el && !el.value.trim();
        });

        // Wait, for officeName and specificPerson, we just need AT LEAST ONE.
        // Let's refine it:
        const office = document.getElementById('officeName')?.value.trim();
        const person = document.getElementById('specificPerson')?.value.trim();

        const otherRequired = [
            'acquiredDate', 'letterDate', 'letterNo', 'subjectEn',
            'addrPin', 'addrCity', 'addrDistrict', 'addrState',
            'recByName', 'recByDsgn', 'recByDept'
        ];

        const otherMissing = otherRequired.some(id => {
            const el = document.getElementById(id);
            return el && !el.value.trim();
        });

        if (otherMissing || (!office && !person)) {
            showToast('Please fill all fields (except remarks/copy) before saving.', 'error');
            return;
        }
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = currentEditId ? 'Updating…' : 'Saving…';
    try {
        const payload = buildPayload();
        payload.status = isDraft ? 'draft' : 'submitted';
        let endpoint = '/api/acquired/save';
        let body = { data: [payload] };

        if (currentEditId) {
            endpoint = '/api/acquired/save-changes';
            payload.id = currentEditId;
            body = { changedRows: [payload], newRows: [] };
        }

        const res = await fetch(endpoint, { method: 'POST', headers: AUTH(), body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) {
            showToast(currentEditId ? 'Entry updated successfully ✓' : (isDraft ? 'Draft saved ✓' : 'Entry saved successfully ✓'), 'success');
            clearForm();
            currentEditId = null;
            btn.textContent = 'Save & Forward';
            await loadData();
            if (isDraft) {
                showPage('pending');
            } else {
                showPage('dashboard');
            }
        }
        else showToast(json.error || 'Save failed', 'error');
    } catch (e) {
        showToast('Network error: ' + e.message, 'error');
    } finally {
        btn.disabled = false; if (!currentEditId) btn.textContent = 'Save & Forward';
    }
};

// ── Reports ───────────────────────────────────────────────────────────────────
let chartInstances = [];
let currentExportType = null;

window.parseIndianDate = function (str) {
    if (!str) return new Date('');
    const parts = str.split('/');
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
    return new Date(str);
};

window.handleReportDateRange = function () {
    const range = document.getElementById('reportDateRange').value;
    document.getElementById('reportSpecificMonth').style.display = range === 'month' ? 'block' : 'none';
    document.getElementById('reportCustomRange').style.display = range === 'custom' ? 'flex' : 'none';
    loadReports();
};

window.loadReports = async function () {
    const range = document.getElementById('reportDateRange')?.value || 'all';
    let filteredRows = allRows;
    const now = new Date();

    if (range === 'month') {
        const monthVal = document.getElementById('reportSpecificMonth')?.value; // YYYY-MM
        if (monthVal) {
            const [y, m] = monthVal.split('-');
            filteredRows = allRows.filter(r => {
                if (!r.acquiredOn) return false;
                const d = parseIndianDate(r.acquiredOn);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === parseInt(y) && (d.getMonth() + 1) === parseInt(m);
            });
        }
    } else if (range === '6months') {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).getTime();
        filteredRows = allRows.filter(r => {
            if (!r.acquiredOn) return false;
            return parseIndianDate(r.acquiredOn).getTime() >= sixMonthsAgo;
        });
    } else if (range === 'year') {
        const currentYear = now.getFullYear();
        filteredRows = allRows.filter(r => {
            if (!r.acquiredOn) return false;
            return parseIndianDate(r.acquiredOn).getFullYear() === currentYear;
        });
    } else if (range === 'custom') {
        const from = document.getElementById('reportFrom')?.value;
        const to = document.getElementById('reportTo')?.value;
        const fromTime = from ? new Date(from).getTime() : 0;
        const toTime = to ? new Date(to).getTime() + 86400000 : Infinity; // add 1 day to include end date
        filteredRows = allRows.filter(r => {
            if (!r.acquiredOn) return false;
            const t = parseIndianDate(r.acquiredOn).getTime();
            return t >= fromTime && t <= toTime;
        });
    }

    const c = document.getElementById('reportsContent');
    c.innerHTML = `
        <div id="reportsPDFContainer" style="background:#fff; padding:20px; font-family:'Times New Roman', Times, serif; color:#000;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom: 1px solid #000; padding-bottom: 10px;">
                <img src="/images/digital-india.png" alt="Govt Logo" style="height:55px;" />
                <div style="text-align:center; flex:1;">
                    <h2 style="margin:0 0 3px 0; font-family:'Times New Roman', Times, serif; font-size:13px; font-weight:bold;">National Informatics Centre / राष्ट्रीय सूचना विज्ञान केंद्र</h2>
                    <h3 style="margin:0 0 8px 0; font-size:10px; font-weight:normal;">Meghalaya State Centre, Shillong - 793003 / मेघालय राज्य केंद्र, शिलांग - 793003</h3>
                    <h4 style="margin:0; font-size:12px; font-weight:bold; text-decoration:underline;">DAK Acquired Register - Analytics Report</h4>
                    <p style="margin:4px 0 0 0; font-size:10px;">Total Records: <strong>${filteredRows.length}</strong> | Filter: ${range}</p>
                </div>
                <img src="/images/NIC Logo JPG/BILINGUAL _SQUARE_NIC_Logo_white_bg-01.jpg" alt="NIC Logo" style="height:55px;" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div class="card" style="border:1px solid #155bffff; box-shadow:none;"><div class="card-header"><span class="card-title-en">Zones</span></div><div class="card-body"><canvas id="chartZones"></canvas></div></div>
                <div class="card" style="border:1px solid #155bffff; box-shadow:none;"><div class="card-header"><span class="card-title-en">Languages</span></div><div class="card-body"><canvas id="chartLangs"></canvas></div></div>
                <div class="card" style="border:1px solid #155bffff; box-shadow:none;"><div class="card-header"><span class="card-title-en">Methods of Receipt</span></div><div class="card-body"><canvas id="chartMethods"></canvas></div></div>
                <div class="card" style="border:1px solid #155bffff; box-shadow:none;"><div class="card-header"><span class="card-title-en">Priority</span></div><div class="card-body"><canvas id="chartPriority"></canvas></div></div>
            </div>
        </div>
    `;

    chartInstances.forEach(ch => ch.destroy());
    chartInstances = [];

    // Aggregations
    const zones = {}, langs = {}, methods = {}, priorities = {};
    filteredRows.forEach(r => {
        if (r.zone) zones[r.zone] = (zones[r.zone] || 0) + 1;

        let l = r.letterLanguage;
        l = l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : l === 'bi' ? 'Bilingual' : (l || 'Unknown');
        langs[l] = (langs[l] || 0) + 1;

        if (r.priority) priorities[r.priority] = (priorities[r.priority] || 0) + 1;

        (r.acquisitionMethod || '').split(', ').forEach(m => {
            if (m) methods[m] = (methods[m] || 0) + 1;
        });
    });

    const totalZones = Object.values(zones).reduce((a, b) => a + b, 0);
    const totalLangs = Object.values(langs).reduce((a, b) => a + b, 0);
    const totalMethods = Object.values(methods).reduce((a, b) => a + b, 0);
    const totalPriorities = Object.values(priorities).reduce((a, b) => a + b, 0);

    const statsHtml = `
        <div style="margin-top:20px; padding:15px; background:#f9f9f9; border-top:2px solid #ccc; font-size:12px; display:flex; gap:20px; justify-content:space-between; border-radius:5px;">
            <div style="flex:1;"><strong style="font-size:13px; color:#1a2e44; display:block; margin-bottom:5px;">Total Records: ${filteredRows.length}</strong></div>
            <div style="flex:1;"><strong style="color:#1a2e44;">Languages</strong><br>${Object.entries(langs).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${totalLangs}</strong></div>
            <div style="flex:1;"><strong style="color:#1a2e44;">Zones</strong><br>${Object.entries(zones).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${totalZones}</strong></div>
            <div style="flex:1;"><strong style="color:#1a2e44;">Methods</strong><br>${Object.entries(methods).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${totalMethods}</strong></div>
            <div style="flex:1;"><strong style="color:#1a2e44;">Priority</strong><br>${Object.entries(priorities).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${totalPriorities}</strong></div>
        </div>
    `;

    document.getElementById('reportsPDFContainer').innerHTML += statsHtml;

    const createChart = (id, type, dataObj, label) => {
        const ctx = document.getElementById(id);
        if (!ctx) return;
        chartInstances.push(new Chart(ctx, {
            type: type,
            data: {
                labels: Object.keys(dataObj),
                datasets: [{
                    label: label,
                    data: Object.values(dataObj),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        }));
    };

    createChart('chartZones', 'pie', zones, 'Zones');
    createChart('chartLangs', 'doughnut', langs, 'Languages');
    createChart('chartMethods', 'bar', methods, 'Methods');
    createChart('chartPriority', 'pie', priorities, 'Priority');
}

window.exportReportsPDF = function () {
    const el = document.getElementById('reportsPDFContainer');
    if (!el) return;
    showToast('Preparing PDF... Please wait.', 'info');
    setTimeout(() => {
        const opt = {
            margin: 15,
            filename: 'acquired_reports_charts.pdf',
            image: { type: 'jpeg', quality: 0.99 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true }
        };
        html2pdf().set(opt).from(el).toPdf().get('pdf').then(function (pdf) {
            var totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFont('times', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(100);
                pdf.text('Page ' + i + ' of ' + totalPages, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 5, { align: 'center' });
            }
        }).save();
    }, 1500); // Small delay to ensure charts are fully rendered
}

// ── Pincode API ───────────────────────────────────────────────────────────────────
function renderPendingTable() {
    // Pending = entries loaded but not yet "forwarded" (status === 'draft')
    const pending = allRows.filter(r => r.status === 'draft');
    const c = document.getElementById('pendingTableBody');
    if (!c) return;
    if (!pending.length) { c.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No pending letters.</p>'; return; }
    c.innerHTML = `<table><thead><tr><th>Date</th><th>Letter No.</th><th>Subject</th><th>From / Zone</th><th>Priority</th><th>Action</th></tr></thead><tbody>
    ${pending.slice(0, 20).map(r => `<tr>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate || '—'}</td>
        <td style="font-size:11.5px;color:var(--text2)">${r.letterNo || '—'}</td>
        <td><div class="td-subject-en">${r.subject || '—'}</div></td>
        <td style="font-size:12px">${r.officeName || '—'}<br><span class="zone-pill">${r.zone || ''}</span></td>
        <td><span class="forward-badge">Pending</span></td>
        <td>
            <div class="btn-group" style="gap:4px">
                <button class="btn btn-secondary btn-sm" onclick="editEntry(${r.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteEntry(${r.id})">Delete</button>
            </div>
        </td>
    </tr>`).join('')}</tbody></table>`;
}

// ── Zone auto-detect ──────────────────────────────────────────────────────────
const stateZoneHindi = {
    A: ['उत्तर क्षेत्र', '#1565C0'],
    B: ['दक्षिण क्षेत्र', '#E65100'],
    C: ['पूर्व क्षेत्र', '#2E7D32'],
};

window.onStateChange = function () {
    const sel = document.getElementById('addrState');
    const parts = (sel?.value || '').split('|');
    const zone = parts[1] || '';
    const disp = document.getElementById('zoneDisplay');
    if (!zone) { disp?.classList.add('hidden'); return; }
    const data = stateZoneHindi[zone];
    document.getElementById('zoneLabel').textContent = zone + ' Zone';
    document.getElementById('zoneHi').textContent = data ? data[0] : '';
    disp?.classList.remove('hidden');
};

window.onAddressChange = function () { /* hook for future geocoding */ };

window.onPincodeInput = async function (el) {
    el.value = el.value.replace(/\D/g, '');
    if (el.value.length === 6) {
        el.style.borderColor = 'var(--inward)';
        try {
            const res = await fetch(`/api/pincode/${el.value}`);
            const data = await res.json();
            if (data && data[0] && data[0].Status === 'Success') {
                const postOffice = data[0].PostOffice[0];
                const state = postOffice.State;
                const district = postOffice.District;
                const city = postOffice.Block !== 'NA' ? postOffice.Block : (postOffice.Region !== 'NA' ? postOffice.Region : district);
                const block = postOffice.Block !== 'NA' ? postOffice.Block : '';

                const cityEl = document.getElementById('addrCity');
                const distEl = document.getElementById('addrDistrict');
                const blockEl = document.getElementById('addrBlock');
                if (cityEl && !cityEl.value) cityEl.value = city;
                if (distEl && !distEl.value) distEl.value = district;
                if (blockEl && !blockEl.value) blockEl.value = block;

                const stateSelect = document.getElementById('addrState');
                if (stateSelect && !stateSelect.value) {
                    const options = Array.from(stateSelect.options);
                    const matchedOption = options.find(opt => {
                        const optStateName = opt.value.split('|')[0];
                        return optStateName.toLowerCase() === state.toLowerCase() || optStateName.toLowerCase().includes(state.toLowerCase());
                    });
                    if (matchedOption) {
                        stateSelect.value = matchedOption.value;
                        if (window.onStateChange) window.onStateChange();
                    }
                }
            }
        } catch (e) {
            console.error('Pincode fetch error:', e);
        }
    } else {
        el.style.borderColor = '';
    }
};

// ── Translation ───────────────────────────────────────────────────────────────
// Translation logic has been moved to /shared/translations.js
// ── Mode / Priority / Lang toggles ────────────────────────────────────────────
window.toggleMode = function (el) {
    const row = document.getElementById('modeRow');
    const sel = row.querySelectorAll('.mode-opt.selected');
    if (el.classList.contains('selected')) { el.classList.remove('selected'); }
    else {
        if (sel.length >= 3) { el.style.animation = 'shake 0.3s'; setTimeout(() => el.style.animation = '', 300); return; }
        el.classList.add('selected');
    }
    const n = row.querySelectorAll('.mode-opt.selected').length;
    const cnt = document.getElementById('modeCount');
    if (cnt) { cnt.textContent = `${n} of 3 selected — maximum 3 modes`; cnt.style.color = n === 3 ? 'var(--tertiary)' : 'var(--text3)'; }
};

window.selectPriority = function (el, type) {
    document.querySelectorAll('.priority-opt').forEach(p => p.classList.remove('sel-immediate', 'sel-priority'));
    el.classList.add('sel-' + type);
    const h = document.getElementById('priorityValue'); if (h) h.value = type;
};

window.selectLang = function (el) {
    document.querySelectorAll('#langRow .lang-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    const h = document.getElementById('langValue'); if (h) h.value = el.dataset.lang || '';
};

// ── Utility ───────────────────────────────────────────────────────────────────
window.clearForm = function () {
    ['letterNo', 'subjectEn', 'officeName', 'specificPerson', 'addrCity', 'addrDistrict', 'addrBlock', 'addrPin', 'recByName', 'recByDsgn', 'recByDept', 'remarksEn']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['subjectHi', 'officeNameHi', 'specificPersonHi', 'recByNameHi', 'recByDsgnHi', 'recByDeptHi', 'remarksHi']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    document.getElementById('zoneDisplay')?.classList.add('hidden');
    document.querySelectorAll('#modeRow .mode-opt').forEach((el, i) => el.classList.toggle('selected', i === 0));
    showToast('Form cleared', 'info');
};

window.showExportModal = function (type) {
    window.currentExportType = type || 'tabular';
    document.getElementById('exportModal').style.display = 'flex';
};

window.handleTabularExportDateRange = function () {
    const range = document.getElementById('tabularExportDateRange').value;
    document.getElementById('tabularExportMonthContainer').style.display = range === 'month' ? 'block' : 'none';
    document.getElementById('tabularExportCustomContainer').style.display = range === 'custom' ? 'flex' : 'none';
};

window.executeExportPDF = function () {
    const range = document.getElementById('tabularExportDateRange').value;
    let filteredRows = allRows;
    const now = new Date();

    if (range === 'month') {
        const monthVal = document.getElementById('tabularExportMonth')?.value;
        if (monthVal) {
            const [y, m] = monthVal.split('-');
            filteredRows = allRows.filter(r => {
                if (!r.acquiredOn) return false;
                const d = parseIndianDate(r.acquiredOn);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === parseInt(y) && (d.getMonth() + 1) === parseInt(m);
            });
        }
    } else if (range === '6months') {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).getTime();
        filteredRows = allRows.filter(r => {
            if (!r.acquiredOn) return false;
            return parseIndianDate(r.acquiredOn).getTime() >= sixMonthsAgo;
        });
    } else if (range === 'year') {
        const currentYear = now.getFullYear();
        filteredRows = allRows.filter(r => {
            if (!r.acquiredOn) return false;
            return parseIndianDate(r.acquiredOn).getFullYear() === currentYear;
        });
    } else if (range === 'custom') {
        const from = document.getElementById('tabularExportFrom')?.value;
        const to = document.getElementById('tabularExportTo')?.value;
        const fromTime = from ? new Date(from).getTime() : 0;
        const toTime = to ? new Date(to).getTime() + 86400000 : Infinity;
        filteredRows = allRows.filter(r => {
            if (!r.acquiredOn) return false;
            const t = parseIndianDate(r.acquiredOn).getTime();
            return t >= fromTime && t <= toTime;
        });
    }

    document.getElementById('exportModal').style.display = 'none';

    if (window.currentExportType === 'charts') {
        // Map the modal state to the report filters and force a reload and export
        document.getElementById('reportDateRange').value = range;
        if (range === 'month') document.getElementById('reportSpecificMonth').value = document.getElementById('tabularExportMonth').value;
        else if (range === 'custom') {
            document.getElementById('reportFrom').value = document.getElementById('tabularExportFrom').value;
            document.getElementById('reportTo').value = document.getElementById('tabularExportTo').value;
        }
        loadReports();
        setTimeout(() => exportReportsPDF(), 1500); // Wait for charts to render
    } else {
        exportToPDF(filteredRows);
    }
};

window.exportToPDF = function (filteredRows) {
    const exportData = Array.isArray(filteredRows) ? filteredRows : allRows;
    if (!exportData.length) { showToast('No data to export.', 'error'); return; }

    // ── 1. Column definitions ──────────────────────────────────────────────
    // [header label , data key , width , align ]
    const cols = [
        ['No.<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:6px;font-weight:normal;color:#333">क्र.सं.</span>', 'serialNo', '2%', 'center'],
        ['Date of Receipt<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:4px;font-weight:normal;color:#333">प्राप्ति तिथि</span>', 'acquiredOn', '10%', 'center'],
        ['Letter No. & Date<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:10px;font-weight:normal;color:#333">पत्र संख्या एवं तिथि</span>', 'letterNoDate', '10%', 'left'],
        ['Mode<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:10px;font-weight:normal;color:#333">माध्यम</span>', 'acquisitionMethod', '6%', 'left'],
        ['Received From (name|address|zone)<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:4px;font-weight:normal;color:#333">प्राप्तकर्ता (नाम|पता|क्षेत्र)</span>', 'sentByDetails', '18%', 'left'],
        ['Subject<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:10px;font-weight:normal;color:#333">विषय</span>', 'subjectDetails', '24%', 'left'],
        ['Priority<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:10px;font-weight:normal;color:#333">प्राथमिकता</span>', 'priority', '5%', 'centre'],
        ['Language<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:10px;font-weight:normal;color:#333">भाषा</span>', 'letterLanguage', '8%', 'centre']
    ];

    function esc(v) {
        return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── 2. Build thead ─────────────────────────────────────────────────────
    let thead = '<thead><tr>';
    cols.forEach(([label, , w]) => {
        thead += `<th style="width:${w}">${label}</th>`;
    });
    thead += '</tr></thead>';

    // ── 3. Build tbody ─────────────────────────────────────────────────────
    let tbody = '<tbody>';
    exportData.forEach((row, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#f5f5f5';
        tbody += `<tr style="background:${bg}">`;

        // Prepare combined fields
        const letterNoDate = [row.letterNo, row.letterDate].filter(Boolean).join(' - ');

        // Sent By block
        const nameParts = [row.officeName, row.specificPerson].filter(Boolean).join(' - ');
        const sentByParts = [
            nameParts ? `<b>${esc(nameParts)}</b>` : '',
            row.address ? esc(row.address) : '',
            row.zone ? `Zone: ${esc(row.zone)}` : ''
        ].filter(Boolean);
        let sentByDetails = sentByParts.join('<br>');

        // Hindi companion for Sent By
        const namePartsHi = [row.officeNameHindi, row.specificPersonHindi].filter(Boolean).join(' - ');
        const sentByHiParts = [
            namePartsHi ? `<b>${esc(namePartsHi)}</b>` : '',
            row.addressHindi ? esc(row.addressHindi) : ''
        ].filter(Boolean);
        if (sentByHiParts.length > 0) {
            sentByDetails += `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:8.5px;color:#222;margin-top:3px;padding-top:2px;border-top:1px solid #e0e0e0">${sentByHiParts.join('<br>')}</div>`;
        }

        // Subject details
        let subjectDetails = esc(row.subject || '');
        if (row.subjectHindi) {
            subjectDetails += `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:8.5px;color:#222;margin-top:3px;padding-top:2px;border-top:1px solid #e0e0e0">${esc(row.subjectHindi)}</div>`;
        }

        cols.forEach(([, key, , align]) => {
            let val = '';
            if (key === 'letterNoDate') val = esc(letterNoDate);
            else if (key === 'sentByDetails') val = sentByDetails;
            else if (key === 'subjectDetails') val = subjectDetails;
            else if (key === 'letterLanguage') {
                const l = row[key] || '';
                val = esc(l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : l === 'bi' ? 'Bilingual' : l);
            }
            else val = esc(row[key] || '');

            tbody += `<td style="text-align:${align};vertical-align:top">${val}</td>`;
        });
        tbody += '</tr>';
    });
    tbody += '</tbody>';

    // ── 4. Assemble HTML string ────────────────────────────────────────────
    const headerHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 0.5px solid #000; padding-bottom: 10px;">
        <img src="/images/NIC Logo JPG/BILINGUAL _SQUARE_NIC_Logo_white_bg-01.jpg" alt="NIC Logo" style="height:55px;" />
        <div style="text-align:center; flex:1;">
            <h2 style="margin:0 0 3px 0; font-family:'Times New Roman', Times, serif; font-size:18px; font-weight:bold;">National Informatics Centre / राष्ट्रीय सूचना विज्ञान केंद्र</h2>
            <h3 style="margin:0; font-family:'Times New Roman', Times, serif; font-size:15px; font-weight:normal;">Meghalaya State Centre, Shillong - 793003 / मेघालय राज्य केंद्र, शिलांग - 793003</h3>
        </div>
        <img src="/images/digital-india.png" alt="Govt Logo" style="height:55px;" />
      </div>
    `;

    const p_langs = {}, p_zones = {}, p_methods = {}, p_priorities = {};
    exportData.forEach(r => {
        let l = r.letterLanguage; l = l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : l === 'bi' ? 'Bilingual' : (l || 'Unknown'); p_langs[l] = (p_langs[l] || 0) + 1;
        if (r.zone) p_zones[r.zone] = (p_zones[r.zone] || 0) + 1;
        (r.acquisitionMethod || '').split(', ').forEach(m => { if (m) p_methods[m] = (p_methods[m] || 0) + 1; });
        if (r.priority) p_priorities[r.priority] = (p_priorities[r.priority] || 0) + 1;
    });
    const t_langs = Object.values(p_langs).reduce((a, b) => a + b, 0);
    const t_zones = Object.values(p_zones).reduce((a, b) => a + b, 0);
    const t_methods = Object.values(p_methods).reduce((a, b) => a + b, 0);
    const t_priorities = Object.values(p_priorities).reduce((a, b) => a + b, 0);

    const htmlContent = `
        <div style="font-family: 'Times New Roman', Times, serif; padding: 5mm; background: white; width: 267mm; color: #000;">
            <style>
                .pdf-print-area table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 0.5px solid #000; }
                .pdf-print-area th { 
                    background-color: #f0f0f0 !important; color: #000 !important; 
                    padding: 4px; font-size: 9px; border: 1px solid #000; 
                    text-align: center; word-wrap: break-word; font-weight: bold;
                }
                .pdf-print-area td { 
                    border: 0.5px solid #000; padding: 4px; font-size: 9px; color: #000 !important; 
                    line-height: 1.3; word-wrap: break-word; vertical-align: top; 
                    white-space: normal; overflow-wrap: break-word; 
                }
                .pdf-print-area th:first-child { padding-left: 2px; padding-right: 2px; }
                .pdf-print-area td:first-child { text-align: center; font-weight: bold; padding-left: 2px; padding-right: 2px; }
                .pdf-print-area tr:nth-child(even) td { background-color: #fafafa !important; }
            </style>
            ${headerHtml}
            <h2 style="text-align: center; font-family: 'Times New Roman', Times, serif; font-size: 12px; font-weight: bold; margin: 0 0 5px; text-decoration: underline;">DAK Acquired Register</h2>
            <div style="text-align: center; font-size: 9px; margin-bottom: 10px; color: #0059ffff;">Printed on ${new Date().toLocaleDateString('en-IN')} &nbsp;|&nbsp; ${exportData.length} record(s)</div>
            <div class="pdf-print-area">
                <table>${thead}${tbody}</table>
            </div>

            <!-- Stats Block -->
            <div style="margin-top:20px; padding-top:10px; border-top:2px solid #ccc; font-size:11px; display:flex; gap:30px; justify-content:space-between; background:#f9f9f9; padding:15px; border-radius:5px;">
                <div style="flex:1;">
                    <strong style="font-size:12px; color:#1a2e44; display:block; margin-bottom:5px;">Total Records: ${exportData.length}</strong>
                </div>
                <div style="flex:1;">
                    <strong style="color:#1a2e44;">Languages</strong><br>
                    ${Object.entries(p_langs).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${t_langs}</strong>
                </div>
                <div style="flex:1;">
                    <strong style="color:#1a2e44;">Zones</strong><br>
                    ${Object.entries(p_zones).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${t_zones}</strong>
                </div>
                <div style="flex:1;">
                    <strong style="color:#1a2e44;">Methods</strong><br>
                    ${Object.entries(p_methods).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${t_methods}</strong>
                </div>
                <div style="flex:1;">
                    <strong style="color:#1a2e44;">Priority</strong><br>
                    ${Object.entries(p_priorities).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${t_priorities}</strong>
                </div>
            </div>
        </div>
    `;

    const opt = {
        margin: [15, 15, 15, 15],
        filename: `DAK_Acquired_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true },
        pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' }
    };

    html2pdf().set(opt).from(htmlContent).toPdf().get('pdf').then(function (pdf) {
        var totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFont('times', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(100);
            pdf.text('Page ' + i + ' of ' + totalPages, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 5, { align: 'center' });
        }
    }).save()
        .then(() => {
            showToast('PDF exported successfully!', 'success');
        })
        .catch(err => {
            showToast('Error generating PDF: ' + err.message, 'error');
        });
};

window.handleQuickSearch = function (v) {
    if (v.length > 1) { showPage('search'); document.getElementById('searchInput').value = v; filterTable(v); }
};

function showToast(msg, type = 'info') {
    const t = document.createElement('div'); t.className = 'toast toast-' + type; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
}

const s = document.createElement('style');
s.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}';
document.head.appendChild(s);
