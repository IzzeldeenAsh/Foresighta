import { environment } from '../../../../../../environments/environment';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Observable } from 'rxjs';
import { Order } from '../../my-orders/my-orders.service';
import * as OrderViewUtils from '../../my-orders/utils/order-view.utils';

type Language = 'ar' | 'en';

@Component({
  selector: 'app-sold-meeting-details',
  templateUrl: './sold-meeting-details.component.html',
  styleUrls: ['./sold-meeting-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoldMeetingDetailsComponent {
  env = environment;
  @Input() lang: Language = 'en';
  @Input() meetingSalesOrders$!: Observable<Order[]>;
  @Input() meetingSalesTotalPages$!: Observable<number>;
  @Input() currentMeetingSalesPage = 1;
  @Input() isMeetingSalesLoading$!: Observable<boolean>;
  @Input() selectedInsighterUuid: string | null = null;
  @Input() roles: string[] = [];

  @Output() meetingSalesPageChange = new EventEmitter<number>();
  @Output() orderSelected = new EventEmitter<Order>();
  @Output() invoiceDownload = new EventEmitter<Order>();
  @Output() copyOrderNo = new EventEmitter<string>();
  @Output() insighterFilterChange = new EventEmitter<string | null>();

  readonly utils = OrderViewUtils;

  get shouldShowInsighterFilter(): boolean {
    return this.roles.includes('company');
  }

  onMeetingSalesPageChange(event: any): void {
    const nextPage = (event.page || 0) + 1;
    this.meetingSalesPageChange.emit(nextPage);
  }

  selectOrder(order: Order): void {
    this.orderSelected.emit(order);
  }

  downloadInvoice(order: Order): void {
    this.invoiceDownload.emit(order);
  }

  copyOrder(orderNo: string): void {
    this.copyOrderNo.emit(orderNo);
  }

  onInsighterFilterChange(insighterUuid: string | null): void {
    this.insighterFilterChange.emit(insighterUuid);
  }
}