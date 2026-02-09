import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Order, PaymentInfo } from '../../my-orders.service';
import * as OrderViewUtils from '../../utils/order-view.utils';

type Language = 'ar' | 'en';

@Component({
  selector: 'app-order-details-dialog',
  templateUrl: './order-details-dialog.component.html',
  styleUrls: ['./order-details-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailsDialogComponent {
  @Input() lang: Language = 'en';
  @Input() order: Order | null = null;
  @Input() clientBaseUrl: string = 'https://foresighta.co';

  private _visible = false;

  @Input()
  set visible(value: boolean) {
    this._visible = value;
  }
  get visible(): boolean {
    return this._visible;
  }

  @Output() visibleChange = new EventEmitter<boolean>();

  readonly utils = OrderViewUtils;

  constructor(private readonly sanitizer: DomSanitizer) {}

  onVisibleChange(value: boolean): void {
    if (this._visible !== value) {
      this._visible = value;
    }
    this.visibleChange.emit(value);
  }

  cardLogoSvg(payment: PaymentInfo | null | undefined): SafeHtml {
    const svgContent = this.utils.getCardLogoSvgContent(payment || null);
    return this.sanitizer.bypassSecurityTrustHtml(svgContent);
  }

  getUserInitials(user: any): string {
    // First try first_name and last_name if available
    if (user?.first_name && user?.last_name) {
      return (user.first_name.charAt(0) + user.last_name.charAt(0)).toUpperCase();
    }
    // Fall back to name field if available
    if (user?.name) {
      const nameParts = user.name.trim().split(' ');
      if (nameParts.length >= 2) {
        return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
      } else {
        return nameParts[0].charAt(0).toUpperCase();
      }
    }
    return '';
  }

  getInsighterInitials(insighter: any): string {
    if (!insighter?.name) {
      return '';
    }
    const nameParts = insighter.name.trim().split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
    } else {
      return nameParts[0].charAt(0).toUpperCase();
    }
  }
}
