import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Observable } from 'rxjs';
import { Order } from '../../my-orders.service';
import * as OrderViewUtils from '../../utils/order-view.utils';

type Language = 'ar' | 'en';


@Component({
  selector: 'app-knowledge-orders',
  templateUrl: './knowledge-orders.component.html',
  styleUrls: ['./knowledge-orders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KnowledgeOrdersComponent {
  @Input() lang: Language = 'en';
  @Input() orders$!: Observable<Order[]>;
  @Input() totalPages$!: Observable<number>;
  @Input() currentPage = 1;
  @Input() isLoading$!: Observable<boolean>;
  @Input() clientBaseUrl: string = 'https://insightabusiness.com';


  @Output() pageChange = new EventEmitter<number>();
  @Output() orderSelected = new EventEmitter<Order>();
  @Output() invoiceDownload = new EventEmitter<Order>();
  @Output() navigateToDownloads = new EventEmitter<Order>();
  @Output() copyOrderNo = new EventEmitter<string>();

  readonly utils = OrderViewUtils;


  onKnowledgePageChange(event: any): void {
    const nextPage = (event.page || 0) + 1;
    this.pageChange.emit(nextPage);
  }


  selectOrder(order: Order): void {
    this.orderSelected.emit(order);
  }

  downloadInvoice(order: Order): void {
    this.invoiceDownload.emit(order);
  }

  openDownloads(order: Order): void {
    this.navigateToDownloads.emit(order);
  }

  copyOrder(orderNo: string): void {
    this.copyOrderNo.emit(orderNo);
  }

  getInsighterInitials(insighter: any): string {
    return (insighter.name?.split(' ')[0]?.charAt(0) || '') + (insighter.name?.split(' ')[1]?.charAt(0) || '');
  }

}
