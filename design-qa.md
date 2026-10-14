# Client offer drawer — Option 1 design QA

Date: 2026-10-14
Implementation: http://localhost:4200/app/insighter-dashboard/projects-created/b8ed90df-3052-4b03-a66b-3d6779bb8e98
State: View Offer drawer open for the saved $100 offer; pending review; two services and three installments. Client acceptance/rejection/award handlers were preserved and were not invoked by QA.

## Source and evidence

Source visual truth: `/Users/izzeddinashour/.codex/generated_images/01a138e4-76f0-7d03-af24-61bddae9e9b2/exec-2d45a0ab-132f-447c-b9ba-1d499b64ff96.png` (the user-selected Option 1).
Evidence directory: `/Users/izzeddinashour/Desktop/Production-KNOLDG/artifacts/client-offer-drawer/`.

- `before.png`: the old stacked drawer captured before edits.
- `drawer-top.png` and `drawer-payments.png`: rendered desktop top and internally scrolled payment states at CSS viewport 1548 × 807; drawer 1280 × 807; raw screenshots 2560 × 1614, device density 2×.
- `drawer-payments-1x.png`: normalized by uniform 0.5 scaling to 1280 × 807 CSS pixels.
- `comparison-offer.png`: source Offer region 885 × 698 and implementation region 952 × 716 presented together at 1× without stretching. The focused comparison is required because the real modal’s viewport and Client-specific chrome differ from the reference’s full-page shell.
- `final-desktop.png`: final open drawer in the restored session, CSS viewport 1920 × 807, drawer 1280 × 807, raw screenshot 2560 × 1614.
- `final-desktop-1x.png`: normalized final screenshot, 1280 × 807.
- `mobile-payments.png`: CSS viewport and screenshot 390 × 844, showing all payments above the fixed Client decision footer.

The approved visual target is the Offer content hierarchy. The Client identity/profile header, decision sidebar, award warning and mobile decision footer are intentional adaptations to this existing drawer, not changes to the selected direction.

## Findings and iteration history

Initial result: blocked.

- [P2] The old narrow drawer squeezed offer content into a long stack. Replaced the cover/pricing/requirements stack with the same shared Offer overview used by the Insighter tab. Increased the desktop drawer width to at most 1280px and reduced the action rail to 280px. Client and Insighter views now share the price/status summary, service grouping, dates, and payment presentation.
- [P2] Desktop viewport rules alone could produce cramped service rows and wrapped payment connections inside narrow containers. Added container-based layout adaptations to the shared overview and timeline. Small containers stack deliverable dates and payment steps.
- [P2] The first mobile pass exposed the existing fixed action footer over the new content’s bottom padding. Reserved 180px plus the safe-area inset beneath the offer. Post-fix DOM evidence: final payment bottom 651px, action footer top 692px, close button top 16px, no horizontal document or drawer overflow. The final mobile screenshot visibly confirms readable payment dates and accessible decision buttons.

Post-fix comparison: `comparison-offer.png` plus `mobile-payments.png`. No actionable P0/P1/P2 differences remain within the requested drawer.

## Required fidelity surfaces

- Typography: existing Inter/Almarai retained; 42px price, 16px section headings, 14px content titles/body and smaller supporting metadata. Client identity title is 24px. Long content wraps rather than truncating contractual terms.
- Spacing/layout: one summary surface, an unboxed cover letter, grouped service rows, thin separators and a desktop payment strip. The Client action rail remains separate. Desktop content scrolls independently; narrow screens have a scrollable modal and the product’s existing fixed action footer.
- Colors/tokens: existing white, soft gray, dark text and blue accent tokens retained. Pending review uses readable amber; existing technical decision button colors remain unchanged.
- Image quality/assets: real Insighter avatar and existing icon libraries reused. No generated or substitute raster artwork was necessary. No new decorative artwork was added.
- Copy/content: actual stored data retained. Client summary says “Submitted offer” and “Awaiting your review”; Insighter wording remains “Your submitted offer” and “Awaiting client response”. The Client’s requirements-on-award notice is preserved. Existing Arabic translations remain bound to the current language; the shared overview’s RTL behavior was verified in the preceding Offer-tab QA.

## Verification

- Angular application and template compilation passed; existing unrelated optional-chain warnings remain.
- `git diff --check` passed.
- Opening, close button, reopening and Escape dismissal verified. Background scroll is locked while the modal is open and unlocked on dismissal.
- Desktop internal scrolling exposes all payment amounts, percentages, deliverable names and dates; the action area stays positioned beside the content.
- Mobile: 390 × 844, no horizontal overflow, fixed decision buttons visible, last payment not covered, close control reachable and functional.
- Insighter summary component moved into the existing shared module so both application surfaces use one implementation; no API or decision handlers changed.
- Final browser console errors: empty. An earlier role-specific mark-viewed permission error occurred before the Client-session switch and did not recur in the final check.
- No technical acceptance, rejection, award, payment or contract action was submitted during design verification.
- Arabic full drawer and alternative accepted/awarded offer states were not separately exercised in this pass; the existing localized header/action logic and conditional action controls remain unchanged.

## Follow-up polish

None required for this scope. Long-form/multi-file and already-awarded offers remain useful additional live-data test cases.

final result: passed
