// ─────────────────────────────────────────────
//  acquired/senderAddress.js
//  Sender address block with auto zone detection.
//  Fields: Name, Address, Pincode, District,
//          Block, City, State → Zone (auto)
// ─────────────────────────────────────────────

import { getZoneFromStateVal, renderZoneBadge } from '../shared/zone.js';

export function initSenderAddress(stateOptionsHTMLFn) {
  const sel = document.getElementById('addrState');
  if (sel) {
    sel.innerHTML = '<option value="">— Select State —</option>'
      + stateOptionsHTMLFn();
    sel.addEventListener('change', onStateChange);
  }

  const pinEl = document.getElementById('addrPincode');
  if (pinEl) pinEl.addEventListener('input', onPincodeInput);

  document.getElementById('addrCity')?.addEventListener('input', onAddressChange);
  document.getElementById('addrDistrict')?.addEventListener('input', onAddressChange);
}

function onStateChange() {
  const sel  = document.getElementById('addrState');
  const zone = getZoneFromStateVal(sel?.value);
  renderZoneBadge(document.getElementById('zoneDisplay'), zone);

  const wrap = document.getElementById('zoneWrap');
  if (wrap) wrap.style.display = zone ? 'flex' : 'none';
}

function onAddressChange() {
  // Can be wired to address completeness indicator if needed
}

function onPincodeInput(e) {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  // Future: debounced postal API lookup
}