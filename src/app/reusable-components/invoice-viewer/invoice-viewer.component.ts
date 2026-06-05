import { Component, Input, OnInit, OnDestroy, Injector, HostListener } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';

export interface InvoiceData {
  order_no: string;
  invoice_no?: string;
  date: string;
  amount: number;
  service: string;
  orderable: any;
  userProfile?: {
    name?: string;
    email?: string;
    country?: string;
    first_name?: string;
    last_name?: string;
  };
  billingAddress?: {
    city?: string;
    country?: string;
    line1?: string;
    line2?: string;
    postal_code?: string;
    state?: string;
  } | string | null;
}

@Component({
  selector: 'app-invoice-viewer',
  templateUrl: './invoice-viewer.component.html',
  styleUrls: ['./invoice-viewer.component.scss']
})
export class InvoiceViewerComponent extends BaseComponent implements OnInit, OnDestroy {
  @Input() invoiceData!: InvoiceData;

  invoiceDate = '';
  serviceRows: Array<{name: string, amount: number}> = [];
  subtotal = 0;
  isMeetingOrder = false;
  isProjectOrder = false;
  projectTitle = '';
  projectNo = '';
  meetingTitle = '';
  meetingDetails: Array<{label: string, value: string}> = [];
  knowledgePackages: Array<{title: string, documents: any[], totalPrice: number}> = [];

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.processInvoiceData();
  }

  ngOnDestroy(): void {
    // Clean up any listeners if needed
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Handle Ctrl+P (or Cmd+P on Mac) to trigger print
    if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
      event.preventDefault();
      this.printOrSaveAsPDF();
    }
  }

  private processInvoiceData(): void {
    if (!this.invoiceData) return;

    // Format invoice date
    this.invoiceDate = new Date(this.invoiceData.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });

    // Process service items
    this.isMeetingOrder = this.invoiceData.service === 'meeting_service';
    this.isProjectOrder = this.invoiceData.service === 'project_service';
    this.serviceRows = [];
    this.subtotal = this.invoiceData.amount;

    if (this.isMeetingOrder) {
      // Handle meeting orders
      const orderable = this.invoiceData.orderable;
      if (orderable?.meeting_booking) {
        const meeting = orderable.meeting_booking;
        this.meetingTitle = `Meeting: ${meeting.title}`;
        this.meetingDetails = [
          { label: '📅 Date: ' + meeting.date, value: '-' },
          { label: '⏰ Time: ' + meeting.start_time + ' - ' + meeting.end_time, value: '-' }
        ];
        this.serviceRows.push({
          name: `Meeting: ${meeting.title} - ${meeting.date} (${meeting.start_time} - ${meeting.end_time})`,
          amount: this.invoiceData.amount
        });
      }
    } else if (this.isProjectOrder) {
      const project = this.invoiceData.orderable?.project;
      this.projectTitle = project?.title || this.invoiceData.order_no;
      this.projectNo = project?.project_no || '';
      this.serviceRows.push({
        name: this.projectNo ? `${this.projectTitle} (${this.projectNo})` : this.projectTitle,
        amount: this.invoiceData.amount
      });
    } else {
      // Handle knowledge orders - Group by knowledge package
      const knowledgePackagesMap = new Map<string, {documents: any[], totalPrice: number}>();
      this.subtotal = 0;

      // Get the main knowledge title from the order
      const knowledgeTitle = this.invoiceData.orderable?.knowledge?.[0]?.title || 'Knowledge Package';

      if (this.invoiceData.orderable?.knowledge_documents) {
        // Group all documents under the main knowledge title
        if (!knowledgePackagesMap.has(knowledgeTitle)) {
          knowledgePackagesMap.set(knowledgeTitle, {documents: [], totalPrice: 0});
        }

        const pkg = knowledgePackagesMap.get(knowledgeTitle)!;

        this.invoiceData.orderable.knowledge_documents.forEach((docGroup: any[]) => {
          docGroup.forEach((doc: any) => {
            pkg.documents.push(doc);
            pkg.totalPrice += doc.price;
            this.subtotal += doc.price;
            this.serviceRows.push({
              name: doc.file_name,
              amount: doc.price
            });
          });
        });
      }

      // Convert map to array for template
      this.knowledgePackages = Array.from(knowledgePackagesMap.entries()).map(([title, pkg]) => ({
        title,
        documents: pkg.documents,
        totalPrice: pkg.totalPrice
      }));
    }
  }

  printOrSaveAsPDF(): void {
    console.log('Print button clicked!'); // Debug log

    try {
      // Add temporary print styles to hide navigation
      this.addPrintStyles();

      // First try to focus the window
      window.focus();

      // Small delay to ensure focus, then trigger print
      setTimeout(() => {
        console.log('Triggering print dialog...'); // Debug log
        if (window.print) {
          window.print();
        } else {
          // Fallback for older browsers
          document.execCommand('print', false, undefined);
        }
      }, 250);

      this.showInfo(
        this.lang === 'ar' ? 'طباعة أو حفظ كـ PDF' : 'Print or Save PDF',
        this.lang === 'ar' ? 'استخدم نافذة الطباعة للطباعة أو اختر "حفظ كـ PDF"' : 'Use the print dialog to print or select "Save as PDF"'
      );
    } catch (error) {
      console.error('Print error:', error);
      this.showError(
        this.lang === 'ar' ? 'خطأ في الطباعة' : 'Print Error',
        this.lang === 'ar' ? 'فشل في فتح نافذة الطباعة' : 'Failed to open print dialog'
      );
    }
  }

  private addPrintStyles(): void {
    // Remove any existing print styles
    const existingStyle = document.getElementById('invoice-print-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create and inject print styles
    const style = document.createElement('style');
    style.id = 'invoice-print-styles';
    style.type = 'text/css';
    style.innerHTML = `
      @page {
        margin: 8mm 8mm 8mm 8mm !important;
        size: A4 !important;
      }

      @media print {
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Hide navigation and layout elements */
        .kt_header,
        .kt_toolbar,
        .kt_aside,
        .kt_footer,
        .kt_app_header,
        .kt_app_toolbar,
        .kt_app_aside,
        .kt_app_footer,
        .primeng-header,
        .p-toolbar,
        .navbar,
        .toolbar,
        .sidebar,
        .menu,
        .navigation,
        .app-header,
        .app-toolbar,
        .app-sidebar,
        .app-nav,
        .breadcrumb,
        .page-header,
        .no-print,
        nav,
        header:not(.header-cell) {
          display: none !important;
        }

        /* Remove browser default margins and padding */
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          height: 100% !important;
          overflow: visible !important;
          font-family: Arial, Helvetica, sans-serif !important;
        }

        /* Ensure Angular app root is visible */
        app-root {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Ensure router outlet content is visible */
        router-outlet + * {
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Ensure invoice page component is visible */
        app-invoice-page {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Ensure invoice viewer is visible */
        app-invoice-viewer {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Invoice container styling */
        .invoice-viewer-container {
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
          padding: 0 !important;
          margin: 0 !important;
          background: white !important;
          width: 100% !important;
          height: auto !important;
          min-height: 100vh !important;
        }

        .page, .invoice-container {
          display: flex !important;
          flex-direction: column !important;
          width: 100% !important;
          height: auto !important;
          min-height: auto !important;
          background: white !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          padding-top: 2mm !important;
          overflow: visible !important;
        }

        /* Prevent page breaks within important sections */
        .layout,
        .header-cell,
        .content-cell,
        .logo-table,
        .billing-table,
        .services,
        .totals,
        .footer-invoice {
          page-break-inside: avoid !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  private getInvoiceStyles(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: Arial, Helvetica, sans-serif;
        background: white;
      }

      .invoice-container {
        background: white;
        width: 190mm;
        height: 277mm;
        margin: 0 auto;
        position: relative;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .header {
        background: linear-gradient(90deg, #042043 0%, #57B6C7 100%);
        padding: 25px;
        position: relative;
        overflow: hidden;
      }

      .header h1 {
        color: white;
        font-size: 36px;
        text-align: center;
        font-weight: 600;
        position: relative;
        z-index: 1;
        margin: 0;
      }

      .content {
        padding: 40px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .logo-section {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 40px;
      }

      .logo {
        width: 160px;
      }

      .invoice-info {
        text-align: right;
        color: #666;
        font-size: 13px;
        line-height: 1.6;
      }

      .billing-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 40px;
        gap: 60px;
      }

      .from-section, .bill-to-section {
        flex: 1;
      }

      .section-title {
        font-size: 18px;
        font-weight: 600;
        color: #042043;
        margin-bottom: 15px;
      }

      .from-section p, .bill-to-section p {
        color: #333;
        line-height: 1.6;
        font-size: 14px;
      }

      .bill-to-section .label {
        display: inline-block;
        font-weight: 600;
        color: #042043;
        min-width: 80px;
      }

      .services-table {
        margin-bottom: 40px;
      }

      .table-header {
        display: flex;
        justify-content: space-between;
        padding: 15px 0;
        border-bottom: 2px solid #e0e0e0;
        margin-bottom: 20px;
      }

      .table-header h3 {
        font-size: 18px;
        font-weight: 600;
        color: #042043;
      }

      .service-row {
        display: flex;
        justify-content: space-between;
        padding: 15px 0;
        border-bottom: 1px solid #f0f0f0;
      }

      .service-name {
        color: #333;
        font-size: 15px;
      }

      .service-amount {
        color: #333;
        font-size: 15px;
      }

      .totals-section {
        margin-top: 40px;
        margin-bottom: 40px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 15px;
      }

      .subtotal, .total {
        display: flex;
        align-items: center;
        gap: 30px;
        font-size: 18px;
      }

      .subtotal {
        color: #666;
      }

      .total {
        font-weight: 600;
        color: #042043;
      }

      .total .amount {
        background: linear-gradient(90deg, #042043 0%, #57B6C7 100%);
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        min-width: 120px;
        text-align: center;
      }

      .footer {
        padding: 30px;
        text-align: center;
        color: #999;
        font-size: 14px;
        border-top: 1px solid #f0f0f0;
      }

      .bg {
        background-image: url(https://res.cloudinary.com/dsiku9ipv/image/upload/v1758005640/invoice_template_knoldg_0_1_naflvj.png);
        position: absolute;
        top: 130px;
        left: 50%;
        transform: translate(-50%, -50%);
        background-repeat: no-repeat;
        z-index: 10;
        background-position: center;
        height: 100%;
        width: 680px;
        opacity: 0.1;
      }
    `;
  }

  getDisplayName(): string {
    if (!this.invoiceData?.userProfile) return 'Client Name';

    const profile = this.invoiceData.userProfile;

    // If first_name and last_name are available, use them
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }

    // Fallback to name if available
    if (profile.name) {
      return profile.name;
    }

    return 'Client Name';
  }

  getDisplayAddress(): string {
    if (!this.invoiceData?.userProfile && !this.invoiceData?.billingAddress) {
      return 'N/A';
    }

    if (this.invoiceData.billingAddress) {
      return this.formatBillingAddress(this.invoiceData.billingAddress);
    }

    // For sold orders, use the country from user profile
    if (this.invoiceData.userProfile?.country) {
      return this.invoiceData.userProfile.country;
    }

    return 'N/A';
  }

  formatBillingAddress(billingAddress: any): string {
    if (!billingAddress) return '';

    // If billing address is a string, return it directly
    if (typeof billingAddress === 'string') {
      return billingAddress;
    }

    // If it's an object, format it
    const parts = [];
    if (billingAddress.line1) parts.push(billingAddress.line1);
    if (billingAddress.line2) parts.push(billingAddress.line2);
    if (billingAddress.city) parts.push(billingAddress.city);
    if (billingAddress.state) parts.push(billingAddress.state);
    if (billingAddress.postal_code) parts.push(billingAddress.postal_code);
    if (billingAddress.country) parts.push(billingAddress.country);

    return parts.filter(part => part).join(', ');
  }
}
