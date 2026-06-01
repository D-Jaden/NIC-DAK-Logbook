// ─────────────────────────────────────────────
//  shared/zone.js
//  State → Zone mapping, Hindi zone labels,
//  and helpers used by both despatch & acquired
// ─────────────────────────────────────────────

/** Maps a zone code to { en, hi, color } */
export const ZONE_META = {
  North:     { en: 'North',     hi: 'उत्तर',    color: '#1565C0' },
  South:     { en: 'South',     hi: 'दक्षिण',   color: '#2E7D32' },
  East:      { en: 'East',      hi: 'पूर्व',    color: '#6A1B9A' },
  West:      { en: 'West',      hi: 'पश्चिम',   color: '#E65100' },
  Central:   { en: 'Central',   hi: 'मध्य',     color: '#00796B' },
  Northeast: { en: 'Northeast', hi: 'पूर्वोत्तर', color: '#AD1457' },
};

/**
 * Each entry: "StateName|Zone"
 * The HTML <option value="StateName|Zone"> pattern is used throughout.
 */
export const STATE_DATA = [
  // North
  { state: 'Delhi',              zone: 'North' },
  { state: 'Haryana',            zone: 'North' },
  { state: 'Himachal Pradesh',   zone: 'North' },
  { state: 'Jammu & Kashmir',    zone: 'North' },
  { state: 'Punjab',             zone: 'North' },
  { state: 'Rajasthan',          zone: 'North' },
  { state: 'Uttarakhand',        zone: 'North' },
  { state: 'Uttar Pradesh',      zone: 'North' },
  // South
  { state: 'Andhra Pradesh',     zone: 'South' },
  { state: 'Karnataka',          zone: 'South' },
  { state: 'Kerala',             zone: 'South' },
  { state: 'Tamil Nadu',         zone: 'South' },
  { state: 'Telangana',          zone: 'South' },
  { state: 'Puducherry',         zone: 'South' },
  // East
  { state: 'Bihar',              zone: 'East' },
  { state: 'Jharkhand',          zone: 'East' },
  { state: 'Odisha',             zone: 'East' },
  { state: 'West Bengal',        zone: 'East' },
  // West
  { state: 'Goa',                zone: 'West' },
  { state: 'Gujarat',            zone: 'West' },
  { state: 'Maharashtra',        zone: 'West' },
  // Central
  { state: 'Chhattisgarh',       zone: 'Central' },
  { state: 'Madhya Pradesh',     zone: 'Central' },
  // Northeast
  { state: 'Arunachal Pradesh',  zone: 'Northeast' },
  { state: 'Assam',              zone: 'Northeast' },
  { state: 'Manipur',            zone: 'Northeast' },
  { state: 'Meghalaya',          zone: 'Northeast' },
  { state: 'Mizoram',            zone: 'Northeast' },
  { state: 'Nagaland',           zone: 'Northeast' },
  { state: 'Sikkim',             zone: 'Northeast' },
  { state: 'Tripura',            zone: 'Northeast' },
];

/**
 * Returns an <option> list string for state selects.
 * value format: "StateName|Zone"
 */
export function stateOptionsHTML() {
  return STATE_DATA
    .map(d => `<option value="${d.state}|${d.zone}">${d.state}</option>`)
    .join('\n');
}

/**
 * Given "StateName|Zone" string, returns zone meta object or null.
 * @param {string} stateVal - value from a state <select>
 */
export function getZoneFromStateVal(stateVal) {
  if (!stateVal) return null;
  const zone = stateVal.split('|')[1];
  return ZONE_META[zone] || null;
}

/**
 * Renders a zone badge element and injects it into a container.
 * @param {HTMLElement} container
 * @param {{ en, hi, color }} zoneMeta
 */
export function renderZoneBadge(container, zoneMeta) {
  if (!container) return;
  if (!zoneMeta) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <span class="zone-badge" style="--zc:${zoneMeta.color}">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" stroke="var(--zc)" stroke-width="1.5"/>
        <circle cx="5" cy="5" r="2" fill="var(--zc)"/>
      </svg>
      <span class="zone-en">${zoneMeta.en}</span>
      <span class="zone-hi">${zoneMeta.hi}</span>
    </span>`;
}