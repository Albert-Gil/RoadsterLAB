import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AIR_R, insideTable, propsAtTR, rhoFromPT, tempFromRU, propsFromPs, soundSpeed
} from '../src/air-table.js';

test('envelope helpers reject out-of-range states', () => {
  assert.equal(insideTable(293, 1.2), true);
  assert.equal(insideTable(50, 1.2), false);
  assert.equal(insideTable(293, 2000), false);
  assert.equal(propsAtTR(50, 1.2).ok, false);
});

test('ambient air density is near 1.2 kg/m3', () => {
  const { rho, ok } = rhoFromPT(101325, 293);
  assert.equal(ok, true);
  assert.ok(Math.abs(rho - 1.2) / 1.2 < 0.05);
});

test('400 bara class fill is less dense than ideal gas predicts (Z>1)', () => {
  const p = 401.01325e5, T = 293;
  const { rho, ok } = rhoFromPT(p, T);
  assert.equal(ok, true);
  const ideal = p / (AIR_R * T);
  assert.ok(rho < ideal * 0.95, `expected rho ${rho} << ideal ${ideal}`);
  const z = p / (rho * AIR_R * T);
  assert.ok(z > 1.05 && z < 1.6);
});

test('propsAtTR recovers pressure near the fill state', () => {
  const p = 401.01325e5, T = 293;
  const { rho, ok } = rhoFromPT(p, T);
  const props = propsAtTR(T, rho);
  assert.equal(ok && props.ok, true);
  assert.ok(Math.abs(props.p - p) / p < 0.02);
  assert.ok(Number.isFinite(props.u) && Number.isFinite(props.h) && Number.isFinite(props.s));
});

test('tempFromRU round-trips u at fixed density', () => {
  const { rho } = rhoFromPT(50e5, 300);
  const { u } = propsAtTR(300, rho);
  const back = tempFromRU(rho, u);
  assert.equal(back.ok, true);
  assert.ok(Math.abs(back.T - 300) < 0.5);
});

test('isentropic propsFromPs keeps entropy', () => {
  // Mild expansion so the isentrope stays inside the table (deep blowdown can go <90 K).
  const stag = propsAtTR(293, rhoFromPT(50e5, 293).rho);
  const exit = propsFromPs(20e5, stag.s);
  assert.equal(exit.ok, true);
  const check = propsAtTR(exit.T, exit.rho);
  assert.ok(Math.abs(check.s - stag.s) / Math.abs(stag.s) < 0.01);
});

test('sound speed is positive and finite in the gas region', () => {
  const { a, ok } = soundSpeed(293, 1.2);
  assert.equal(ok, true);
  assert.ok(a > 300 && a < 450);
});
