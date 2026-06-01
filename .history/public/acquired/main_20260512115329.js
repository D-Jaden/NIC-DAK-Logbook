// ─────────────────────────────────────────────
//  acquired/main.js  — ENTRY POINT
//  Imports all acquired modules and wires up
//  DOMContentLoaded init.
// ─────────────────────────────────────────────

import { showPage, restorePage }    from '../shared/nav.js';
import { triggerTranslate }         from '../shared/translations.js';
import { stateOptionsHTML }         from '../shared/zone.js';
import { initSenderAddress }        from './senderAddress.js';
import { initModeOfReceipt }        from './modeOfReceipt.js';
import { initPriorityAndLang }      from './priorityAndLang.js';

const TAB_MAP = { entry: 0, dashboard: 1, search: 2, pending: 3 };

document.addEventListener('DOMContentLoaded', () => {
  window.showPage        = name => showPage(name, TAB_MAP);
  window.triggerTranslate = triggerTranslate;

  initSenderAddress(stateOptionsHTML);
  initModeOfReceipt();
  initPriorityAndLang();

  // Auto-serial
  const serialEl = document.getElementById('headerSerial');
  if (serialEl) {
    const now = new Date();
    const yy  = String(now.getFullYear()).slice(-2);
    const mm  = String(now.getMonth() + 1).padStart(2, '0');
    const dd  = String(now.getDate()).padStart(2, '0');
    const rnd = String(Math.floor(Math.random() * 9000) + 1000);
    serialEl.textContent = `DA-${yy}${mm}${dd}-${rnd}`;
  }

  restorePage(TAB_MAP);

  const form = document.getElementById('acquiredForm');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      await submitAcquired(form);
    });
  }
});

async function submitAcquired(form) {
  const btn = document.getElementById('submitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const payload = Object.fromEntries(new FormData(form));
    payload.modes = [...document.querySelectorAll('#modeRow .mode-opt.selected')]
      .map(el => el.dataset.mode);

    const res = await fetch('/api/acquired', {
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

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}