import { KnowledgeDocument, Orderable, Order, PaymentInfo } from '../my-orders.service';

type Language = 'ar' | 'en';

type OrderPaymentFields = Pick<Order, 'payment' | 'payments' | 'invoice_no'>;

export function getOrderPayments(order: OrderPaymentFields | null | undefined): PaymentInfo[] {
  if (!order) {
    return [];
  }

  if (Array.isArray(order.payments) && order.payments.length > 0) {
    return order.payments.filter((payment): payment is PaymentInfo => Boolean(payment));
  }

  return order.payment ? [order.payment] : [];
}

export function getPrimaryPayment(order: OrderPaymentFields | null | undefined): PaymentInfo | null {
  const payments = getOrderPayments(order);

  if (payments.length === 0) {
    return null;
  }

  return payments.find(payment => payment.status?.toLowerCase() === 'paid')
    || payments.find(payment => Boolean(payment.invoice_no))
    || payments[0];
}

export function getOrderInvoiceNo(order: OrderPaymentFields | null | undefined): string {
  const paymentWithInvoice = getOrderPayments(order).find(payment => Boolean(payment.invoice_no));
  return paymentWithInvoice?.invoice_no || order?.invoice_no || '';
}

export function getFileIconByExtension(fileExtension: string): string {
  const iconMap: Record<string, string> = {
    pdf: './assets/media/svg/new-files/pdf.svg',
    doc: './assets/media/svg/new-files/doc.svg',
    docx: './assets/media/svg/new-files/docx.svg',
    xls: './assets/media/svg/new-files/xls.svg',
    xlsx: './assets/media/svg/new-files/xlsx.svg',
    ppt: './assets/media/svg/new-files/ppt.svg',
    pptx: './assets/media/svg/new-files/pptx.svg',
    txt: './assets/media/svg/new-files/txt.svg',
    zip: './assets/media/svg/new-files/zip.svg',
    rar: './assets/media/svg/new-files/zip.svg'
  };

  return iconMap[fileExtension.toLowerCase()] || './assets/media/svg/new-files/file.svg';
}

export function getBadgeColorByExtension(fileExtension: string): string {
  const colorMap: Record<string, string> = {
    csv: '#28a745',
    doc: '#0d6efd',
    docx: '#0d6efd',
    jpg: '#28a745',
    jpeg: '#28a745',
    png: '#28a745',
    gif: '#28a745',
    mp3: '#dc3545',
    mp4: '#6f42c1',
    pdf: '#dc3545',
    ppt: '#dc3545',
    pptx: '#dc3545',
    pub: '#dc3545',
    txt: '#0d6efd',
    xls: '#28a745',
    xlsx: '#28a745',
    zip: '#dc3545',
    rar: '#dc3545'
  };

  return colorMap[fileExtension.toLowerCase()] || '#6c757d';
}

export function getDocumentCountByExtension(orderable: Orderable, extension: string): number {
  let count = 0;
  orderable.knowledge_documents?.forEach((docGroup: KnowledgeDocument[]) => {
    docGroup.forEach((doc: KnowledgeDocument) => {
      if (doc.file_extension.toLowerCase() === extension.toLowerCase()) {
        count++;
      }
    });
  });
  return count;
}

export function getUniqueExtensions(orderable: Orderable): string[] {
  const extensions = new Set<string>();
  orderable.knowledge_documents?.forEach((docGroup: KnowledgeDocument[]) => {
    docGroup.forEach((doc: KnowledgeDocument) => {
      extensions.add(doc.file_extension.toLowerCase());
    });
  });
  return Array.from(extensions);
}

export function getProjectTitle(order: Order | null | undefined, lang: Language): string {
  return order?.orderable?.project?.title || (lang === 'ar' ? 'مشروع' : 'Project');
}

export function getProjectDescription(order: Order | null | undefined): string {
  return order?.orderable?.project?.description || '';
}

export function getProjectNo(order: Order | null | undefined): string {
  return order?.orderable?.project?.project_no || '';
}

export function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'badge badge-light-success';
    case 'pending':
      return 'badge badge-light-warning';
    case 'failed':
      return 'badge badge-light-danger';
    default:
      return 'badge badge-light-info';
  }
}

export function getServiceTypeDisplay(service: string): string {
  if (service === 'knowledge_service' ) {
    return 'Knowledge';
  }
  if (service === 'meeting_service') {
    return 'Meeting';
  }
  if (service === 'project_service') {
    return 'Project';
  }
  return service
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getMeetingStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'confirmed':
    case 'completed':
      return 'badge-light-success';
    case 'pending':
      return 'badge-light-warning';
    case 'cancelled':
      return 'badge-light-danger';
    default:
      return 'badge-light-info';
  }
}

export function getMeetingStatusDisplay(status: string, lang: Language): string {
  const statusMap: Record<string, { ar: string; en: string }> = {
    pending: { ar: 'قيد الانتظار', en: 'Pending' },
    confirmed: { ar: 'مؤكد', en: 'Confirmed' },
    completed: { ar: 'مكتمل', en: 'Completed' },
    cancelled: { ar: 'ملغى', en: 'Cancelled' }
  };

  const statusKey = status.toLowerCase();
  return statusMap[statusKey] ? statusMap[statusKey][lang] : status;
}

export function getOrderStatusClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'text-success';
    case 'pending':
      return 'text-warning';
    case 'failed':
      return 'text-danger';
    default:
      return 'text-info';
  }
}

export function calculateDuration(lang: Language, startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) {
    return lang === 'ar' ? 'غير محدد' : 'Not specified';
  }

  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const diff = end.getTime() - start.getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours > 0 && minutes > 0) {
    return lang === 'ar' ? `${hours} ساعة و ${minutes} دقيقة` : `${hours}h ${minutes}min`;
  }

  if (hours > 0) {
    return lang === 'ar' ? `${hours} ساعة` : `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  return lang === 'ar' ? `${minutes} دقيقة` : `${minutes} minutes`;
}

export function getPaymentMethodDisplay(payment: PaymentInfo | null | undefined, lang: Language): string {
  if (!payment) {
    return lang === 'ar' ? 'غير محدد' : 'Not specified';
  }

  if (payment.method === 'provider' && payment.provider_payment_method_type === 'card') {
    const cardBrand = getCardBrandName(payment.provider_card_brand || '');
    const lastFour = payment.provider_card_last_number;

    if (cardBrand && lastFour) {
      return `${cardBrand} •••• ${lastFour}`;
    }
  }

  if (payment.method === 'manual') {
    return lang === 'ar' ? 'محفظة إنسايتا' : 'Insighta Wallet';
  }

  if (payment.method === 'provider' && payment.provider) {
    const provider = payment.provider.charAt(0).toUpperCase() + payment.provider.slice(1).toLowerCase();
    return provider;
  }

  const method = payment.method?.charAt(0).toUpperCase() + payment.method?.slice(1).toLowerCase();
  return method || (lang === 'ar' ? 'غير محدد' : 'Not specified');
}

export function getCardBrandName(brand: string): string {
  if (!brand) return '';

  const brandMap: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay'
  };

  const normalizedBrand = brand.toLowerCase();
  return brandMap[normalizedBrand] || brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
}

export function getPaymentMethodIcon(payment: PaymentInfo | null | undefined): string {
  if (!payment) {
    return 'ki-outline ki-questionnaire-tablet';
  }

  if (payment.method === 'provider' && payment.provider_payment_method_type === 'card') {
    const cardBrand = payment.provider_card_brand?.toLowerCase();
    const cardIconMap: Record<string, string> = {
      visa: 'ki-outline ki-credit-cart',
      mastercard: 'ki-outline ki-credit-cart',
      amex: 'ki-outline ki-credit-cart',
      discover: 'ki-outline ki-credit-cart',
      diners: 'ki-outline ki-credit-cart',
      jcb: 'ki-outline ki-credit-cart',
      unionpay: 'ki-outline ki-credit-cart'
    };

    return cardIconMap[cardBrand || ''] || 'ki-outline ki-credit-cart';
  }

  if (payment.method === 'manual') {
    return 'ki-outline ki-wallet';
  }

  if (payment.method === 'provider') {
    return 'ki-outline ki-bank';
  }

  return 'ki-outline ki-questionnaire-tablet';
}

export function shouldShowCardLogo(payment: PaymentInfo | null | undefined): boolean {
  if (!payment || payment.method !== 'provider' || payment.provider_payment_method_type !== 'card') {
    return false;
  }

  const cardBrand = payment.provider_card_brand?.toLowerCase();
  return cardBrand === 'visa' || cardBrand === 'mastercard';
}

export function getCardLogoSvgContent(payment: PaymentInfo | null | undefined): string {
  if (!payment || payment.method !== 'provider' || payment.provider_payment_method_type !== 'card') {
    return '';
  }

  const cardBrand = payment.provider_card_brand?.toLowerCase();

  if (cardBrand === 'visa') {
    return `<svg width="24" height="16" viewBox="0 0 79 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M23.112 0.562331L16.3411 16.9637L13.7044 2.96786C13.5091 1.65575 12.4023 0.531091 10.8724 0.531091H0V1.28087C2.24609 1.65575 4.32943 2.40553 6.1849 3.34275C6.93359 3.71763 7.45443 4.49865 7.68229 5.40463L12.7604 24.8051H19.5312L29.6875 0.562331H23.112Z" fill="#172B85"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M32.2917 0.562331L27.0508 24.8051H33.431L38.7044 0.562331H32.2917Z" fill="#172B85"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M46.9401 7.27907C47.1354 5.96696 48.2422 5.21718 49.5768 5.21718C51.6276 5.02974 53.9062 5.40463 55.7617 6.34185L56.901 1.12466C55.013 0.374888 52.9622 0 51.0742 0C44.8893 0 40.3646 3.34275 40.3646 8.02884C40.3646 11.559 43.5547 13.4335 45.8008 14.5581C48.2422 15.6828 49.1862 16.4326 48.9909 17.526C48.9909 19.213 47.1029 19.9628 45.2474 19.9628C43.0013 19.9628 40.7227 19.4004 38.6719 18.4632L37.5326 23.6804C39.8112 24.6176 42.2526 24.9925 44.4987 24.9925C51.4323 25.1799 55.7617 21.8372 55.7617 16.7762C55.7943 10.4344 46.9401 10.0595 46.9401 7.27907Z" fill="#172B85"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M73.0469 0.562331H67.6107C66.4714 0.562331 65.3646 1.31211 64.974 2.43677L55.599 24.8051H62.1745L63.4766 21.2749H71.5495L72.2982 24.8051H78.125L73.0469 0.562331ZM65.1693 16.2139L68.5547 7.09162L70.4427 16.2139H65.1693Z" fill="#172B85"/>
      </svg>`;
  }

  if (cardBrand === 'mastercard') {
    return `<svg width="24" height="16" viewBox="0 0 63 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="43.75" cy="18.75" r="18.75" fill="#F9A000"/>
        <circle cx="18.75" cy="18.75" r="18.75" fill="#ED0006"/>
      </svg>`;
  }

  return '';
}

export function isKnowledgeOrder(order: Order): boolean {
  return order.service === 'knowledge_service';
}

export function isMeetingOrder(order: Order): boolean {
  return order.service === 'meeting_service';
}
