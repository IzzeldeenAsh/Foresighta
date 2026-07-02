# Design QA

- Source visual truth: `/var/folders/bp/jypbddkj1g758_mdbfx68vzw0000gn/T/TemporaryItems/NSIRD_screencaptureui_pg5R5S/Screenshot 2026-06-23 at 8.10.05 AM.png`
- Implementation routes:
  - `http://localhost:4200/app/insighter-dashboard/project-offers`
  - `http://localhost:4200/app/insighter-dashboard/on-work-projects`
- Implementation screenshots: authenticated Google Chrome Computer Use captures from June 23, 2026 (session-backed; not persisted to the filesystem)
- Viewport: desktop, approximately 1524 × 768
- State: proposals populated with two rows; accepted projects verified in its available empty state

**Full-view comparison evidence**

- The proposal route matches Option B's compact hierarchy: status-dot chips, dedicated result/read/view bar, borderless table header, compact rows, muted palette, document artwork, status pills, and outlined view action.
- The accepted-project route uses the same compact count/view bar and table system without adding unsupported filters.

**Focused region comparison evidence**

- Toolbar spacing, active states, dots, counters, segmented controls, view switch, table headings, project artwork, unread marker, Type icons, service icon, dates, status/signature pills, and action buttons were checked in the authenticated browser.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- Project Proposals preserves action/read filtering and restores its existing Type SVG artwork.
- Accepted Projects preserves signature summaries and contract behavior.

**Patches made**

- Added the Option B toolbar structure to Project Proposals.
- Added the compact count/view bar to Accepted Projects.
- Added the shared document SVG to desktop and mobile rows.
- Added compact shared table, badge, signature, responsive, and interaction styling.

**Follow-up polish**

- P3: Recheck Accepted Projects with a populated API response when one is available.

final result: passed
