# Modal Button Standards

This document defines the global standards for modal buttons across the Insighta application.

## CSS Classes

The following CSS classes have been added to `src/styles.scss` for consistent modal button styling:

### Standard Modal Buttons
```css
.modal-btn-standard
```
- Height: 38px
- Padding: 0.5rem 1rem
- Font size: 0.875rem

### Small Modal Buttons (Recommended)
```css
.modal-btn-sm
```
- Height: 32px
- Padding: 0.375rem 0.75rem
- Font size: 0.8125rem

### Large Modal Buttons
```css
.modal-btn-lg
```
- Height: 44px
- Padding: 0.625rem 1.25rem
- Font size: 0.9375rem

## Usage Examples

### Standard Modal Footer
```html
<ng-template pTemplate="footer">
  <button
    type="button"
    class="btn btn-light modal-btn-sm me-2"
    (click)="closeDialog()">
    <i class="ki-duotone ki-cross fs-4">
      <span class="path1"></span>
      <span class="path2"></span>
    </i>
    Cancel
  </button>
  <button
    type="button"
    class="btn btn-primary modal-btn-sm"
    [disabled]="loading()"
    (click)="confirmAction()">
    @if (!loading()) {
      <i class="ki-duotone ki-check fs-4">
        <span class="path1"></span>
        <span class="path2"></span>
      </i>
      Confirm
    } @else {
      <span class="spinner-border spinner-border-sm" role="status"></span>
    }
  </button>
</ng-template>
```

## Key Features

1. **Consistent Heights**: All modal buttons have standardized heights
2. **Proper Spinner Sizing**: Spinners are automatically sized correctly for each button size
3. **No Text with Spinners**: Only show spinners during loading states, no accompanying text
4. **Flexible Sizing**: Three size variants available (sm, standard, lg)

## Implementation Notes

- Use `modal-btn-sm` for most modals to keep UI clean and compact
- Always combine with existing Bootstrap button classes (btn, btn-primary, etc.)
- Remove loading text when showing spinners
- Use consistent spacing between buttons (me-2 for margin-end)

## Files Already Updated

- ✅ `src/app/pages/insighter-dashboard/insighter-dashboard/my-meetings/my-meetings.component.html`
- ✅ `src/app/pages/insighter-dashboard/insighter-dashboard/my-meetings/sent-meetings/sent-meetings.component.html`

## Files That Need Updates

To maintain consistency, update modal buttons in these files:
- `src/app/pages/insighter-dashboard/insighter-dashboard/wallet/wallet.component.html`
- `src/app/pages/setup-payment-info/manual-account/manual-account.component.html`