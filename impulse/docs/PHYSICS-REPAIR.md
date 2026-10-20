# Physics repairs: EOS, Invert and vessel heating

Implemented and numerically verified 2026-10-19 in the local checkout. This note
supersedes the corresponding open findings and numerical examples in
[PHYSICS-REVIEW.md](PHYSICS-REVIEW.md). No publication or hardware validation is
included. Other M3-M9 work in this checkout is preserved.

## What changed

| Area | Current behavior | Remaining limitation |
|---|---|---|
| Gas properties | One direct Peng-Robinson formulation supplies pressure, energy, entropy, heat capacities and sound speed. Unsupported states are rejected. | Pseudo-pure dry-air approximation, not a reference air-mixture EOS. |
| Nozzle | Isentropic expansion uses the same properties, with a supported sonic throat when choked and pressure thrust retained. Exit state and Mach are available. | Converging nozzle with assumed Cd=0.9; no divergent geometry or plumbing model. |
| Invert | The body inherits departure angular velocity. Secondary deck contact stops the trajectory with an explicit model limit. | Supported pitch is guided; no tipping, axle moment balance or secondary collision response. |
| Vessel heating | Signed heat exchange depends on internal gas temperature, including closed-valve periods. | Constant imposed source reservoir; no finite wall heat capacity. |

## Rigid-vessel thermodynamics

The gas is uniform in a rigid volume, with no inflow or boundary work. The tank
states are mass and specific internal energy:

\[
\frac{dm}{dt}=-\dot m_e,\qquad
\frac{d(mu)}{dt}=\dot Q-\dot m_e h_0,
\qquad
\frac{du}{dt}=\frac{\dot Q+\dot m_e(u-h_0)}{m}.
\]

The outflow removes **stagnation enthalpy**, not just the nozzle exit's static
enthalpy. Jet kinetic energy is therefore included in the tank's energy loss.
Temperature and pressure are recovered from the EOS at the current density m/V
and energy. Negative internal energy under the selected reference convention is
not itself an invalid state; property bounds and stability determine validity.

The requested internal-temperature-dependent heat input is

\[
\dot Q=UA(T_{source}-T_{gas}).
\]

Positive heat enters the gas; a hotter gas loses heat. In **Parameters → Vessel
heat exchange**, Thermal conductance is overall UA in W/K (0-2000, default 250)
and Heat source temperature is in K (250-350, default 293). UA is an assumed
overall conductance, not a convection coefficient in W/(m² K). Setting UA=0
recovers adiabatic discharge. At the default initial 293 K, heat starts at zero
and rises as blowdown cools the gas. Heat remains active while the valve is closed.

Heating is independent of the fan/motor electrical budget. Heat rate and its
signed cumulative integral are exported separately. Launch, Hop, stationary and
rotating Invert, and Turn all receive thermal histories. Sealed experiments keep
mass fixed while temperature and pressure evolve. Repeated Launch inventory and
shared links can retain supported temperatures above the original 293 K fill.

An imposed source is intentionally simpler than a gas/wall/ambient model. Its
temperature never responds to absorbed energy. Finite wall capacity, internal
convection correlations and exterior heat transfer would be a separate model
upgrade; the current UA is not fitted to hardware.

## Consistent EOS and validity

The historical `air-table.js` filename and public functions remain for build and
worker compatibility. The implementation is now a direct analytic PR model,
generated from `scripts/air-eos-template.js` by `scripts/bake-air-table.mjs`, rather
than independently interpolated p/u/h/s grids.

The property implementation enforces h=u+p/rho and uses analytic EOS derivatives:

\[
c_p-c_v=\frac{T(\partial p/\partial T)_\rho^2}
{\rho^2(\partial p/\partial\rho)_T},\qquad
a^2=(\partial p/\partial\rho)_T+
\frac{T(\partial p/\partial T)_\rho^2}{\rho^2c_v}.
\]

Positive pressure, heat capacities and isothermal pressure slope are required.
Safeguarded inversions recover rho(p,T), T(rho,u) and an isentropic state(p,s).
There is no silent ideal-gas substitution for failed sound-speed calculations.

The conservative single-phase computation envelope is **140-2000 K** and
**0.01-1176.6 kg/m³**. The lower bound excludes the previously accepted unstable
120 K / 200 kg/m³ state rather than claiming support for phase equilibrium.
These are computation limits, not an accuracy guarantee throughout that domain.
The retained `OUT OF TABLE` status now means unsupported gas/nozzle properties.
Some formerly accepted long/cold discharges therefore terminate earlier.

Ideal heat capacity uses the retained NASA-style polynomial coefficients. Below
their 200 K fit boundary, an explicitly disclosed constant-cp continuation is
integrated consistently for enthalpy and entropy. High/low enthalpy and entropy
references are joined continuously at 1000 K. This does not establish the
accuracy of cryogenic real-air properties or model condensation.

**Consistency is improved; reference-EOS accuracy is still unquantified.** The
appropriate next property task is comparison against the Lemmon et al. reference
air formulation, including p/rho, cp/cv, sound, isentropes and discharge histories
over the actual run envelope. A reference backend or consistently generated
surrogate can then replace PR if the measured errors justify it.

## Nozzle expansion

The current nozzle is converging, so the modeled exit and throat coincide. At
each supported expansion state:

\[
s_e=s_0,\qquad v_e=\sqrt{2(h_0-h_e)},\qquad
\dot m_e=C_d A_e\rho_e v_e,\qquad
F=\dot m_e v_e+(p_e-p_a)A_e.
\]

Unchoked flow expands to ambient pressure. Choked flow requires a supported
sonic state, with Mach within 2e-5 of one; a property-bound endpoint cannot
substitute for a sonic throat. A choked converging exit can remain above ambient
pressure. The pressure-thrust term accounts for that mismatch; an unmodeled
divergent section is not assumed to deliver extra exit velocity.

Exit pressure, temperature, velocity, Mach, choking and `nozzle_active` are
exported in Launch/Hop CSV. Inactive finite placeholder states are masked from
nozzle plots and readouts display **No flow**. The vessel schematic now shows a
converging passage, matching the equations.

Cd=0.9 is an illustrative mass-discharge coefficient, not a measured loss map.
There is no regulator, valve Cv/opening transient, feed-line pressure drop,
divergent area ratio, flow separation, shock system or resolved plume. A future
converging-diverging model needs actual throat/exit geometry and off-design
back-pressure treatment; nozzle area alone is insufficient.

## Invert: spin and contact scope

While supported, pitch follows the prescribed quintic deck motion. At release,
the body inherits both deck-related COM velocity and angular velocity. Free
flight has ballistic COM translation and constant angular velocity under the
assumed zero external pitch torque.

A separating-axis check uses the same rectangular body/deck proxies as the
rendered rig. The first secondary contact terminates playback before penetration
(1 micrometre tolerance), with status **DECK CONTACT LIMIT**, outcome
**UNRESOLVED**, and no ground-impact speed or damage classification. With the
default 0→180 degree / 4 s sweep and no fan, detachment is about 1.726 s and
recontact about 1.727 s; the old later ground-wreck prediction is withdrawn.

External rig work now includes body rotational kinetic energy, with assumed
uniform-rectangle inertia I=m(4.7²+1.3²)/12. Fan electrical work, friction loss
and rig mechanical work remain separate. Deck inertia and motor efficiency are
not modeled.

This fixes inherited spin and prevents unsupported pass-through trajectories.
It does **not** complete planar rigid-body contact: supported axle loads/moments,
edge tipping, contact impulses, bouncing and collision/seal recovery are still
open. Continuing through recontact would require those equations, not a visual
deflection rule.

## Numerical and export verification

- **116/116 regression tests pass**, including nine focused EOS/thermal tests.
- Independent finite differences check cp, cv, entropy derivatives and sound;
  pressure/density/energy inversions round-trip supported states.
- Nozzle tests check entropy, stagnation/static energy, choking and pressure thrust.
- Heated Launch/Hop tests integrate mass flow and stagnation-enthalpy outflow and
  verify the first law with signed heat. Sealed runs conserve mass and satisfy
  delta(mu)=Q, with warmer shared inventory retained.
- Heat-only RK4 steps resolve m*cv/UA, including a 0.006 kg inventory at maximum
  conductance; the temperature approaches the source without overshoot.
- Launch/Hop reject unsupported intermediate RK stages. Valve commands remain
  fixed within a step, with explicit left/right event samples and finite exports.
- Heated automatic-landing search includes coast heating and five ignition-energy
  burn profiles. Final predictions/playback always use the full solver; timestep
  refinement checks the target landing. The controller still assumes perfect
  state knowledge and ideal mean-duty valves.
- Invert tests check inherited spin, proxy separation, external work including
  rotation, timestep sensitivity and unresolved recontact outcomes.
- Existing worker/direct and standalone-build parity gates remain in the suite.

Browser verification and remaining review limits are recorded with this repair
in the root `MILESTONES.md`. Passing these checks establishes covered numerical
consistency, not experimental validation or hardware feasibility.

## Next physics priorities

1. Quantify the PR error against reference dry-air properties, especially along
   cold nozzle isentropes; keep phase limits explicit.
2. Add measured/traceable valve, feed-line and nozzle loss inputs, then divergent
   expansion only if a specific geometry is selected.
3. Complete planar Invert contact moments and secondary-contact response.
4. Add finite wall thermal storage if recovery between separated burns matters.
5. Preserve the audit's separate fan/tire, dynamic Turn, Hop attitude/actuation and
   component-mass limitations. Those were not implemented in this repair.

## Primary reference targets

- [Lemmon et al., thermodynamic properties of air (NIST, 2000)](https://www.nist.gov/publications/thermodynamic-properties-air-and-mixtures-nitrogen-argon-and-oxygen-60-2000-k-pressures): reference EOS target, not the implemented PR formulation.
- [NASA Glenn, Rocket Thrust Equations](https://www.grc.nasa.gov/WWW/K-12/BGP/rktthsum.html): momentum/pressure thrust and the distinction between throat and exit geometry. Its ideal-gas relations are not substituted for this implementation's real-gas isentropic property solve.
- [NASA Glenn, Nozzle Design](https://www.grc.nasa.gov/www/BGH/nozzled.html): geometry, choking and expansion context.
