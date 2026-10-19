/** Stub air table — replaced by scripts/bake-air-table.mjs. SI units. */
export const AIR_R = 287.05;
export const AIR_T_MIN = 90, AIR_T_MAX = 2000, AIR_RHO_MIN = 0.01, AIR_RHO_MAX = 1200;
export function insideTable(T, rho) {
  return T >= AIR_T_MIN && T <= AIR_T_MAX && rho >= AIR_RHO_MIN && rho <= AIR_RHO_MAX;
}
export function propsAtTR(T, rho) {
  return { p: NaN, u: NaN, h: NaN, s: NaN, cp: NaN, ok: false };
}
export function rhoFromPT(p, T) {
  return { rho: NaN, ok: false };
}
export function tempFromRU(rho, u) {
  return { T: NaN, ok: false };
}
export function propsFromPs(p, s) {
  return { T: NaN, rho: NaN, u: NaN, h: NaN, cp: NaN, ok: false };
}
export function soundSpeed(T, rho) {
  return { a: NaN, ok: false };
}
