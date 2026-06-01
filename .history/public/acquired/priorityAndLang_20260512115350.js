// ─────────────────────────────────────────────
//  acquired/priorityAndLang.js
//  Priority: Immediate | Priority
//  Language: English | Hindi | Bilingual | Other
// ─────────────────────────────────────────────

export function initPriorityAndLang() {
  document.querySelectorAll('.priority-opt').forEach(opt => {
    opt.addEventListener('click', () => selectPriority(opt));
  });
  document.querySelectorAll('.lang-opt').forEach(opt => {
    opt.addEventListener('click', () => selectLang(opt));
  });
}

export function selectPriority(el) {
  document.querySelectorAll('.priority-opt').forEach(o =>
    o.classList.remove('selected', 'sel-immediate', 'sel-priority'));
  el.classList.add('selected');
  el.classList.add(el.dataset.type === 'immediate' ? 'sel-immediate' : 'sel-priority');
  const h = document.getElementById('priorityValue');
  if (h) h.value = el.dataset.type;
}

export function selectLang(el) {
  document.querySelectorAll('.lang-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const h = document.getElementById('langValue');
  if (h) h.value = el.dataset.lang;
}