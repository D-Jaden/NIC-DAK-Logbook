// ─────────────────────────────────────────────
//  despatch/main.js  — ENTRY POINT
//  Imports all despatch modules and wires up
//  DOMContentLoaded init.
// ─────────────────────────────────────────────

import { showPage, restorePage } from '../shared/nav.js';
import { triggerTranslate }      from '../shared/translations.js';
import { stateOptionsHTML }      from '../shared/zone.js';
import { initModeOfDespatch }    from './modeOfDespatch.js';
import { initPriority }          from './priority.js';
import { initLanguage }          from './language.js';
import { initCopyRecipients }    from './copyRecipients.js';

/** Tab index map for Despatch */
const TAB_MAP = { entry: 0, dashboard: 1, search: 2, reports: 3 };

document.addEventListener('DOMContentLoaded', () => {
  // Expose showPage globally for onclick= attributes in HTML
  window.showPage = name => showPage(name, TAB_MAP);

  // Expose triggerTranslate globally for oninput= attributes
  window.triggerTranslate = triggerTranslate;

  // Initialise sub-modules
  initModeOfDespatch();
  initPriority();
  initLanguage();
  initCopyRecipients(stateOptionsHTML);

  // Auto-populate serial number
  const serialEl = document.getElementById('headerSerial');
  if (serialEl) {
    const now = new Date();
    const yy  = String(now.getFullYear()).slice(-2);
    const mm  = String(now.getMonth() + 1).padStart(2, '0');
    const dd  = String(now.getDate()).padStart(2, '0');
    const rnd = String(Math.floor(Math.random() * 9000) + 1000);
    serialEl.textContent = `DD-${yy}${mm}${dd}-${rnd}`;
  }

  // Restore last tab
  restorePage(TAB_MAP);

  // Form submit
  const form = document.getElementById('despatchForm');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      await submitDespatch(form);
    });
  }
});

async function submitDespatch(form) {
  const btn = document.getElementById('submitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const payload = Object.fromEntries(new FormData(form));
    // Collect copy recipients from dynamic rows
    payload.copies = collectCopies();
    // Collect modes
    payload.modes = [...document.querySelectorAll('.mode-opt.selected')]
      .map(el => el.dataset.mode);

    const res = await fetch('/api/despatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Entry saved — ' + data.serial, 'success');
      form.reset();
    } else {
      showToast(data.message || 'Error saving entry', 'error');
    }
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save & Submit'; }
  }
}

function collectCopies() {
  const copies = [];
  document.querySelectorAll('.copy-entry').forEach(entry => {
    const n = entry.dataset.n;
    copies.push({
      name:       document.getElementById(`c${n}name`)?.value,
      designation:document.getElementById(`c${n}desig`)?.value,
      department: document.getElementById(`c${n}dept`)?.value,
      address:    document.getElementById(`c${n}addr`)?.value,
      pincode:    document.getElementById(`c${n}pin`)?.value,
      district:   document.getElementById(`c${n}district`)?.value,
      city:       document.getElementById(`c${n}city`)?.value,
      state:      document.getElementById(`c${n}state`)?.value?.split('|')[0],
      zone:       document.getElementById(`c${n}state`)?.value?.split('|')[1],
    });
  });
  return copies;
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}