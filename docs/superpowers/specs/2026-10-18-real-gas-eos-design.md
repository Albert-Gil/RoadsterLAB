# Real-gas dry-air equation of state for IMPULSE

**Status:** Implemented (inline; M3 held)  
**Date:** 2026-10-18  
**Scope:** Replace ideal-gas tank and nozzle thermodynamics with a tabulated dry-air property model before M3 Launch comparison work.

## 1. Problem

The current solver uses constant-property ideal air:

- Fill: \(m = pV/(R T)\)
- Blowdown cooling: \(dT/dt = -(\gamma-1)T\,\dot m/m\)
- Nozzle: ideal choked/unchoked formulas with \(\gamma = 1.4\)

At the previous 650 barg default this overstated stored mass by roughly 30–50%. Even at lower pressure the ideal nozzle and adiabatic cooling are inconsistent with real air. The project already discloses the limitation; this change removes the ideal-gas path from the live model.

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| Model form | Compact **tabulated** dry-air properties (not cubic EOS alone) |
| Coverage | Tank **and** nozzle (full real-gas path) |
| Default fill | **400 barg** at 293 K; mass from table density |
| Slider range | Keep exploring up to **650 barg**; validity is table-limited |
| Dependencies | Still zero npm packages; table ships as source |
| Vessel mass | Still excluded; only stored gas adds to vehicle mass |
| Discharge coefficient | Keep illustrative **0.9** |

## 3. Property table

### 3.1 Source

Offline bake from a NIST-style standard dry-air formulation (Lemmon et al. / REFPROP-class air EOS). The runtime never calls NIST or the network. Cite the source in README.

### 3.2 Independent variables and fields

- Grid in **\(T\)** and **\(\rho\)** (density), which remains well-posed during blowdown.
- Each node stores at least: **\(p\), \(u\), \(h\), \(s\), \(c_p\)**.
- Optional convenience: \(Z = p/(\rho R T)\) can be derived, not stored.

### 3.3 Envelope (broad)

- Temperature: **\(90\,\mathrm{K} \le T \le 2000\,\mathrm{K}\)**
- Density: **\(0.01\,\mathrm{kg/m^3} \le \rho \le 1200\,\mathrm{kg/m^3}\)**

This covers cryogenic air through supercritical storage well above 650 barg. Exact node counts are an implementation detail; target a few tens of kilobytes of compressed JS, not megabytes.

### 3.4 Interpolation and out-of-range

- Bilinear interpolation in \(T\) and \(\log\rho\) (or \(\rho\) if the grid is dense enough that linear \(\rho\) error stays within a few percent).
- Queries outside the envelope, or failed inversions, set an explicit **OUT OF TABLE** (or equivalent) status. **No silent extrapolation.**

### 3.5 Required helpers

Pure functions in SI units, e.g.:

- `propsAtTR(T, rho)` → `{ p, u, h, s, cp }`
- `rhoFromPT(p, T)` → density (fill and inversions)
- `propsFromPs(p, s)` / throat solve helpers for isentropic nozzle
- `insideTable(T, rho)` → boolean

## 4. Tank model

### 4.1 Fill

Given absolute pressure \(p_0\), \(T_0 = 293\,\mathrm{K}\), volume \(V\):

1. \(\rho_0 = \mathrm{rhoFromPT}(p_0, T_0)\)
2. \(m_0 = \rho_0 V\)
3. Store internal energy \(u_0\) from the table (state may be tracked as \((m, u)\) or \((m, T)\) with consistent updates).

**Default:** 400 barg → \(p_0 = 400 + p_\mathrm{atm}\) (bar absolute), \(V = 600\,\mathrm{L}\). Expected fill mass is substantially below the ideal-gas value at the same \(p,V,T\) (order ~230–250 kg, exact value from the baked table).

### 4.2 Open-system adiabatic blowdown

For discharge with no wall heat:

- Mass: \(\dot m = -\dot m_\mathrm{nozzle}\)
- Energy: update specific internal energy of the remaining gas from the open-system adiabatic relation using table enthalpies (implementation plan will specify the discrete RK4 form). Prefer integrating **\(u\)** so \(T\) is recovered by inversion of \(u(\rho,T)\) if needed.

Telemetry pressure is always \(p(T,\rho)\) from the table, never \(m R T / V\).

### 4.3 UI validity

Replace `IDEAL_GAS_MIN_TEMP` / “outside ideal-gas range” with table-validity messaging when:

- State leaves the envelope, or
- Property inversion / nozzle isentropic solve fails.

## 5. Nozzle model (real-gas isentropic)

Stagnation state = current tank state \((T_0, \rho_0)\) with \(h_0\), \(s_0\).

1. Attempt isentropic expansion to ambient \(p_a = ATM\) at \(s = s_0\).
2. If the exit Mach would exceed 1 (sonic condition from table sound speed / isentropic relations), treat as **choked**: solve throat state at \(s = s_0\) and sonic condition; exit pressure may exceed ambient.
3. Exit velocity \(v_e = \sqrt{2(h_0 - h_e)}\) (clamp to ≥ 0).
4. Mass flow \(\dot m = C_d A \rho_e v_e\) with \(C_d = 0.9\).
5. Thrust \(F = \dot m\, v_e + (p_e - p_a) A\).

Ideal \(\gamma = 1.4\) nozzle formulas are removed from the live Launch/Hop path.

## 6. Integration points

| Area | Change |
|---|---|
| `impulse/src/physics.ts` | New gas helpers; rewrite `initialGas`, `pressureOf`, `nozzleFlow`, Launch/Hop derivatives and sample pressure fields |
| New module | e.g. `impulse/src/air-table.js` (or `.ts`) generated/committed table + interpolators |
| Offline bake script | Optional `impulse/scripts/bake-air-table.mjs` documenting how the table was built; runtime does not need the bake tool |
| `impulse/tests/physics.test.ts` | Replace ideal-gas analytic identities; add table checkpoints, fill-mass check, energy consistency, nozzle limits, timestep convergence at 400 barg |
| `impulse/src/app.js` | Defaults 400 barg; validity flag copy; advanced-assumptions footnote |
| Docs | `README.md`, `AGENTS.md`, `MILESTONES.md` — real-air table, envelope, 400 barg default, remaining limits |

Physics remains independent of rendering and playback speed. Share-link gauge/absolute rules stay as today.

## 7. Acceptance criteria

1. Build and syntax checks pass; physics tests updated and green.
2. At 400 barg, 293 K, 600 L, fill mass matches table density within interpolation tolerance and is far below ideal \(pV/RT\).
3. Table recovers published \(Z\) or density at several checkpoints across the envelope (document expected tolerances).
4. Launch and Hop runs remain finite; thrust → 0 as tank pressure approaches ambient.
5. Scrubbing/share/repeat-launch still preserve gas mass and internal energy/temperature consistently.
6. UI and docs no longer claim an ideal-gas baseline for the live solver; envelope limits are explicit.
7. No M3 three-car UI work in this change set unless required to keep the app compiling.

## 8. Explicit non-goals

- Real-gas regulator or multi-stage feed
- Wall heat transfer / non-adiabatic tank
- Pressure-vessel structural mass
- Species other than dry air
- M3 Launch comparison UI (lanes/plots) — follows after this physics change
- Publishing / marketing claims of validated Tesla performance

## 9. Risks

| Risk | Mitigation |
|---|---|
| Table too coarse near critical / high \(Z\) | Dense nodes in high-\(p\), mid-\(T\) band; checkpoint tests |
| Nozzle iteration fails at edge states | Bounded solver; flag OUT OF TABLE / NOZZLE FAIL; zero thrust safely |
| File size / load time | Compress grid; avoid megabyte tables |
| Share links with old 650 barg defaults | Still valid inputs; results change — disclosed in README |

## 10. Review checklist (spec self-review)

- [x] No placeholder “TBD” for locked decisions
- [x] Scope is tank + nozzle; fill default 400 barg; table envelope stated
- [x] Ideal-gas live path removed; vessel mass still excluded
- [x] Tests and docs called out
- [x] M3 deferred
