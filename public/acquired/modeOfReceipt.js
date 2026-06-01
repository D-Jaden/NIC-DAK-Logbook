// ─────────────────────────────────────────────
//  acquired/modeOfReceipt.js
//  Same multi-select pill pattern as despatch.
//  Options: Hand · Email · eFile · Speed Post · Registered Post
// ─────────────────────────────────────────────

export function initModeOfReceipt() {
  const row = document.getElementById('modeRow');
  if (!row) return;

  row.addEventListener('click', e => {
    const opt = e.target.closest('.mode-opt');
    if (!opt || opt.classList.contains('disabled-mode')) return;
    toggleMode(opt, row);
  });
}

function toggleMode(opt, row) {
  const selected = row.querySelectorAll('.mode-opt.selected');
  if (opt.classList.contains('selected')) {
    opt.classList.remove('selected');
  } else {
    if (selected.length >= 3) { shakeRow(row); return; }
    opt.classList.add('selected');
  }
  const nowSelected = row.querySelectorAll('.mode-opt.selected');
  row.querySelectorAll('.mode-opt:not(.selected)').forEach(el => {
    el.classList.toggle('disabled-mode', nowSelected.length >= 3);
  });
  updateModeCount(row);
}

function updateModeCount(row) {
  const el = document.getElementById('modeCount');
  if (!el) return;
  const n = row.querySelectorAll('.mode-opt.selected').length;
  el.textContent = n === 0 ? 'Select up to 3 modes'
    : `${n} of 3 mode${n > 1 ? 's' : ''} selected`;
}

function shakeRow(row) {
  row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 400);
}