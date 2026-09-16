# Mobile responsiveness review — 16 September 2026

## Changes

- Give the insight wizard an explicit fixed-header offset. Normalize the mobile header to 64px so its padding does not cover the step indicator.
- Keep step labels at least 10px, reduce phone card spacing, preserve icon dimensions, and use two choice-card columns from tablet widths.
- Wrap wizard actions, provide 44px mobile action heights, and reset scroll position when changing steps.
- Reflow chapter editing into full-width title rows with 44px reorder/remove controls and accessible title labels.
- Constrain the details loading skeleton to its container.
- Constrain PrimeNG dialogs, toast messages, and sidebars to the phone viewport. Allow dialog titles and footer controls to wrap.
- Bound the user menu by the available viewport height. Keep the mobile notification drawer above the sticky header and sized to its fixed container.
- Normalize the dashboard tablet header offset, add bottom scroll space for the floating navigation control, and enlarge that control to 44px.
- Make the insighter filter menu shrink to narrow viewports and wrap long names.

## Browser tour

Used the existing local insighter session against the configured staging API. No publishing, payment, form submission, uploads, or content edits were performed. English was restored after Arabic checks.

| Screen | Viewport / result |
| --- | --- |
| Add insight: type selection | 393px and 320px English; 320px and 768px Arabic; no document-width overflow measured. Final English two-column tablet grid visually checked at 768px. |
| Edit insight: upload | 320px; document fields and actions fit; document width matches viewport. |
| Edit insight: summary | 320px; editor fits; identified overly narrow chapter inputs and implemented the responsive row fix. Final chapter-row appearance still needs a browser check. |
| Edit insight: details | 320px; editor, tags, classifications and bottom buttons inspected; document width matches viewport. Back navigation verified to return to the top. |
| Dashboard overview | Production screenshot review at 393px. |
| My library | 320px; no document overflow; tabs use their own horizontal scroller. |
| Sessions | 320px; empty state fits, no document overflow. |
| Purchases | 320px; populated cards fit, no document overflow. |
| Wallet | 320px; balance, chart and transaction controls inspected; document width matches viewport. |
| General settings | 320px; no document overflow. |
| Payment settings | 320px; populated payout cards fit, no document overflow. |
| Session schedule settings | 320px; available-day controls fit, no document overflow. |
| Project settings | 320px; service controls fit, no document overflow. |
| Client projects | 320px; list fits; filter chips scroll inside their own container. |
| Projects created | 320px; cards fit; status chips scroll inside their own container. |
| Downloads | 320px; populated list and search visually inspected. |
| Bookmarks | 320px; populated cards and filters visually inspected. |
| Requests | 320px; empty state fits, no document overflow. |
| Sales | 320px; totals and chart inspected; tabs scroll inside their container. |
| Notification settings | 320px English and Arabic; controls fit. |
| Mobile navigation | Opened and closed the sidebar and user menu at 320px. |
| Notifications drawer | Opened and closed at 320px; full-height content and close button visible. |

## Validation

- Angular development build: passed after the final changes.
- Git whitespace/diff checks: passed.
- Existing template optional-chain and CommonJS warnings remain.
- Browser console includes existing font-loading and blocked third-party telemetry warnings.

## Remaining verification

The Mac locked during the final desktop viewport check. Computer-use tools confirmed that manual unlock is required. Consequently:

- Final chapter-row layout, desktop (1280px) regression check, and linked public profile/feed screens remain unverified.
- Company settings require a company-role session; the local insighter session redirects away. Company-only screens were not fully toured.
- The publish action, payment submissions, uploads, and destructive actions were not executed.
- This review covers the screens and states above, not every record, role, modal, or end-to-end workflow.

Changes are local and have not been deployed.
