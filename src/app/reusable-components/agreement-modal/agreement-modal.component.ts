import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, Injector, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { GuidelinesService, GuidelineDetail } from '../../_fake/services/guidelines/guidelines.service';
import { BaseComponent } from 'src/app/modules/base.component';

@Component({
  selector: 'app-agreement-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, ProgressSpinnerModule],
  template: `
<p-dialog
  [(visible)]="visible"
  [modal]="true"
  [closable]="false"
  [draggable]="false"
  appendTo="body"
  [resizable]="false"
  [dismissableMask]="false"
  [style]="{ width: '85vw', maxWidth: '1000px' }"
  [contentStyle]="{ padding: '0' }"
  [breakpoints]="{ '1200px': '85vw', '992px': '90vw', '768px': '95vw', '576px': '98vw' }"
  [baseZIndex]="10000"
  [blockScroll]="true"
  [focusOnShow]="false"
  [keepInViewport]="true"
  [showHeader]="true"
>
  <ng-template pTemplate="header">
    <div class="d-flex justify-content-between align-items-center w-100">
      <h5 class="m-0">{{ agreementTitle || agreement?.name || 'Agreement' }}</h5>
      <div class="d-flex">
        <button class="btn btn-sm btn-icon" (click)="printTerms()">
          <i class="ki-outline ki-printer fs-3"></i>
        </button>
      </div>
    </div>
  </ng-template>

  <ng-template pTemplate="default">
    <div class="agreement-container" [class.loading]="loading">
      <div class="loading-overlay" *ngIf="loading">
      <span class="spinner-border spinner-border-sm align-middle ms-2"></span>
      </div>

      <div class="error-banner" *ngIf="loadError">
        {{ loadError }}
      </div>

      <div class="apply-at-note" *ngIf="agreement?.apply_at">
        <i class="ki-duotone ki-information-2 note-icon"></i>
        <span>
          {{ lang === 'ar' ? 'سيتم تطبيق هذه الشروط الجديدة بتاريخ' : 'These new conditions will be applied on' }}
          {{ agreement?.apply_at | date:'longDate' }}
        </span>
       <br>
       <span>
        {{lang ==='ar' ? 'تجنب ايقاف الحساب بالموافقة على هذه الشروط' : 'Avoid account suspension by accepting these conditions'}}
       </span>
      </div>

      <div
        #content
        class="agreement-content"
        [dir]="lang === 'ar' ? 'rtl' : 'ltr'"
        [innerHTML]="agreementHtml"
        (scroll)="onContentScroll()"
      ></div>
    </div>
  </ng-template>

  <ng-template pTemplate="footer">
    <div class="footer-actions">
      <button
        pButton
        type="button"
        class="p-button-text"
        label="{{lang === 'ar' ?  'التجاوز حالياً' : 'Skip for now'}}"
        (click)="onCancel()"
        [disabled]="submitting"
      ></button>
      <button
        pButton
        type="button"
        label="{{lang === 'ar' ? 'موافق' : 'Accept'}}"
        (click)="onAccept()"
        [disabled]="loading || submitting || !(acceptAgreementUuid || agreement?.uuid) || !canAccept"
      >
        <span class="p-button-label">{{lang === 'ar' ? 'موافق' : 'Accept'}}</span>
        <span class="btn-spinner" *ngIf="submitting">
          <span class="spinner-border spinner-border-sm align-middle ms-2"></span>
        </span>
      </button>
    </div>
    <div class="submit-error" *ngIf="submitError">{{ submitError }}</div>
  </ng-template>
</p-dialog>
  `,
  styles: [`
:host {
  display: block;
}

.agreement-container {
  position: relative;
  max-height: 70vh;
  overflow: hidden;
}

.agreement-content {
  padding: 1.25rem 1.25rem 0 1.25rem;
  height: 70vh;
  overflow: auto;
}

/* Gentle spacing inside rich text */
.agreement-content h1,
.agreement-content h2,
.agreement-content h3 {
  margin-top: 1rem !important;
  margin-bottom: 0.5rem !important;
}
.agreement-content p {
  margin: 0.5rem 0 !important;
}
.agreement-content h1 + p,
.agreement-content h2 + p,
.agreement-content h3 + p {
  margin-top: 0.5rem !important;
}
.agreement-content hr {
  margin: 1rem 0 !important;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.6);
  z-index: 2;
}

.error-banner,
.submit-error {
  color: #842029;
  background-color: #f8d7da;
  border: 1px solid #f5c2c7;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin: 0 1.25rem 0.75rem 1.25rem;
}

.apply-at-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.75rem 1.25rem 0.5rem 1.25rem;
  color: #0c5460;
  background-color: #d1ecf1;
  border: 1px solid #bee5eb;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
}
.apply-at-note .note-icon {
  font-size: 1.1rem;
}

.footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0 0.5rem 0.5rem 0.5rem;
}

.btn-spinner {
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
}

.btn-spinner-size ::ng-deep svg {
  width: 16px !important;
  height: 16px !important;
}
  `],
})
export class AgreementModalComponent extends BaseComponent  implements OnChanges {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  /** Optional custom dialog title; defaults to agreement name */
  @Input() agreementTitle?: string;

  /** Agreement type to fetch from API */
  @Input() agreementType: string = 'insighter_agreement';

  /** Optional role(s) to derive agreement type when not explicitly provided */
  @Input() role?: string | string[];
  /** Optional account type to derive agreement type when not explicitly provided */
  @Input() accountType?: string;

  /** UUID to use for the accept endpoint */
  @Input() acceptAgreementUuid: string = '';

  /** Emitted after successful accept API call */
  @Output() accepted = new EventEmitter<void>();
  /** Emitted when user cancels/closes */
  @Output() cancelled = new EventEmitter<void>();
  /** Emitted on load/accept errors with message */
  @Output() error = new EventEmitter<string>();

  loading: boolean = false;
  submitting: boolean = false;
  loadError?: string;
  submitError?: string;

  agreement?: GuidelineDetail;
  agreementHtml?: SafeHtml;

  @ViewChild('content') contentRef?: ElementRef<HTMLElement>;
  /** Whether user can press accept (enabled after reaching bottom or no scroll needed) */
  canAccept: boolean = false;

  constructor(
    injector: Injector,
    private guidelinesService: GuidelinesService,
    private sanitizer: DomSanitizer,
    private http: HttpClient
  ) {
    super(injector);
  }

  ngOnChanges(changes: SimpleChanges): void {
    const visibleChanged = !!changes['visible'];
    const roleChanged = !!changes['role'];
    const accountTypeChanged = !!changes['accountType'];
    if ((visibleChanged && this.visible) || ((roleChanged || accountTypeChanged) && this.visible)) {
      this.canAccept = false;
      this.fetchAgreement();
    }
  }

  private fetchAgreement(): void {
    this.loading = true;
    this.loadError = undefined;
    const typeToFetch = this.computeAgreementType();
    this.guidelinesService
      .getLastGuidelineByType(typeToFetch)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data) => {
          this.agreement = data;
          this.agreementHtml = this.sanitizer.bypassSecurityTrustHtml(
            data.guideline || ''
          );
          // Wait for view to render the content, then evaluate scroll position
          setTimeout(() => this.updateCanAccept());
        },
        error: (err) => {
          const message =
            (err && (err.message || err.statusText)) ||
            'Failed to load agreement. Please try again.';
          this.loadError = message;
          this.error.emit(message);
        },
      });
  }

  private computeAgreementType(): string {
    return this.agreementType
  }

  onCancel(): void {
    this.cancelled.emit();
    this.close();
  }

  onContentScroll(): void {
    if (this.canAccept) return;
    const el = this.contentRef?.nativeElement;
    if (!el) return;
    if (this.isScrolledToBottom(el)) {
      this.canAccept = true;
    }
  }

  onAccept(): void {
    if (this.submitting) return;
    this.submitting = true;
    this.submitError = undefined;
    const finalUuid = this.acceptAgreementUuid || this.agreement?.uuid;
    if (!finalUuid) {
      this.submitError = 'Failed to accept agreement. Please try again.';
      this.submitting = false;
      return;
    }
    const url = `https://api.insightabusiness.com/api/account/agreement/accept/${finalUuid}`;
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Accept-Language': this.lang,
    });

    this.http
      .put(url, {}, { headers })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.accepted.emit();
          this.close();
        },
        error: (err) => {
          const message =
            (err && (err.error?.message || err.message || err.statusText)) ||
            'Failed to accept agreement. Please try again.';
          this.submitError = message;
          this.error.emit(message);
        },
      });
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  printTerms(): void {
    const printContent = `
      <html>
        <head>
          <title>${this.agreementTitle || this.agreement?.name || 'Agreement'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1, h2, h3 { margin-top: 1rem; margin-bottom: 0.5rem; }
            p { margin: 0.5rem 0; }
            hr { margin: 1rem 0; }
          </style>
        </head>
        <body>
          <h1>${this.agreementTitle || this.agreement?.name || 'Agreement'}</h1>
          ${this.agreement?.guideline || ''}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateCanAccept();
  }

  private updateCanAccept(): void {
    const el = this.contentRef?.nativeElement;
    if (!el) {
      this.canAccept = false;
      return;
    }
    // Enable accept if content fits without scrolling, otherwise require bottom reach
    const fitsWithoutScroll = el.scrollHeight <= el.clientHeight + 1;
    this.canAccept = fitsWithoutScroll || this.isScrolledToBottom(el);
  }

  private isScrolledToBottom(el: HTMLElement): boolean {
    const threshold = 2; // px tolerance
    return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  }
}

