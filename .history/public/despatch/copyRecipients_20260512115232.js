// ─────────────────────────────────────────────
//  despatch/copyRecipients.js
//  Dynamic "Copy Sent To" section.
//  Each copy entry has: Name, Designation, Dept,
//  Address, Pincode, District, City, State, Zone.
//  Zone is auto-filled when state is selected.
// ─────────────────────────────────────────────

import { getZoneFromStateVal, renderZoneBadge } from '../shared/zone.js';

let _copyCount = 2;  // 2 default rows pre-rendered in HTML

export function initCopyRecipients(stateOptionsHTMLFn) {
  // Populate state selects already in DOM
  document.querySelectorAll('.copy-state-select').forEach(sel => {
    sel.innerHTML = '<option value="">— Select State —</option>'
      + stateOptionsHTMLFn();
  });

  // Wire up existing rows
  document.querySelectorAll('.copy-entry').forEach(entry => {
    wireRow(entry.dataset.n, stateOptionsHTMLFn);
  });

  // Add row button
  const addBtn = document.getElementById('addCopyBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => addCopyEntry(stateOptionsHTMLFn));
  }
}

function wireRow(n, stateOptionsHTMLFn) {
  const stateEl = document.getElementById(`c${n}state`);
  if (stateEl) {
    stateEl.innerHTML = '<option value="">— Select State —</option>'
      + stateOptionsHTMLFn();
    stateEl.addEventListener('change', () => onCopyStateChange(n));
  }

  const pinEl = document.getElementById(`c${n}pin`);
  if (pinEl) pinEl.addEventListener('input', () => onCopyPin(pinEl, n));

  const addrEl = document.getElementById(`c${n}addr`);
  if (addrEl) addrEl.addEventListener('input', () => onCopyAddrChange(n));

  const removeBtn = document.getElementById(`removeBtn${n}`);
  if (removeBtn) removeBtn.addEventListener('click', () => removeCopyEntry(n));
}

function onCopyStateChange(n) {
  const sel  = document.getElementById(`c${n}state`);
  const zone = getZoneFromStateVal(sel?.value);
  renderZoneBadge(document.getElementById(`c${n}zone`), zone);
  const zoneLabel = document.getElementById(`c${n}zoneLabel`);
  if (zoneLabel) zoneLabel.style.display = zone ? 'flex' : 'none';
}

function onCopyPin(el, n) {
  el.value = el.value.replace(/\D/g, '').slice(0, 6);
}

function onCopyAddrChange(n) {
  // Hook for future geocoding or address validation
}

export function addCopyEntry(stateOptionsHTMLFn) {
  _copyCount++;
  const n    = _copyCount;
  const grid = document.getElementById('copyGrid');
  if (!grid) return;

  const div = document.createElement('div');
  div.className  = 'copy-entry';
  div.dataset.n  = n;
  div.innerHTML  = copyEntryHTML(n);
  grid.appendChild(div);

  wireRow(n, stateOptionsHTMLFn);
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function removeCopyEntry(n) {
  const entry = document.querySelector(`.copy-entry[data-n="${n}"]`);
  if (entry) entry.remove();
}

function copyEntryHTML(n) {
  return `
  
  <div class="copy-entry-header">
    <span class="copy-entry-label">Copy #${n}</span>
    <button type="button" class="copy-remove-btn" id="removeBtn${n}" title="Remove">✕</button>
  </div>

  <div class="field-row">
    <div class="field">
      <label class="field-label">Name <span class="field-label-hi">नाम</span></label>
      <input type="text" id="c${n}name" placeholder="Recipient name" autocomplete="off">
    </div>
    <div class="field">
      <label class="field-label">Designation <span class="field-label-hi">पद</span></label>
      <input type="text" id="c${n}desig" placeholder="e.g. Director">
    </div>
    <div class="field">
      <label class="field-label">Department <span class="field-label-hi">विभाग</span></label>
      <input type="text" id="c${n}dept" placeholder="e.g. MoHFW">
    </div>
  </div>
  <div class="field-row">
    <div class="field field-span2">
      <label class="field-label">Address <span class="field-label-hi">पता</span></label>
      <textarea id="c${n}addr" rows="2" placeholder="Street / building..."></textarea>
    </div>
    <div class="field">
      <label class="field-label">Pincode <span class="field-label-hi">पिन</span></label>
      <input type="text" id="c${n}pin" inputmode="numeric" maxlength="6" placeholder="110001">
    </div>
  </div>
  <div class="field-row">
    <div class="field">
      <label class="field-label">City <span class="field-label-hi">शहर</span></label>
      <input type="text" id="c${n}city" placeholder="City">
    </div>
    <div class="field">
      <label class="field-label">District <span class="field-label-hi">जिला</span></label>
      <input type="text" id="c${n}district" placeholder="District">
    </div>
    <div class="field">
      <label class="field-label">State <span class="field-label-hi">राज्य</span></label>
      <select id="c${n}state" class="copy-state-select"></select>
    </div>
  </div>
  <div class="zone-display-row" id="c${n}zoneLabel" style="display:none">
    <span class="zone-auto-label">Auto Zone:</span>
    <div id="c${n}zone"></div>
  </div>`;
}