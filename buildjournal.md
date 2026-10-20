# DASH-01 Build Journal

This is the append-only implementation journal for the approved seven-screen redesign.
Each completed fix or phase records its changes, local checks, remaining limitations, and
Git checkpoint. Existing history must be preserved.

## Working agreement

- Work in the actual `TianJieHeng/Dash-01` Git repository, not a loose source snapshot.
- Use normal terminal HTTPS Git for commits and pushes; publish a journal checkpoint
  between implementation phases.
- **The attached reference images govern appearance**, including the Chores and Home
  compositions where the earlier written design handoffs disagree.
- Preserve the existing seven routes, working controls, and mock-data behavior. Do not
  represent simulated devices or illustrative provider data as live integrations.
- Keep the shared cream/mint/charcoal, restrained 1990s-anime visual direction. Build real,
  accessible HTML/CSS controls rather than flattening the references into background images.
- Verify locally only. **No CI, Docker, remote-machine execution, device access/flashing,
  or paid resources.** Deployment and physical-frame validation remain pending.

## Source and architecture review

The implementation starts from `main` at
`f1e0820918c926396e0ccafb4839568825f63edc` (350 tracked files).
The repository was cloned using terminal Git over HTTPS on 2026-10-20. There was no
existing tracked build journal and no repository-local `AGENTS.md`; the workspace's
standing workflow instructions were read. The upstream README and
`docs/building-for-the-frame.md` were reviewed before implementation.

The app is a plain JavaScript Vite dashboard, not a framework rewrite:

| Screen | Route | JavaScript | Styles |
| --- | --- | --- | --- |
| Today | `home` | `dashboard/js/views/home.js` | `dashboard/css/views/home.css` |
| Calendar | `calendar` | `dashboard/js/views/calendar.js` | `dashboard/css/views/calendar.css` |
| Chores | `tasks` | `dashboard/js/views/tasks.js` | `dashboard/css/views/tasks.css` |
| Shopping | `shopping` | `dashboard/js/views/shopping.js` | `dashboard/css/views/shopping.css` |
| Photos | `photos` | `dashboard/js/views/photos.js` | `dashboard/css/views/photos.css` |
| Home controls | `control` | `dashboard/js/views/control.js` | `dashboard/css/views/control.css` |
| Agents | `agents` | `dashboard/js/views/agents.js` | `dashboard/css/views/agents.css` |

Shared shell and assets are in `dashboard/index.html`, `dashboard/css/tokens.css`,
`dashboard/css/base.css`, `dashboard/js/app.js`, `dashboard/js/icons.js`, and
`dashboard/js/data.js`. `dashboard/js/main.js` imports the view modules. The shell
provides navigation, cached views, sheets, toasts, demo time, and ambient/night modes.

The target is a 1280 × 800 landscape touch display. Preserve the existing Vite build
targets (`chrome106` JavaScript, `chrome61` CSS), avoid unsupported CSS features and
alpha-hex colors, and keep assets same-origin and lightweight. Local browser testing
does not establish physical-device compatibility.

### Approved visual inputs

The supplied image references are `FrontPage_Preview.png`,
`CalendarPage_Preview.png`, `ChoresPage_preview.png`, `ShoppingPage_preview.png`,
`PhotosPage_preview.png`, `HabitatControl_preview.png`, and `AgentsPage_preview.png`.
The accompanying `FrontPage_design.md`, `CalendarPage_design.md`,
`ChoresPage_design.md`, `ShoppingPage_design.md`, `PhotosPage_design.md`,
`HabitatControl_design.md`, and `AgentsPage_design.md` provide behavioral guidance;
the user's later image-first direction overrides their conflicting appearance choices.

## Planned implementation phases

| Phase | Scope | Completion evidence |
| --- | --- | --- |
| 1 | Shared theme/navigation and Today, following Daily Command | Local build, 1280 × 800 visual inspection, navigation and Today controls |
| 2 | Calendar, following Time Rail | Date navigation, person filters, event layout, sheets, and local visual checks |
| 3 | Chores, following the attached Chores image | Routine switching, completion/undo, progress, and local visual checks |
| 4 | Shopping, following Supply Rail | Filters, quick add, item completion/undo, repeated actions, and local visual checks |
| 5 | Photos, following Cinema Frame | Modes, previous/next, favourite state, return navigation, and local visual checks |
| 6 | Home controls, following the attached Habitat Control image | Simulated toggles/scenes, deliberate sensitive actions, sheets, and local visual checks |
| 7 | Agents, following Provider Rail | Truthful demo labels, usage rendering, timestamp-only refresh, and local visual checks |

After the seven screen phases, run integrated local checks over all routes, overlays,
repeated interactions, route transitions, and build output. Record any failed or
unavailable checks explicitly. No deployment or real-device testing is implied by a
successful frontend build.

## Checkpoints

### 2026-10-20 — Phase 0: repository baseline and implementation plan

**Changed:** Created this root `buildjournal.md` before UI implementation. Preserved
the cloned remote history and the existing application source. Documented source
authority, architecture, seven phases, constraints, and verification expectations.

**Local checks:**

- `git status --short --branch`: clean `main` tracking `origin/main` before this file.
- `node --check` on all 15 dashboard JavaScript modules and `vite.config.js`: **passed**
  (16 files).
- Confirmed there are no `.github/workflows` files. No CI was run.
- Production build and browser interaction/visual tests: **not yet run**.

**Publication:** This journal checkpoint is committed on top of the baseline above.
The exact commit is available from `git log -- buildjournal.md`; push verification is
reported with the checkpoint delivery rather than embedding its own recursive hash.

**Remaining:** Implement the seven screens, complete local regression/visual checks,
and keep updating this journal and Git after each phase. Deployment and physical-frame
validation are pending and outside this checkpoint.

### 2026-10-20 — Publication transport clarification

Terminal HTTPS clone/fetch succeeded, but terminal push had no saved GitHub
authentication (`could not read Username`); `gh auth status` confirmed no login.
After that blocker was reported, the user explicitly authorized the GitHub
connector/API for Dash-01 publication. This supersedes the terminal-only
publication part of the original working agreement, not the requirement to
develop and commit inside the actual local repository.

Phase 0 was published as `068107c3fb3da79ed1a283222c3d912710d6659c`,
preserving parent `f1e0820918c926396e0ccafb4839568825f63edc`. Publication
uses a base tree, explicit parent, expected-head lease, and non-force ref update.
Terminal fetch verified identical local/published trees. The original local
checkpoint remains available at `refs/local-checkpoints/phase-0`; the metadata-only
hash mapping is recorded in `.git/publication-map.jsonl`. The index and working
files were not reset or rebased.

### 2026-10-20 — Phase 1: shared shell and Today / Daily Command

**Changed:**

- Added a 176px shared navigation rail, four persisted theme choices, local
  licensed font subsets, and 24-hour time presentation.
- Reworked Today to follow the supplied image: clock/weather band, household
  presence, mint next-event banner, four agenda columns, and four summary cards.
- Updated central demo fixtures while preserving existing identifiers and legacy
  data contracts. New provider readings are isolated in backward-compatible
  `DATA.agentUsage`; they do not imply a live provider connection.
- Improved shared modal accessibility and deliberate press-and-hold handling,
  including pruning disconnected hold registrations.
- Used initials as the avatar fallback: separate reusable anime-avatar source
  assets were not supplied. The reference image is not used as a flattened UI.
- Scoped this phase to eight source files and seven font/license/readme files,
  plus this journal. Other screen work in progress was deliberately excluded.

**Local checks:**

- Parent-reported desktop browser inspection at exactly **1280 × 800** confirmed
  all seven rail destinations, 24-hour time, four visible summary cards, and the
  repaired Today clock/agenda geometry. The clock remained within its card;
  agenda actions ended at y=600 with an 8px gap before summary cards at y=608,
  whose content remained visible through y=789.
- All four themes and theme-03 persistence after reload were checked before the
  final layout adjustment; the final adjusted layout was rechecked in Mint.
- The combined development-tree production build passed.
- Independently archived the **staged phase-only tree** under
  `.git/phase-candidates/phase1`, reused installed dependencies without modifying
  the active worktree, and ran `npm run build`: **passed**, 28 modules,
  111.76 kB JavaScript / 35.29 kB gzip and 66.25 kB CSS / 13.90 kB gzip.
- `node --check` on all JavaScript modules and Vite config in that isolated
  candidate: **passed**. Exact staged-file allowlist and `git diff --check`:
  **passed**.
- No CI, Docker, paid service, remote machine, deployment, or hardware access was
  used. These checks establish local desktop behavior, **not physical-frame
  validation**.

**Publication:** Commit this phase on top of the verified Phase 0 publication;
publish the exact staged tree through the user-approved connector with an
expected-head lease and verify the fetched remote tree before reporting success.
Commit hashes are available in `git log -- buildjournal.md` and the local
publication map.

**Remaining:** Calendar, Chores, Shopping, Photos, Home controls, and Agents are
the six remaining screen phases. Integrated regression, deployment, and
physical-frame validation remain pending; no live integrations are claimed.
