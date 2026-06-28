/**
 * Re-export shim — the fuzzy name-matcher now lives in the shared package
 * `cricket-identity` (github:nishantsingodia/cricket-identity), the single
 * source of truth shared with wwc-draft.
 *
 * This used to be a hand-mirrored copy ("copy verbatim when you change one"),
 * which let the two drift. Do NOT paste the algorithm back here — edit it in the
 * cricket-identity repo, bump its version, and `npm update cricket-identity`.
 *
 * Kept as a thin shim so existing `@/lib/fuzzy-name-match` imports
 * (squads/build-womens-pool.ts, squads/build-mlc-pool.ts) keep working untouched.
 * NOTE: this is unrelated to the deliberately-different normName in
 * src/lib/registry/index.ts — do not consolidate that one.
 */
export { normName, fuzzyMatchName } from "cricket-identity";
