# Project offers, deliverables and installments

Scope: frontend implementation only. Backend code is read-only. All backend edits made during the initial implementation have been reverted; pre-existing backend changes were preserved.

## Review of Claude's plan
The API incompatibilities are confirmed: offers accept `full|partial`, partial requires at least two installments, reviews require a project deliverable ID, uploads accept one file and require `deliverable_id` for deliverables, and timeline keys are dynamic. Services own scopes, prompts, components and deliverables.

Corrections:
- Do not impose unique deliverable-linked installments or a minimum payment date: neither is a backend rule. Partial percentages are 1–100 and sum to 100 rounded to four decimals. Zero hourly rates are valid; estimated hours must be whole numbers.
- `contract` is the installment due type; `contracting` is the timeline step. Pin the contract installment first, but never sort returned timeline steps by installment position or move the completed party ahead of contracting.
- SQL timestamps are already localized using X-Timezone in several resources. Preserve calendar dates without assuming all timestamps are UTC.
- Completed party/deliverable steps can follow unfinished steps. Do not infer closure from a payment or override server review states.
- Full payment currently creates a date installment without a date, placed after deliverables. Preserve and explain this behavior; changing to upfront payment changes commercial terms and is outside an API migration.
- Preserve gross client-payment amounts; do not label them as insighter earnings.
- Reviews remain available for any unapproved deliverable while the project is in progress/in review, with only one pending review project-wide. Do not invent a strict sequential review policy.
- Checkout must follow the active timeline step, not ascending installment position. The supplied example legitimately makes payment 4 eligible before payment 3.
- Lifecycle and actor checks belong on the API as well as the UI. Signing, award/technical decisions, client uploads and closing must enforce the correct participant and current project state.

## Implementation sequence
1. Shared typed service/deliverable/installment mapping and validation helpers; retain legacy reads only for historical data.
2. Per-service requirement display reused in project details, proposal details and offer composer. Show service scopes, data sources, target markets, delivery requirements, addons and dates.
3. Full/partial composer with editable installment rows, contract-first stable order, exact validation, file validation and conditional multipart serialization. Show percentage/amount totals and an indicative timeline preview.
4. Offer review tables for both audiences with due conditions and current offer status labels. Guard deadline/stage-sensitive proposal actions.
5. Awarded workspace with deliverable selection, latest/history reviews and linked payments; project-wide pending checks; one upload request per file with successful files removed before retry.
6. Shared timeline preserves backend order, state, titles and numbering. Dynamic payment/deliverable actions carry their IDs. Client checkout uses order installment ID and selected amount.
7. Report backend blockers without changing the backend. Keep frontend guards and tolerate missing response fields; use existing detail endpoints for match identifiers and offer statuses. Sort detailed proposals in the frontend.
8. Verify Angular templates/build and focused regression tests covering serialization, percentage precision, contract order, dynamic timeline, multiple deliverables, checkout and current API fallbacks. Document backend limitations separately.

## API coverage
Insighter: project list/statistics/show/timeline; proposal mark-as-viewd/interest/decline/add-offer; contract GET/sign; project file upload/download/read; review-submission GET/POST/read. Client: project details/proposals and offer technical decisions/award; contract sign; timeline/review decision/close; `account/order/project/checkout/{order_installment}`. Existing routing identifiers must remain distinct: project UUID, proposal-match UUID, contract UUID and numeric order-installment ID.

## Acceptance
Contract installments are first and unique; full submits no installments. Two deliverables and five payments render in server order (including payment 4 before payment 3). Completed party never changes contracting state. Review/upload target the chosen deliverable. Pending review blocks another request. Client payment uses the clicked installment ID and amount, never start/end endpoints. Cancelled/closed projects expose no mutation actions when their current status is supplied by the API. English/Arabic labels remain available.

## Backend findings — report only; no backend changes
These findings come from source inspection, not authenticated runtime tests.

1. **Checkout/timeline conflict (blocking):** `app/Http/Controllers/Api/Order/Platform/OrderProjectController.php:222` rejects an installment if any lower-position installment is unpaid. The supplied timeline can activate installment 4 before installment 3. That payment can fail with “Previous installment must be paid first.” The frontend preserves server timeline order and surfaces checkout errors; it cannot resolve this server rule conflict.
2. **Client review deliverable identity is absent (feature blocker):** `ClientProjectController::perProject` does not eager-load `deliverable`, while `ProjectCompletionSubmissionResource` emits it only when loaded. Reliable client-side per-deliverable review history is therefore unavailable. The frontend keeps all reviews visible and only enables the deliverable filter when every review supplies its identity; it does not guess associations.
3. **Offer-file filtering uses the awarded insighter:** both insighter project resources filter top-level offer files by the winner rather than the requesting insighter. Before award this can omit files; after award it can associate the winner's files with another invited insighter's response. Nested match/offer files are available separately. Backend owner should review the top-level field.
4. **Missing authoritative list fields:** non-awarded list entries omit project status/stage, match UUID and offer status. The frontend obtains match/offer information from the details endpoint, sorts detailed proposals by creation date and derives hourly rate from price/hours when missing. Cancelled status cannot be reliably displayed on every summary card without detail data.
5. **Lifecycle/authorization gaps:** proposal mutation endpoints do not consistently enforce project lifecycle/deadline; signing lacks the ordering/actor checks discussed in the review; client upload/close routes use `can:view` instead of owner-only mutation authorization; close checks payments without requiring approved deliverables; review decisions do not restore `in_progress`. Frontend guards improve normal flows but cannot enforce server authorization or change persisted status. These need backend-owner review.
6. **Repeated deliverable-payment ordering:** the builder inserts every linked payment immediately after its deliverable, reversing their order when multiple payments share one deliverable. The preview follows this existing behavior and saved timeline remains authoritative.

No backend corrections or added backend regression tests remain in the working tree. Existing unrelated backend changes were not reverted.

## Frontend verification — 2026-09-26
- Angular development build passed: `npm run build -- --configuration development --progress=false`, with existing CommonJS/optional-chain warnings.
- Angular compiler/template check passed after removing backend dependencies. All 19 focused ChromeHeadless tests passed, covering mapping, validation/serialization, contract-first order, API timeline states, selected payment ID/amount, deliverable review payloads, project-wide pending reviews, single-file retries, file/date limits and English/Arabic rendering. Compatibility checks cover unsorted proposal details and reviews without deliverable identity.
- Run focused tests on macOS with `CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:project-workflow`.
- Backend execution was unavailable because Docker/Podman is not running. No backend test pass is claimed.
- Authenticated end-to-end signing and real payment processing have not been exercised. Full payment retains its existing position after deliverables; installment amounts are gross client payment amounts rather than insighter earnings.
