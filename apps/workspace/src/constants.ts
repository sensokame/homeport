// Hardcodes the hub's own URL + hash-routing convention. Unavoidable for a
// standalone (non-hub-embedded) page — see feedback_satellite_hub_coupling
// in the memory system. Kept in one named place per that memory's accepted
// mitigation, rather than an inline string literal at each use site.
export const WORKSPACE_HASH_URL = 'http://panel.station/#/workspace/'
