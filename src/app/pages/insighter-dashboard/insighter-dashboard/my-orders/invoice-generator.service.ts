import { Injectable } from '@angular/core';
import { Order, KnowledgeDocument } from './my-orders.service';

@Injectable({
  providedIn: 'root'
})
export class InvoiceGeneratorService {

  constructor() { }

  generateInvoice(order: Order, userProfile: any, billingAddress?: any): string {
    console.log('Order', order)
    const invoiceDate = new Date(order.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });

    // Check if this is a meeting order or knowledge order
    const isMeetingOrder = order.service === 'meeting_service';
    let serviceRows = '';
    let subtotal = order.amount;

    if (isMeetingOrder) {
      // Handle meeting orders
      if (order.orderable?.meeting_booking) {
        const meeting = order.orderable.meeting_booking;
        serviceRows = `
          <tr>
            <td class="meeting-item" style="padding-top:8px;">Meeting: ${meeting.title}</td>
            <td class="amount" style="padding-top:8px;"></td>
          </tr>
          <tr>
            <td class="sub-item">
              &nbsp;&nbsp;&nbsp;&nbsp;• 📅 Date: ${meeting.date}
            </td>
            <td class="amount">-</td>
          </tr>
          <tr>
            <td class="sub-item">
              &nbsp;&nbsp;&nbsp;&nbsp;• ⏰ Time: ${meeting.start_time} - ${meeting.end_time}
            </td>
            <td class="amount">$${order.amount.toFixed(2)}</td>
          </tr>
        `;
      }
    } else {
      // Handle knowledge orders - Group by knowledge package
      const knowledgePackages = new Map<string, {documents: KnowledgeDocument[], totalPrice: number}>();
      subtotal = 0;

      // Get the main knowledge title from the order
      const knowledgeTitle = order.orderable?.knowledge?.[0]?.title || 'Knowledge Package';

      if (order.orderable?.knowledge_documents) {
        // Group all documents under the main knowledge title
        if (!knowledgePackages.has(knowledgeTitle)) {
          knowledgePackages.set(knowledgeTitle, {documents: [], totalPrice: 0});
        }

        const pkg = knowledgePackages.get(knowledgeTitle)!;

        order.orderable.knowledge_documents.forEach(docGroup => {
          docGroup.forEach((doc: KnowledgeDocument) => {
            pkg.documents.push(doc);
            pkg.totalPrice += doc.price;
            subtotal += doc.price;
          });
        });
      }

      // Generate table rows for knowledge packages and their documents
      let rows = '';
      knowledgePackages.forEach((pkg, title) => {
        // Main knowledge package row
        rows += `
          <tr>
            <td class="knowledge-item" style="padding-top:8px;">${title}</td>
            <td class="amount" style="padding-top:8px;"></td>
          </tr>
        `;

        // Sub-items for each document
        pkg.documents.forEach(doc => {
          rows += `
            <tr>
              <td class="sub-item">
                &nbsp;&nbsp;&nbsp;&nbsp;• 📄 ${doc.file_name}
              </td>
              <td class="amount">$${doc.price.toFixed(2)}</td>
            </tr>
          `;
        });
      });

      serviceRows = rows;
    }

    return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="utf-8"/>
    <title>Invoice - Insighta Business</title>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>
        @page {
            size: A4;
            margin: 15mm 10mm 10mm 10mm;
        }

        /* Reset */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            color: #333;
            background: #fff;
        }

        /* Page container sized to A4 printable area (210mm - 2*10mm = 190mm width) */
        .page {
            width: 190mm;
            height: 277mm; /* 297mm - 15mm top - 10mm bottom = 272mm */
            margin: 0 auto;
            position: relative;
            background: #fff;
            overflow: visible; /* Allow content to flow */
            padding: 2mm 0; /* Minimal padding */
        }

        .bg {
            background-image: url(https://res.cloudinary.com/dsiku9ipv/image/upload/v1758005640/invoice_template_knoldg_0_1_naflvj.png);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-repeat: no-repeat;
            z-index: 10;
            background-position: center;
            height: 90%;
            width: 650px;
            opacity: 0.04;
        }

        /* Main layout table (keeps header, body, footer in place reliably) */
        .layout {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
            font-size: 13px;
            z-index: 1; /* above watermark */
        }

        /* Header */
        .header-cell {
            background-color: #2C74B3; /* fallback color (gradients sometimes fail in dompdf) */
            /* Attempt gradient (dompdf may ignore it) but fallback will display */
            background-image: linear-gradient(90deg, #2C74B3 0%, #57B6C7 100%);

            color: #fff;
            text-align: center;
            padding: 14px 10px;
        }

        .header-title {
            font-size: 32px;
            font-weight: 600;
        }

        /* Content area */
        .content-cell {
            padding: 15px;
            vertical-align: top;
        }

        /* Logo + invoice info row */
        .logo-table {
            margin-top: 8px;
            width: 100%;
            border-collapse: collapse;
        }

        .logo-left {
            width: 60%;
            vertical-align: top;
        }

        .logo-right {
            width: 40%;
            text-align: right;
            vertical-align: top;
            font-size: 13px;
            color: #666;
        }

        .logo-img {
            width: 150px;
            display: block;
            margin-bottom: 6px;
        }

        /* Billing two-column table */
        .billing-table {
            width: 100%;
            margin-top: 10px;
            border-collapse: collapse;
        }

        .billing-table td {
            vertical-align: top;
            padding: 3px 0;
            font-size: 13px;
            color: #333;
        }

        /* Services table (simple, works in dompdf) */
        .services {
            width: 100%;
            border-collapse: collapse;
            margin-top: 25px;
        }

        .services th, .services td {
            padding: 5px 6px;
            font-size: 13px;
        }

        .services th {
            text-align: left;
            border-bottom: 2px solid #2C74B3;
        }

        .services td.amount {
            text-align: right;
        }

        .sub-item {
            padding-left: 40px;
            font-size: 12px;
            color: #666;
            padding-top: 1px;
            padding-bottom: 3px;
            background-color: #f8f9fa;
        }

        .knowledge-item {
            font-weight: 600;
            color: #2C74B3;
        }

        .meeting-item {
            font-weight: 600;
            color: #2C74B3;
        }

        .totals {
            width: auto; /* shrink to content */
            margin-left: auto; /* push to right */
            border-collapse: collapse;
            margin-top: 8px;
        }

        .totals td {
            padding: 4px 8px;
            font-size: 14px;
            text-align: right;
        }

        .totals .label {
            color: #666;
            white-space: nowrap;
        }

        .totals .value {
            font-weight: 600;
            color: #2C74B3;
        }

        .totals .total-badge {
            background: #2C74B3;
            color: #fff;
            padding: 6px 12px;
            border-radius: 4px;
            display: inline-block;
            min-width: 80px;
            text-align: center;
        }

        /* Small helpers */
        .section-title {
            color: #2C74B3;
            font-weight: 700;
            margin-bottom: 6px;
            display: inline-block;
            font-size: 14px;
        }

        /* Footer (kept in its own bottom row so it always sits at page bottom) */
        .footer {
            position: absolute;
            bottom: 5mm;
            left: 10mm;
            right: 10mm;
            text-align: center;
            font-size: 11px;
            color: #999;
            padding-top: 6px;
            border-top: 1px solid #eee;
        }
    </style>
    <script>
      (function () {
        function triggerPrint() {
          try {
            window.focus();
            window.print();
          } catch (e) {
            // Fallback retry for Chrome timing quirks
            setTimeout(function () {
              try {
                window.focus();
                window.print();
              } catch (_) {}
            }, 300);
          }
        }
        if (document.readyState === 'complete') {
          setTimeout(triggerPrint, 100);
        } else {
          window.addEventListener('load', function () {
            setTimeout(triggerPrint, 100);
          });
        }
      })();
    </script>
</head>
<body>
<div class="page">
    <div class="bg"></div>

    <!-- main layout (table ensures consistent placement in Dompdf) -->
    <table class="layout" cellpadding="0" cellspacing="0">
        <!-- Header row -->
        <tr>
            <td class="header-cell" style="height:70px;">
                <div class="header-title">INVOICE</div>
            </td>
        </tr>

        <!-- Content row -->
        <tr>
            <td class="content-cell">
                <!-- Logo + invoice info -->
                <table class="logo-table">
                    <tr>
                        <td class="logo-left">
                            <img src="https://res.cloudinary.com/dsiku9ipv/image/upload/v1762151385/KNOLDG-01_tuepia.png"
                                 alt="Insighta Logo" class="logo-img"/>
                        </td>
                        <td class="logo-right">
                            <div>${order.invoice_no || order.order_no}</div>
                            <div style="margin-top:6px;">${invoiceDate}</div>
                        </td>
                    </tr>
                </table>

                <!-- Billing (two columns) -->
                <table class="billing-table" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="width:70%; padding-right:10px;">
                            <div class="section-title">From:</div>
                            <div style="margin-top:6px;">
                                Foresighta Systems Consulting FZ-LLC,<br/>
                                Compass Building Al Shohada Road,<br/>
                                AL Hamra Industrial Zone-FZ,<br/>
                                Ras Al Khaimah United Arab Emirates,<br/>
                                info@insightabusiness.com.<br/>
                            </div>
                        </td>

                        <td style="width:30%; text-align:left; padding-left:10px;">
                            <div class="section-title">Bill To:</div>
                            <div style="margin-top:6px; text-align:left;">
                                <strong>Name:</strong>${this.getDisplayName(userProfile, order)}<br/>
                                <strong>Email:</strong>${this.getDisplayEmail(userProfile, order)}<br/>
                                <strong>Address:</strong> ${this.getDisplayAddress(userProfile, order)}
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- Services table -->
                <table class="services" cellpadding="0" cellspacing="0">
                    <thead>
                    <tr>
                        <th style="width:70%;">${isMeetingOrder ? 'Meeting Service' : 'Insight'}</th>
                        <th style="width:30%; text-align:right;">Amount</th>
                    </tr>
                    </thead>
                    <tbody>
                        ${serviceRows}
                    </tbody>
                </table>

                <!-- Totals -->
                <table class="totals" cellpadding="0" cellspacing="0">
                    <tr>
                        <td class="label" style="font-weight:600; color:#2C74B3;">Total:</td>
                        <td class="value">
                            <span class="total-badge">$${order.amount.toFixed(2)}</span>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>

        <!-- Footer row (kept at bottom by table rows) -->

    </table>

    <div class="footer">
        Thank you for your business © 2026 Insighta | info@insightabusiness.com
    </div>

</div>
</body>
</html>`;
  }

  downloadInvoiceAsPDF(htmlContent: string, filename: string): void {
    // Create a new window for PDF generation
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      // Printing is auto-triggered by the injected script inside the HTML
      // Keep a light fallback in case load event fires before script attaches
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {}
      }, 800);
    }
  }

  openInvoiceInNewTab(htmlContent: string): void {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      newWindow.onload = () => {
        // Printing is auto-triggered by the injected script inside the HTML
        window.URL.revokeObjectURL(url);
      };
    }
  }

  private getDisplayName(userProfile: any, order: Order): string {
    // For purchased orders (my orders), use current user profile
    // For sold orders, use the buyer's information
    if (order.user) {
      // This is a sold order, use buyer's info
      if (order.user.first_name && order.user.last_name) {
        return `${order.user.first_name} ${order.user.last_name}`;
      }
      return order.user.name || 'Client Name';
    } else {
      // This is a purchased order, use current user's info
      if (userProfile?.first_name && userProfile?.last_name) {
        return `${userProfile.first_name} ${userProfile.last_name}`;
      }
      return userProfile?.name || 'Client Name';
    }
  }

  private getDisplayEmail(userProfile: any, order: Order): string {
    // For sold orders, use buyer's email; for purchased orders, use current user's email
    if (order.user) {
      return order.user.email || 'client@email.com';
    } else {
      return userProfile?.email || 'client@email.com';
    }
  }

  private getDisplayAddress(userProfile: any, order: Order): string {
    // For sold orders, use billing address from payment
    if (order.user && order.payment?.billing_address) {
      return this.formatBillingAddress(order.payment.billing_address);
    }

    // For purchased orders, use billing address if available, otherwise user's country
    if (order.payment?.billing_address) {
      return this.formatBillingAddress(order.payment.billing_address);
    }

    // Fallback to user's country
    const country = order.user?.country || userProfile?.country;
    return country || 'N/A';
  }

  private formatBillingAddress(billingAddress: any): string {
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