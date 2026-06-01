// ─────────────────────────────────────────────
//  despatch/priority.js
//  Priority selector: Immediate | Priority
//  (renamed from "Urgent" to match despatch norms)
// ─────────────────────────────────────────────

export function initPriority() {
  document.querySelectorAll('.priority-opt').forEach(opt => {
    opt.addEventListener('click', () => selectPriority(opt));
  });
}

export function selectPriority(el) {
  document.querySelectorAll('.priority-opt').forEach(o => {
    o.classList.remove('selected', 'sel-immediate', 'sel-priority');
  });
  el.classList.add('selected');
  el.classList.add(el.dataset.type === 'immediate' ? 'sel-immediate' : 'sel-priority');

  // Update hidden input
  const hidden = document.getElementById('priorityValue');
  if (hidden) hidden.value = el.dataset.type;
}

export function getPriority() {
  return document.getElementById('priorityValue')?.value || '';
}