# Local dashboard QA

## Shopping API integration — 2026-10-20

`node dashboard/tests/shopping_node.cjs` (from the repository root) tests the live
shopping client with a controlled transport: no prototype-data import, text
quantities, acknowledged changes, duplicate-safe retries after lost replies and
reload, 409 conflicts, offline snapshots, auth failures, and storage failures.
`shopping_photos.cjs` now retains photo checks only (8,893 assertions); the historical
prototype-shopping checks below describe the earlier implementation.

The integration was also exercised against the real API inside the physical frame's
WebView 106: add/edit, check/uncheck, remove, clear checked, undo, and a stale-editor
409. Temporary verification items were removed. See
[shopping-api.md](../../docs/shopping-api.md) and the build journal for details and
limits. The older local-only scope statements below apply to the earlier QA pass.

These checks target the **local mock dashboard only**. They are not CI jobs, a deployment, a live-device integration test, or physical-frame certification.

## Reproduce locally

From `dashboard/`:

```sh
# If dependencies are missing; uses the checked-in lockfile, without lifecycle scripts.
npm ci --ignore-scripts --no-audit --no-fund --cache=/tmp/dash01-npm-cache
npm run build
node tests/calendar_chores.cjs
node tests/shopping_photos.cjs
node tests/control_providers.cjs
python3 tests/serve_local.py
```

Open `http://127.0.0.1:4173/` in a desktop browser. The helper serves `dist/` on **loopback only**. Stop with Ctrl-C. `--port` selects a different local port. Rebuild after source changes, then reload the browser. Do not use the package's deploy command for QA.

### Optional browser harness

`local_regression.py` requires Python Playwright and a locally installed Chromium. It creates a fresh browser context, so it does not modify a user's normal browser storage. It accepts only loopback HTTP URLs and exercises the mock fixture through UI actions.

```sh
python3 tests/local_regression.py --url http://127.0.0.1:4173
# Optional narrower passes:
python3 tests/local_regression.py --matrix-only
python3 tests/local_regression.py --interactions-only
```

Use `--chromium /path/to/chromium` when it is not on PATH. Default artifacts are under ignored `../diagnostics/local-dashboard-qa/`: PNG screenshots, stage/viewport metrics, and `report.json`. The matrix is seven routes × four themes × three desktop viewports (1280×800, 1600×1000, 1920×1080). This checks outer bounds, not every intentional internal scroll region. Images may use external illustrative photo URLs. Review screenshots manually; this is **not a golden-image comparison**.

**Harness status:** authored and Python syntax-checked, but **not executed successfully end-to-end in the 2026-10-20 managed environment**. Its direct Chromium launch was blocked before browser startup by the process-singleton socket sandbox restriction. A separate documented browser route was used for the manual checks below. Do not describe the 84-image automated matrix as passed. No access restriction was bypassed. The harness should first be exercised in an ordinary local developer environment before it is relied on as an automated regression gate.

## Verified on 2026-10-20

Evidence is from the current production build served locally to desktop Chromium through the documented browser UI tooling, plus the Node model suites. Screenshots were actually inspected in the QA session, not generated from reference images. They were emitted in the session; no durable screenshot archive is claimed.

### Build and model checks — passed

- Vite production build (28 modules).
- `calendar_chores.cjs`: geometry, overlaps/shared events, all-day/month handling, stable chores ordering, attribution/rewards/history, pending/cancel/undo/rollover. Includes shared-card contrast checks for all themes and the WebView106 CSS fallback; these static checks do **not** constitute a WebView106 runtime test.
- `shopping_photos.cjs`: 8,925 assertions including 2,500 deterministic layout selections; shopping state, undo/storage, photo metadata/history/loading/timer lifecycle and caption focus preservation.
- `control_providers.cjs`: pending/duplicate/offline/failure/missing-device behavior; relock and out-of-order feedback; exact19-device inventory; six provider cards, ten meters, five trend lines, exact totals, usage/service separation, timestamp-only Refresh, missing/over-quota resilience.
- Python syntax compilation for both QA helpers; `git diff --check`.

### Actual desktop browser checks — passed

All seven routes were inspected at **1280×800 in Mint, Unit01 purple, Unit02 red, and Unit03 silver** across the QA and parent sessions. Rails, primary controls and card bounds fit; internal scroll regions in Calendar, Chores, Shopping and Home are intentional. This was a four-theme visual sweep, not an exhaustive cross-product of every interaction and theme.

| Screen | Actual checks |
| --- | --- |
| Today | Seven-item rail; clock/weather; people; next event; four agenda lanes; four summary cards. Clock and agenda/bottom-card spacing fixes rechecked. |
| Calendar | Today/3Day/Week/Month layouts; date browsing/return; required title/person validation; add local event with selected date; event detail. Session-only event behavior. |
| Chores | Five equal lanes; full Anyone label after fix; completion/restoration and stars; Anyone cancel without change and attribution on completion; feedback/undo region. |
| Shopping | Distinct-entry count; quantity1→2→1 with disabled decrement at1; store filtering; five autocomplete suggestions; add/check undo preserving metadata; twelve quick-add tiles; draft retained across theme change. |
| Photos | All five modes; next/previous history; selected-photo favourite; detail emphasis; retained rail; themes do not recolor photos. Caption Enter activation1→2→1 retains focus on replacement control after fix. |
| Home | Pending-to-confirmed thermostat change and reverse; lock hold/unlock/relock; garage confirmation interaction; light toggle and summary-count change; media pause/play; camera snapshot dialog. Blind controls were visually inspected, not hardware-tested. Parent session owns the broader Home interaction evidence. |
| Agents | Six provider cards, ten meters, five sparklines and aggregate fit. Refresh changes only timestamp/announcer, not usage/status. |

Theme selection persisted after reload. Dialogs and feedback were inspected during the above interactions. Final visual/runtime defects were fixed and rechecked:

1. Today clock and agenda spacing: no bottom-card overlap.
2. Chores Anyone header: complete label visible.
3. Photos caption control: keyboard focus survives repaint.
4. Silver Calendar shared Dinner: dark readable foreground on pale silver; person colors and travel hatching unchanged.
5. Home feedback: unlock→confirmed unlocked; relock immediately replaces old success with “Locking…”; terminal banner says confirmed locked and agrees with the tile. No stale unlocked banner remains.
6. Home/Agents headings: corrected suffix sizing and removed duplicate separator. The final Home heading was rechecked visually; the Agents separator correction was also checked in source/build.

### Not verified / remaining coverage

- Larger1600×1000 and1920×1080 browser viewports. A normal native maximize attempt did not produce a stable larger viewport; no larger-size pass is claimed.
- Automated Playwright matrix/interactions end-to-end (launch blocked as described above).
- Physical frame, Android WebView106 runtime, touch hardware/gesture fidelity, real sensors or device commands.
- Pixel-exact comparison to supplied reference images, exhaustive accessibility/contrast audit, exhaustive every-dialog/theme combinations, long-duration soak, or production network/photo reliability.
- Node VM tests use controlled model/DOM stubs; they do not replace browser geometry and interaction tests.

Only local test fixtures/preferences were manipulated. No CI, deployment, purchase, paid resource, remote device, or hardware execution was used.
