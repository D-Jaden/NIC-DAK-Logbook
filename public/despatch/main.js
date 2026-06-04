// ─────────────────────────────────────────────
//  despatch/main.js  — Entry point
//  Talks to /api/despatch/* routes
// ─────────────────────────────────────────────

import { stateOptionsHTML } from '../shared/zone.js';

let accessToken = null;
const AUTH = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken });

const originalFetch = window.fetch;
window.fetch = async function() {
    let response = await originalFetch.apply(this, arguments);
    if (response.status === 401) {
        // Access token expired or missing, try to refresh
        const refreshRes = await originalFetch('/users/refresh-token', { method: 'POST' });
        if (refreshRes.ok) {
            const data = await refreshRes.json();
            if (data.success && data.token) {
                accessToken = data.token;
                // Retry original request
                const [url, options] = arguments;
                if (options && options.headers) {
                    options.headers['Authorization'] = 'Bearer ' + accessToken;
                }
                return originalFetch(url, options);
            }
        }
        // If refresh fails, redirect to login
        window.location.href = '/';
        return response;
    }
    return response;
};

// Immediately get token on load
originalFetch('/users/refresh-token', { method: 'POST' }).then(res => res.json()).then(data => {
    if (data.success && data.token) {
        accessToken = data.token;
    } else {
        window.location.href = '/';
    }
}).catch(() => { window.location.href = '/'; });


const TAB_MAP = { entry: 0, dashboard: 1, search: 2, pending: 3, reports: 4 };
let allRows = [];      // cached loaded data
let copyCount = 2;     // tracks dynamic copy entries

// ── Page navigation ──────────────────────────────────────────────────────────
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
    if (name === 'reports') loadReports();
};

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Populate state dropdowns
    ['c1state', 'c2state', 'sentToState'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = stateOptionsHTML();
    });
    // Default dates to today
    const today = new Date().toISOString().split('T')[0];
    ['despatchDate', 'letterDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = today;
    });
    // Auto serial display
    const sn = document.getElementById('headerSerial');
    if (sn) sn.textContent = 'NEW';
    fetchNextSerial();
});

async function fetchNextSerial() {
    try {
        const res = await fetch('/api/despatch/next-serial', { headers: AUTH() });
        const json = await res.json();
        if (json.success) {
            const sn = document.getElementById('headerSerial');
            if (sn) sn.textContent = json.nextSerial;
        }
    } catch (e) {
        console.error('Failed to fetch next serial', e);
    }
}

let currentEditId = null;

// ── Save entry ────────────────────────────────────────────────────────────────
window.submitEntry = async function (isDraft = false) {
    if (isDraft && isDraft.type) isDraft = false; // Ignore event object

    if (!isDraft) {
        const requiredIds = [
            'despatchDate', 'letterNo', 'letterDate', 'subjectEn',
            'sentByName', 'sentByDsgn', 'sentByDept',
            'sentToName', 'sentToPin', 'sentToState', 'sentToCity', 'sentToDistrict', 'sentToAddr'
        ];

        const emptyFields = requiredIds.filter(id => {
            const el = document.getElementById(id);
            return el && !el.value.trim();
        });

        if (emptyFields.length > 0) {
            showToast('Please fill all fields (except remarks/copy) before saving.', 'error');
            return;
        }
    }

    const letterDateVal = document.getElementById('letterDate')?.value;
    const despatchDateVal = document.getElementById('despatchDate')?.value;
    if (letterDateVal && despatchDateVal) {
        if (new Date(letterDateVal) > new Date(despatchDateVal)) {
            showToast('Date of Letter cannot be greater than Date of Despatch', 'error');
            return;
        }
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = currentEditId ? 'Updating…' : 'Saving…';
    try {
        const payload = buildPayload();
        payload.status = isDraft ? 'draft' : 'submitted';
        let endpoint = '/api/despatch/save';
        let body = { data: [payload] };

        if (currentEditId) {
            endpoint = '/api/despatch/save-changes';
            payload.id = currentEditId;
            body = { changedRows: [payload], newRows: [] };
        }

        const res = await fetch(endpoint, { method: 'POST', headers: AUTH(), body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) {
            showToast(currentEditId ? 'Entry updated successfully ✓' : (isDraft ? 'Draft saved ✓' : 'Entry saved successfully ✓'), 'success');
            clearForm();
            currentEditId = null;
            btn.textContent = 'Save & Submit';
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
        btn.disabled = false; btn.textContent = currentEditId ? 'Update Entry' : 'Save & Submit';
    }
};

window.saveDraft = async function () {
    await submitEntry(true);
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
            name: document.getElementById('c' + n + 'name')?.value || '',
            office: document.getElementById('c' + n + 'office')?.value || '',
            city: document.getElementById('c' + n + 'city')?.value || '',
            district: document.getElementById('c' + n + 'district')?.value || '',
            state: parts[0] || '',
            zone: parts[1] || '',
            pin: document.getElementById('c' + n + 'pin')?.value || '',
        });
    });
    return {
        serialNo: null,   // auto-assigned by DB
        letterDate: formatDateForAPI(document.getElementById('letterDate')?.value),
        despatchDate: formatDateForAPI(document.getElementById('despatchDate')?.value),
        letterNo: document.getElementById('letterNo')?.value || '',
        modes,
        // Sent By
        sentByName: document.getElementById('sentByName')?.value || '',
        sentByDesignation: document.getElementById('sentByDsgn')?.value || '',
        sentByDepartment: document.getElementById('sentByDept')?.value || '',
        sentByNameHi: document.getElementById('sentByNameHi')?.textContent || '',
        sentByDesignationHi: document.getElementById('sentByDsgnHi')?.textContent || '',
        sentByDepartmentHi: document.getElementById('sentByDeptHi')?.textContent || '',
        // Sent To
        sentToName: document.getElementById('sentToName')?.value || '',
        sentToNameHi: document.getElementById('sentToNameHi')?.textContent || '',
        sentToAddress: (document.getElementById('sentToAddr')?.value || '') + '#META#' + JSON.stringify({
            pin: document.getElementById('sentToPin')?.value || '',
            state: document.getElementById('sentToState')?.value || '',
            city: document.getElementById('sentToCity')?.value || '',
            district: document.getElementById('sentToDistrict')?.value || ''
        }),
        sentToAddressHi: document.getElementById('sentToAddrHi')?.textContent || '',
        sentToZone: document.getElementById('sentToZone')?.value || '',
        // Subject
        subject: document.getElementById('subjectEn')?.value || '',
        subjectHindi: document.getElementById('subjectHi')?.textContent || '',
        // Copy
        copies,
        // Meta
        letterLanguage: document.getElementById('langValue')?.value || 'hi',
        priority: document.getElementById('priorityValue')?.value || 'priority',
        zone: document.getElementById('sentToZone')?.value?.replace(' Zone', '') || '',
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
        logoutBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout? Remember To Save')) {
                try {
                    await fetch('/users/logout', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                } catch(e) {}
            
                window.location.href = '/';
            }
        });
    }
});

// ── Load data ─────────────────────────────────────────────────────────────────
window.loadData = async function () {
    try {
        const res = await fetch('/api/despatch/load', { headers: AUTH() });
        const json = await res.json();
        if (json.success) {
            allRows = json.data || [];
            const submittedRows = allRows.filter(r => r.status === 'submitted');
            const draftRows = allRows.filter(r => r.status === 'draft');
            showToast(`Loaded ${submittedRows.length} records, ${draftRows.length} drafts`, 'info');
            renderPendingTable(draftRows);
            showPage('search');
        } else showToast(json.error || 'Load failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res = await fetch('/api/despatch/stats', { headers: AUTH() });
        const json = await res.json();
        if (!json.success) return;
        document.getElementById('statTotal')?.setAttribute('innerText', json.total);
        document.getElementById('statTotal').textContent = String(json.total).padStart(3, '0');
        document.getElementById('statZones').textContent = json.byZone?.length || 0;
        document.getElementById('statLangs').textContent = json.byLanguage?.length || 0;
        // Load recent entries for the table
        const res2 = await fetch('/api/despatch/load', { headers: AUTH() });
        const json2 = await res2.json();
        if (json2.success) {
            allRows = json2.data || [];
            const submittedRows = allRows.filter(r => r.status === 'submitted');
            renderRecentTable(submittedRows.slice(-10).reverse());

            // Priority counts
            const statImm = document.getElementById('statImmediate');
            if (statImm) statImm.textContent = submittedRows.filter(r => r.priority === 'immediate').length;
            const statPri = document.getElementById('statPriority');
            if (statPri) statPri.textContent = submittedRows.filter(r => r.priority === 'priority').length;
        }
    } catch (e) { console.error('[dashboard]', e); }
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
    renderSearchTable(allRows.filter(r => r.status === 'submitted'));
}

window.filterTable = function (q) {
    const query = (q || document.getElementById('searchInput')?.value || '').toLowerCase();
    const zone = document.getElementById('filterZone')?.value || '';
    const prio = document.getElementById('filterPriority')?.value || '';
    const mode = document.getElementById('filterMode')?.value || '';
    const from = document.getElementById('filterFrom')?.value || '';
    const to = document.getElementById('filterTo')?.value || '';

    let rows = allRows.filter(r => r.status === 'submitted');
    if (query) rows = rows.filter(r => [r.subject, r.letterNo, r.sentToName, r.sentBy].some(f => (f || '').toLowerCase().includes(query)));
    if (zone) rows = rows.filter(r => (r.sentToZone || '').includes(zone));
    if (prio) rows = rows.filter(r => (r.priority || '') === prio);
    if (mode) rows = rows.filter(r => (r.deliveryMethod || '').toLowerCase().includes(mode));
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
    const container = document.getElementById('searchTableBody');
    if (!rows.length) { container.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No matching records.</p>'; return; }
    container.innerHTML = `<div class="table-responsive"><table><thead><tr><th>S.No.</th><th>Date</th><th>Letter No.</th><th>Subject</th><th>Sent To / Zone</th><th>Mode(s)</th><th>Lang</th><th>Actions</th></tr></thead><tbody>
    ${rows.map(r => `<tr>
        <td class="td-serial">${r.serialNo || '—'}</td>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate || '—'}</td>
        <td style="font-size:11.5px;color:var(--text2)">${r.letterNo || '—'}</td>
        <td><div class="td-subject-en">${r.subject || '—'}</div><span class="td-subject-hi">${r.subjectHindi || ''}</span></td>
        <td style="font-size:12px">${r.sentToName || '—'}<br><span style="color:var(--text3);font-size:11px">${r.sentToZone || ''}</span></td>
        <td><div class="mode-tags">${(r.deliveryMethod || '').split(', ').filter(Boolean).map(m => `<span class="mode-tag">${m}</span>`).join('')}</div></td>
        <td style="font-size:12px">${r.letterLanguage || '—'}</td>
        <td>
            <div class="btn-group" style="gap:4px">
                <button class="btn btn-secondary btn-sm" onclick="editEntry(${r.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteEntry(${r.id})">Delete</button>
            </div>
        </td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

window.renderPendingTable = function (rows) {
    const container = document.getElementById('pendingTableBody');
    if (!container) return;
    if (!rows || !rows.length) { container.innerHTML = '<p style="padding:20px;color:var(--text3);font-size:13px">No pending drafts.</p>'; return; }
    container.innerHTML = `<div class="table-responsive"><table><thead><tr><th>Date</th><th>Subject</th><th>Sent To</th><th>Actions</th></tr></thead><tbody>
    ${rows.map(r => `<tr>
        <td style="font-size:12px;white-space:nowrap">${r.letterDate || '—'}</td>
        <td><div class="td-subject-en">${r.subject || '—'}</div><span class="td-subject-hi">${r.subjectHindi || ''}</span></td>
        <td style="font-size:12px">${r.sentToName || '—'}<br><span style="color:var(--text3);font-size:11px">${r.sentToZone || ''}</span></td>
        <td>
            <div class="btn-group" style="gap:4px">
                <button class="btn btn-secondary btn-sm" onclick="editEntry(${r.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteEntry(${r.id})">Delete</button>
            </div>
        </td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

// ── Edit & Delete ─────────────────────────────────────────────────────────────
window.editEntry = function (id) {
    const row = allRows.find(r => r.id === id);
    if (!row) return;
    currentEditId = id;

    // Populate form
    document.getElementById('letterDate').value = (row.letterDate || '').split('/').reverse().join('-');
    document.getElementById('despatchDate').value = (row.despatchDate || '').split('/').reverse().join('-');
    document.getElementById('letterNo').value = row.letterNo || '';
    document.getElementById('subjectEn').value = row.subject || '';
    document.getElementById('subjectHi').textContent = row.subjectHindi || 'यहाँ अनुवाद स्वतः दिखेगा…';
    document.getElementById('sentToName').value = row.sentToName || '';
    document.getElementById('sentToNameHi').textContent = row.sentToNameHi || 'प्राप्तकर्ता का नाम…';
    let addrStr = row.sentToAddress || '';
    if (addrStr.includes('#META#')) {
        const parts = addrStr.split('#META#');
        document.getElementById('sentToAddr').value = parts[0];
        try {
            const meta = JSON.parse(parts[1]);
            document.getElementById('sentToPin').value = meta.pin || '';
            document.getElementById('sentToState').value = meta.state || '';
            document.getElementById('sentToCity').value = meta.city || '';
            document.getElementById('sentToDistrict').value = meta.district || '';
        } catch (e) { }
    } else {
        document.getElementById('sentToAddr').value = addrStr;
    }

    document.getElementById('sentToAddrHi').textContent = row.sentToAddressHi || 'पूर्ण पता…';
    document.getElementById('sentToZone').value = row.zone ? `${row.zone} Zone` : '';

    const sentByParts = (row.sentBy || '').split(' | ');
    document.getElementById('sentByName').value = sentByParts[0] || '';
    document.getElementById('sentByDsgn').value = sentByParts[1] || '';
    document.getElementById('sentByDept').value = sentByParts[2] || '';

    const sentByHiParts = (row.sentByHindi || '').split(' | ');
    document.getElementById('sentByNameHi').textContent = sentByHiParts[0] || 'अधिकारी का नाम…';
    document.getElementById('sentByDsgnHi').textContent = sentByHiParts[1] || 'पदनाम…';
    document.getElementById('sentByDeptHi').textContent = sentByHiParts[2] || 'विभाग / शाखा…';

    for (let i = 1; i <= 2; i++) {
        const el = document.getElementById(`c${i}name`);
        if (el) {
            el.value = '';
            document.getElementById(`c${i}office`).value = '';
            document.getElementById(`c${i}city`).value = '';
            document.getElementById(`c${i}district`).value = '';
            document.getElementById(`c${i}pin`).value = '';
            document.getElementById(`c${i}state`).value = '';
        }
    }
    try {
        if (row.copySentTo) {
            const copies = JSON.parse(row.copySentTo);
            copies.forEach((c, idx) => {
                const n = idx + 1;
                const nameEl = document.getElementById(`c${n}name`);
                if (nameEl) {
                    nameEl.value = c.name || '';
                    document.getElementById(`c${n}office`).value = c.office || '';
                    document.getElementById(`c${n}city`).value = c.city || '';
                    document.getElementById(`c${n}district`).value = c.district || '';
                    document.getElementById(`c${n}pin`).value = c.pin || '';
                    document.getElementById(`c${n}state`).value = c.state ? `${c.state}|${c.zone}` : '';
                }
            });
        }
    } catch (e) { }

    const modes = (row.deliveryMethod || '').split(', ');
    document.querySelectorAll('#modeRow .mode-opt').forEach(el => {
        if (modes.includes(el.dataset.mode)) el.classList.add('selected');
        else el.classList.remove('selected');
    });

    document.querySelectorAll('#langRow .mode-opt').forEach(el => {
        if (el.dataset.lang === row.letterLanguage) el.classList.add('selected');
        else el.classList.remove('selected');
    });
    document.getElementById('langValue').value = row.letterLanguage || 'hi';

    const btn = document.getElementById('submitBtn');
    btn.textContent = 'Update Entry';
    showPage('entry');
    showToast('Entry loaded for editing', 'info');
};

window.deleteEntry = async function (id) {
    if (!confirm('Are you sure you want to delete this entry? This cannot be undone.')) return;
    try {
        const res = await fetch(`/api/despatch/delete/${id}`, { method: 'DELETE', headers: AUTH() });
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
                if (!r.despatchDate) return false;
                const d = parseIndianDate(r.despatchDate);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === parseInt(y) && (d.getMonth() + 1) === parseInt(m);
            });
        }
    } else if (range === '6months') {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).getTime();
        filteredRows = allRows.filter(r => {
            if (!r.despatchDate) return false;
            return parseIndianDate(r.despatchDate).getTime() >= sixMonthsAgo;
        });
    } else if (range === 'year') {
        const currentYear = now.getFullYear();
        filteredRows = allRows.filter(r => {
            if (!r.despatchDate) return false;
            return parseIndianDate(r.despatchDate).getFullYear() === currentYear;
        });
    } else if (range === 'custom') {
        const from = document.getElementById('reportFrom')?.value;
        const to = document.getElementById('reportTo')?.value;
        const fromTime = from ? new Date(from).getTime() : 0;
        const toTime = to ? new Date(to).getTime() + 86400000 : Infinity; // add 1 day
        filteredRows = allRows.filter(r => {
            if (!r.despatchDate) return false;
            const t = parseIndianDate(r.despatchDate).getTime();
            return t >= fromTime && t <= toTime;
        });
    }

    const container = document.getElementById('reportsContent');
    container.innerHTML = `
        <div id="reportsPDFContainer" style="background:#fff; padding:20px; font-family:'Times New Roman', Times, serif; color:#000;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom: 1px solid #000; padding-bottom: 10px;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <img src="/images/digital-india.png" alt="Govt Logo" style="height:55px;" />
                </div>
                <div style="text-align:center; flex:1;">
                    <h2 style="margin:0 0 3px 0; font-family:'Times New Roman', Times, serif; font-size:14px; font-weight:bold;">Government of India / भारत सरकार</h2>
                    <h3 style="margin:0 0 3px 0; font-family:'Times New Roman', Times, serif; font-size:12px; font-weight:bold;">Ministry Of Electronics And Information Technology / इलेक्ट्रॉनिक्स और सूचना प्रौद्योगिकी मंत्रालय</h3>
                    <h4 style="margin:0 0 3px 0; font-family:'Times New Roman', Times, serif; font-size:12px; font-weight:bold;">National Informatics Centre / राष्ट्रीय सूचना विज्ञान केंद्र</h4>
                    <h5 style="margin:0 0 8px 0; font-size:10px; font-weight:bold;">Meghalaya State Centre, Shillong - 793003 / मेघालय राज्य केंद्र, शिलांग - 793003</h5>
                    <h6 style="margin:0; font-size:12px; font-weight:bold; text-decoration:underline;">DAK Despatch Register - Analytics Report</h6>
                    <p style="margin:4px 0 0 0; font-size:10px;">Total Records: <strong>${filteredRows.length}</strong> | Filter: ${range} | Exported On: ${new Date().toLocaleString('en-IN')}</p>
                </div>
                <img src="/images/NIC Logo JPG/BILINGUAL _SQUARE_NIC_Logo_white_bg-01.jpg" alt="NIC Logo" style="height:55px;" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
                <div class="card" style="border:1px solid #ccc; box-shadow:none;"><div class="card-header"><span class="card-title-en">Zones</span></div><div class="card-body" style="height:350px"><canvas id="chartZones"></canvas></div></div>
                <div class="card" style="border:1px solid #ccc; box-shadow:none;"><div class="card-header"><span class="card-title-en">Languages</span></div><div class="card-body" style="height:350px"><canvas id="chartLangs"></canvas></div></div>
            </div>
            <div class="html2pdf__page-break"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div class="card" style="border:1px solid #ccc; box-shadow:none;"><div class="card-header"><span class="card-title-en">Delivery Methods</span></div><div class="card-body" style="height:350px"><canvas id="chartMethods"></canvas></div></div>
                <div class="card" style="border:1px solid #ccc; box-shadow:none;"><div class="card-header"><span class="card-title-en">Priority</span></div><div class="card-body" style="height:350px"><canvas id="chartPriority"></canvas></div></div>
            </div>
        </div>
    `;

    chartInstances.forEach(c => c.destroy());
    chartInstances = [];

    // Aggregations
    const zones = {}, langs = {}, methods = {}, priorities = {};
    filteredRows.forEach(r => {
        if (r.sentToZone) zones[r.sentToZone] = (zones[r.sentToZone] || 0) + 1;

        let l = r.letterLanguage;
        l = l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : l === 'bi' ? 'Bilingual' : (l || 'Unknown');
        langs[l] = (langs[l] || 0) + 1;

        (r.deliveryMethod || '').split(', ').forEach(m => {
            if (m) methods[m] = (methods[m] || 0) + 1;
        });
        const p = r.priority || 'Routine';
        priorities[p] = (priorities[p] || 0) + 1;
    });

    // Calculate totals for charts
    const totalZones = Object.values(zones).reduce((a, b) => a + b, 0);
    const totalLangs = Object.values(langs).reduce((a, b) => a + b, 0);
    const totalMethods = Object.values(methods).reduce((a, b) => a + b, 0);
    const totalPriorities = Object.values(priorities).reduce((a, b) => a + b, 0);

    const statsHtml = `
        <div style="margin-top:20px; padding:15px; background:#f9f9f9; border-top:2px solid #ccc; font-size:12px; display:flex; gap:20px; justify-content:space-between; border-radius:5px;">
            <div style="flex:1;"><strong style="font-size:13px; color:#1a2e44; display:block; margin-bottom:5px;">Total Records: ${filteredRows.length}</strong></div>
            <div style="flex:1;"><strong style="color:#1a2e44;">Languages</strong><br>${Object.entries(langs).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${totalLangs}</strong></div>
            <div style="flex:1;"><strong style="color:#1a2e44;">Zones Sent To</strong><br>${Object.entries(zones).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${totalZones}</strong></div>
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

    createChart('chartZones', 'pie', zones, 'Zones Sent To');
    createChart('chartLangs', 'doughnut', langs, 'Languages');
    createChart('chartMethods', 'bar', methods, 'Delivery Methods');
    createChart('chartPriority', 'pie', priorities, 'Priority');
}

window.exportReportsPDF = function () {
    const el = document.getElementById('reportsPDFContainer');
    if (!el) return;
    showToast('Preparing PDF... Please wait.', 'info');
    setTimeout(() => {
        const opt = {
            margin: 15,
            filename: 'despatch_reports_charts.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true }
        };
        html2pdf().set(opt).from(el).toPdf().get('pdf').then(function (pdf) {
            var totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFont('times', 'normal');
                pdf.setFontSize(10);
                pdf.setTextColor(100);
                pdf.text('Page ' + i + ' of ' + totalPages, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 5, { align: 'center' });
            }
        }).save();
    }, 1500); // Small delay to ensure charts are fully rendered
}

// ── Utility: translation ──────────────────────────────────────────────────────
// Translation logic has been moved to /shared/translations.js

// ── Utility: mode toggle ──────────────────────────────────────────────────────
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
    if (cnt) { cnt.textContent = `${n} of 3 selected — maximum 3 modes allowed`; cnt.style.color = n === 3 ? 'var(--tertiary)' : 'var(--text3)'; }
};

// ── Utility: priority / lang ──────────────────────────────────────────────────
window.selectPriority = function (el, type) {
    document.querySelectorAll('.priority-opt').forEach(p => p.classList.remove('sel-immediate', 'sel-priority'));
    el.classList.add('sel-' + type);
    const h = document.getElementById('priorityValue'); if (h) h.value = type;
};
window.selectLang = function (el) {
    document.querySelectorAll('#langRow .mode-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    const h = document.getElementById('langValue'); if (h) h.value = el.dataset.lang || '';
};

// ── Utility: copy recipients ──────────────────────────────────────────────────
const zoneHindiMap = {
    A: ['उत्तर क्षेत्र', 'A Zone'],
    B: ['दक्षिण क्षेत्र', 'B Zone'],
    C: ['पूर्व क्षेत्र', 'C Zone'],
};

window.onSentToStateChange = function () {
    const stateVal = document.getElementById('sentToState')?.value || '';
    if (!stateVal) return;
    const parts = stateVal.split('|');
    const zone = parts[1] || '';
    const zoneSelect = document.getElementById('sentToZone');
    if (zone && zoneSelect) {
        zoneSelect.value = zone;
        if (window.triggerTranslate) window.triggerTranslate('sentToZone', 'sentToZoneHi');
    }
};

window.onSentToPin = async function (el) {
    el.value = el.value.replace(/\D/g, '');
    if (el.value.length === 6) {
        try {
            const res = await fetch(`/api/pincode/${el.value}`);
            const data = await res.json();
            if (data && data[0] && data[0].Status === 'Success') {
                const postOffice = data[0].PostOffice[0];
                const state = postOffice.State;
                const district = postOffice.District;
                const city = postOffice.Block !== 'NA' ? postOffice.Block : (postOffice.Region !== 'NA' ? postOffice.Region : district);

                const cityEl = document.getElementById('sentToCity');
                const distEl = document.getElementById('sentToDistrict');
                if (cityEl && !cityEl.value) cityEl.value = city;
                if (distEl && !distEl.value) distEl.value = district;

                const stateSelect = document.getElementById('sentToState');
                if (stateSelect && !stateSelect.value) {
                    const options = Array.from(stateSelect.options);
                    const matchedOption = options.find(opt => {
                        const optStateName = opt.value.split('|')[0];
                        return optStateName.toLowerCase() === state.toLowerCase() || optStateName.toLowerCase().includes(state.toLowerCase());
                    });
                    if (matchedOption) {
                        stateSelect.value = matchedOption.value;
                        if (window.onSentToStateChange) window.onSentToStateChange();
                    }
                }
            }
        } catch (e) {
            console.error('Pincode fetch error:', e);
        }
    }
};

window.onCopyStateChange = function (n) {
    const sel = document.getElementById('c' + n + 'state');
    const parts = (sel?.value || '').split('|');
    const zone = parts[1] || '';
    const tag = document.getElementById('c' + n + 'zone');
    const lbl = document.getElementById('c' + n + 'zoneLabel');
    const hi = document.getElementById('c' + n + 'zoneHi');
    const data = zoneHindiMap[zone];
    if (data && tag && lbl && hi) {
        lbl.textContent = data[1]; hi.textContent = ' — ' + data[0];
        tag.classList.add('visible');
    } else if (tag) tag.classList.remove('visible');
};

window.onCopyPin = async function (el, n) {
    el.value = el.value.replace(/\D/g, '');
    if (el.value.length === 6) {
        try {
            const res = await fetch(`/api/pincode/${el.value}`);
            const data = await res.json();
            if (data && data[0] && data[0].Status === 'Success') {
                const postOffice = data[0].PostOffice[0];
                const state = postOffice.State;
                const district = postOffice.District;
                const city = postOffice.Block !== 'NA' ? postOffice.Block : (postOffice.Region !== 'NA' ? postOffice.Region : district);

                const cityEl = document.getElementById('c' + n + 'city');
                const distEl = document.getElementById('c' + n + 'district');
                if (cityEl) cityEl.value = city;
                if (distEl) distEl.value = district;

                const stateSelect = document.getElementById('c' + n + 'state');
                if (stateSelect) {
                    const options = Array.from(stateSelect.options);
                    const matchedOption = options.find(opt => {
                        const optStateName = opt.value.split('|')[0];
                        return optStateName.toLowerCase() === state.toLowerCase() || optStateName.toLowerCase().includes(state.toLowerCase());
                    });
                    if (matchedOption) {
                        stateSelect.value = matchedOption.value;
                        if (window.onCopyStateChange) window.onCopyStateChange(n);
                    }
                }
            }
        } catch (e) {
            console.error('Pincode fetch error:', e);
        }
    }
};

window.addCopyEntry = function () {
    if (copyCount >= 8) { showToast('Maximum 8 copy recipients', 'info'); return; }
    copyCount++;
    const n = copyCount;
    const grid = document.getElementById('copyGrid');
    const div = document.createElement('div');
    div.className = 'copy-entry'; div.id = 'copy-entry-' + n;
    div.innerHTML = `
    <div class="copy-entry-header">
      <span class="copy-entry-no">Copy #${n}</span>
      <span class="copy-zone-tag" id="c${n}zone"><span class="zdot"></span><span id="c${n}zoneLabel">—</span><span class="zhi" id="c${n}zoneHi"></span></span>
    </div>
    <div class="field" style="margin-bottom:7px"><span class="field-label">Name <span class="field-label-hi">/ नाम</span></span><input type="text" id="c${n}name" placeholder="Name…" oninput="triggerTranslate('c${n}name','c${n}nameHi')"></div>
    <div class="field" style="margin-bottom:7px"><span class="field-label">Office / Room No.</span><input type="text" id="c${n}office" placeholder="e.g. Room 201"></div>
    <div class="copy-addr-row">
      <div class="field"><span class="field-label" style="font-size:10px">Pincode</span><input type="text" id="c${n}pin" placeholder="6-digit" maxlength="6" oninput="onCopyPin(this, ${n})"></div>
      <div class="field"><span class="field-label" style="font-size:10px">State <span class="field-label-hi">/ राज्य</span></span><select id="c${n}state" onchange="onCopyStateChange(${n})">${stateOptionsHTML()}</select></div>
    </div>
    <div class="copy-addr-row">
      <div class="field"><span class="field-label" style="font-size:10px">City <span class="field-label-hi">/ शहर</span></span><input type="text" id="c${n}city" placeholder="City…"></div>
      <div class="field"><span class="field-label" style="font-size:10px">District <span class="field-label-hi">/ जिला</span></span><input type="text" id="c${n}district" placeholder="District…"></div>
    </div>
    <div class="field-hindi" id="c${n}nameHi" style="margin-top:6px">नाम • कार्यालय • पता</div>`;
    grid.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// ── Utility: form helpers ─────────────────────────────────────────────────────
window.clearForm = function () {
    ['letterNo', 'subjectEn', 'sentByName', 'sentByDsgn', 'sentByDept',
        'sentToName', 'sentToAddr', 'remarksEn'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['subjectHi', 'sentByNameHi', 'sentByDsgnHi', 'sentByDeptHi', 'sentToNameHi', 'sentToAddrHi', 'sentToZoneHi', 'remarksHi']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    document.querySelectorAll('#modeRow .mode-opt').forEach((el, i) => { el.classList.toggle('selected', i === 0); });
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
                if (!r.despatchDate) return false;
                const d = parseIndianDate(r.despatchDate);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === parseInt(y) && (d.getMonth() + 1) === parseInt(m);
            });
        }
    } else if (range === '6months') {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).getTime();
        filteredRows = allRows.filter(r => {
            if (!r.despatchDate) return false;
            return parseIndianDate(r.despatchDate).getTime() >= sixMonthsAgo;
        });
    } else if (range === 'year') {
        const currentYear = now.getFullYear();
        filteredRows = allRows.filter(r => {
            if (!r.despatchDate) return false;
            return parseIndianDate(r.despatchDate).getFullYear() === currentYear;
        });
    } else if (range === 'custom') {
        const from = document.getElementById('tabularExportFrom')?.value;
        const to = document.getElementById('tabularExportTo')?.value;
        const fromTime = from ? new Date(from).getTime() : 0;
        const toTime = to ? new Date(to).getTime() + 86400000 : Infinity;
        filteredRows = allRows.filter(r => {
            if (!r.despatchDate) return false;
            const t = parseIndianDate(r.despatchDate).getTime();
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
        ['No.<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:8px;font-weight:normal;color:#333">क्र.सं.</span>', 'serialNo', '2%', 'center'],
        ['Date of Despatch<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:8px;font-weight:normal;color:#333">प्रेषण की तिथि</span>', 'despatchDate', '10%', 'center'],
        ['Letter No. & Date<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:8px;font-weight:normal;color:#333">पत्र संख्या एवं तिथि</span>', 'letterNoDate', '12%', 'left'],
        ['Mode<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:8px;font-weight:normal;color:#333">माध्यम</span>', 'deliveryMethod', '6%', 'left'],
        ['Sent To (name|address|zone)<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:8px;font-weight:normal;color:#333">प्रेषित (नाम|पता|क्षेत्र)</span>', 'sentToDetails', '16%', 'left'],
        ['Sent By (name|desg)<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:8px;font-weight:normal;color:#333">प्रेषक (नाम|पद)</span>', 'sentBy', '10%', 'left'],
        ['Subject<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:8px;font-weight:normal;color:#333">विषय</span>', 'subjectDetails', '24%', 'left'],
        ['Priority<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:8px;font-weight:normal;color:#333">प्राथमिकता</span>', 'priority', '5%', 'center'],
        ['Language<br><span style="font-family:\'Noto Sans Devanagari\',sans-serif;font-size:8px;font-weight:normal;color:#333">भाषा</span>', 'letterLanguage', '8%', 'center']
    ];

    function esc(v) {
        return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── 2. Build thead ─────────────────────────────────────────────────────
    let thead = '<thead><tr>';
    cols.forEach(([label, , w]) => {
        thead += `<th style="width:${w}">${label}</th>`; // Removed esc() so HTML renders correctly
    });
    thead += '</tr></thead>';

    // ── 3. Build tbody ─────────────────────────────────────────────────────
    let tbody = '<tbody>';
    exportData.forEach((row, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#f5f5f5';
        tbody += `<tr style="background:${bg}">`;

        // Prepare combined fields
        const letterNoDate = [row.letterNo, row.letterDate].filter(Boolean).join(' - ');

        // Sent To block
        const sentToParts = [
            row.sentToName ? `<b>${esc(row.sentToName)}</b>` : '',
            row.sentToAddress ? esc(row.sentToAddress.split('#META#')[0]) : '',
            row.sentToZone ? `Zone: ${esc(row.sentToZone)}` : ''
        ].filter(Boolean);
        let sentToDetails = sentToParts.join('<br>');

        // Hindi companion for Sent To
        const sentToHiParts = [
            row.sentToNameHi ? `<b>${esc(row.sentToNameHi)}</b>` : '',
            row.sentToAddressHi ? esc(row.sentToAddressHi) : ''
        ].filter(Boolean);
        if (sentToHiParts.length > 0) {
            sentToDetails += `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:8.5px;color:#222;margin-top:3px;padding-top:2px;border-top:1px solid #e0e0e0">${sentToHiParts.join('<br>')}</div>`;
        }

        // Subject details
        let subjectDetails = esc(row.subject || '');
        if (row.subjectHindi) {
            subjectDetails += `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:8.5px;color:#222;margin-top:3px;padding-top:2px;border-top:1px solid #e0e0e0">${esc(row.subjectHindi)}</div>`;
        }

        cols.forEach(([, key, , align]) => {
            let val = '';
            if (key === 'letterNoDate') val = esc(letterNoDate);
            else if (key === 'sentToDetails') val = sentToDetails; // Already escaped HTML
            else if (key === 'subjectDetails') val = subjectDetails;
            else if (key === 'letterLanguage') {
                const l = row[key] || '';
                val = esc(l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : l === 'bi' ? 'Bilingual' : l);
            }
            else val = esc(row[key] || '');

            // Add Hindi companions for other fields if applicable
            let extra = '';
            if (key === 'sentBy' && row.sentByHi) {
                extra = `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:8.5px;color:#222;margin-top:3px;padding-top:2px;border-top:1px solid #e0e0e0">${esc(row.sentByHi)}</div>`;
            }

            tbody += `<td style="text-align:${align};vertical-align:top">${val}${extra}</td>`;
        });
        tbody += '</tr>';
    });
    tbody += '</tbody>';

    // ── 4. Assemble HTML string ────────────────────────────────────────────
    const headerHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid #000; padding-bottom: 10px;">
        <img src="/images/NIC Logo JPG/BILINGUAL _SQUARE_NIC_Logo_white_bg-01.jpg" alt="NIC Logo" style="height:55px;" />
        <div style="text-align:center; flex:1;">
            <h2 style="margin:0 0 3px 0; font-family:'Times New Roman', Times, serif; font-size:14px; font-weight:bold;">Government of India / भारत सरकार</h2>
            <h3 style="margin:0 0 3px 0; font-family:'Times New Roman', Times, serif; font-size:12px; font-weight:bold;">Ministry Of Electronics And Information Technology / इलेक्ट्रॉनिक्स और सूचना प्रौद्योगिकी मंत्रालय</h3>
            <h2 style="margin:0 0 3px 0; font-family:'Times New Roman', Times, serif; font-size:20px; font-weight:bold;">National Informatics Centre / राष्ट्रीय सूचना विज्ञान केंद्र</h2>
            <h3 style="margin:0; font-family:'Times New Roman', Times, serif; font-size:15px; font-weight:bold;">Meghalaya State Centre, Shillong - 793003 / मेघालय राज्य केंद्र, शिलांग - 793003</h3>
        </div>
        <img src="/images/digital-india.png" alt="Govt Logo" style="height:55px;" />
      </div>
    `;

    const p_langs = {}, p_zones = {}, p_methods = {}, p_priorities = {};
    exportData.forEach(r => {
        let l = r.letterLanguage; l = l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : l === 'bi' ? 'Bilingual' : (l || 'Unknown'); p_langs[l] = (p_langs[l] || 0) + 1;
        if (r.sentToZone) p_zones[r.sentToZone] = (p_zones[r.sentToZone] || 0) + 1;
        (r.deliveryMethod || '').split(', ').forEach(m => { if (m) p_methods[m] = (p_methods[m] || 0) + 1; });
        if (r.priority) p_priorities[r.priority] = (p_priorities[r.priority] || 0) + 1;
    });
    const t_langs = Object.values(p_langs).reduce((a, b) => a + b, 0);
    const t_zones = Object.values(p_zones).reduce((a, b) => a + b, 0);
    const t_methods = Object.values(p_methods).reduce((a, b) => a + b, 0);
    const t_priorities = Object.values(p_priorities).reduce((a, b) => a + b, 0);

    const htmlContent = `
        <div style="font-family: 'Times New Roman', Times, serif; padding: 5mm; background: white; width: 267mm; color: #000;">
            <style>
                .pdf-print-area table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #000; }
                .pdf-print-area th { 
                    background-color: #f0f0f0 !important; color: #000 !important; 
                    padding: 2px 3px; font-size: 8px; border: 1px solid #000; 
                    text-align: center; word-wrap: break-word; font-weight: bold;
                    line-height: 1.15;
                }
                .pdf-print-area td { 
                    border: 1px solid #000; padding: 4px; font-size: 9px; color: #000 !important; 
                    line-height: 1.3; word-wrap: break-word; vertical-align: top; 
                    white-space: normal; overflow-wrap: break-word; 
                }
                .pdf-print-area th:first-child { padding-left: 2px; padding-right: 2px; }
                .pdf-print-area td:first-child { text-align: center; font-weight: bold; padding-left: 2px; padding-right: 2px; }
                .pdf-print-area tr:nth-child(even) td { background-color: #fafafa !important; }
            </style>
            ${headerHtml}
            <h2 style="text-align: center; font-family: 'Times New Roman', Times, serif; font-size: 12px; font-weight: bold; margin: 0 0 5px; text-decoration: underline;">DAK Despatch Register</h2>
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
                    <strong style="color:#1a2e44;">Zones Sent To</strong><br>
                    ${Object.entries(p_zones).map(([k, v]) => `${k}: ${v}`).join('<br>')}<hr style="margin:4px 0; border:none; border-top:1px solid #ddd;"><strong>Total: ${t_zones}</strong>
                </div>
                <div style="flex:1;">
                    <strong style="color:#1a2e44;">Delivery Methods</strong><br>
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
        filename: `DAK_Despatch_${new Date().toISOString().split('T')[0]}.pdf`,
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
    const t = document.createElement('div');
    t.className = 'toast toast-' + type; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// CSS animations
const s = document.createElement('style');
s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}`;
document.head.appendChild(s);
