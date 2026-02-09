import { Component, OnInit, OnDestroy, Injector, HostListener, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { WalletService, Transaction, TransactionResponse, User, ChartDataPoint } from 'src/app/_fake/services/wallet/wallet.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { UIChart } from 'primeng/chart';

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss']
})
export class WalletComponent extends BaseComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver?: any;
  private chartContainer?: ElementRef<HTMLDivElement>;

  @ViewChild('walletChart') walletChart?: UIChart;
  @ViewChild('chartContainer', { static: false })
  set chartContainerRef(element: ElementRef<HTMLDivElement> | undefined) {
    if (element) {
      this.chartContainer = element;
      this.initResizeObserver();
      this.scheduleChartRefresh(0);
    } else {
      this.chartContainer = undefined;
      this.teardownResizeObserver();
    }
  }

  walletBalance: number = 0;
  transactions: Transaction[] = [];
  totalRecords: number = 0;
  loading: boolean = false;

  currentPage: number = 1;
  pageSize: number = 10;

  selectedTransaction: Transaction | null = null;
  showDetailsDialog: boolean = false;

  // Chart data properties
  chartData: any;
  chartOptions: any;
  selectedPeriod: 'weekly' | 'monthly' | 'yearly' = 'monthly';

  // Period options for custom select buttons
  periodOptions: Array<{label: string; labelAr: string; value: 'weekly' | 'monthly' | 'yearly'}> = [
    { label: 'Weekly', labelAr: 'أسبوعي', value: 'weekly' },
    { label: 'Monthly', labelAr: 'شهري', value: 'monthly' },
    { label: 'Yearly', labelAr: 'سنوي', value: 'yearly' }
  ];

  getShortPeriodLabel(option: {label: string; labelAr: string; value: 'weekly' | 'monthly' | 'yearly'}, lang: string): string {
    const shortLabels: Record<string, {en: string; ar: string}> = {
      'weekly': { en: 'Week', ar: 'أسبوع' },
      'monthly': { en: 'Month', ar: 'شهر' },
      'yearly': { en: 'Year', ar: 'سنة' }
    };

    return lang === 'ar'
      ? shortLabels[option.value]?.ar || option.labelAr
      : shortLabels[option.value]?.en || option.label;
  }

  // Chart data from API
  chartApiData: ChartDataPoint[] = [];
  useApiData: boolean = true;
  hasRealData: boolean = false;
  
  
  get tableColumns() {
    return [
      { field: 'service', header: this.lang === 'ar' ? 'الخدمة' : 'Service' },
      { field: 'date', header: this.lang === 'ar' ? 'التاريخ' : 'Date' },
      { field: 'transactionType', header: this.lang === 'ar' ? 'النوع' : 'Type' },
      { field: 'operationType', header: this.lang === 'ar' ? 'العملية' : 'Operation' },
      { field: 'amount', header: this.lang === 'ar' ? 'المبلغ' : 'Amount' },
      { field: 'actions', header: this.lang === 'ar' ? 'التفاصيل' : 'Details' }
    ];
  }

  constructor(
    injector: Injector,
    private walletService: WalletService
  ) {
    super(injector);
  }

  ngAfterViewInit(): void {
    this.initResizeObserver();
    this.scheduleChartRefresh();
  }

  ngOnInit(): void {
    this.loadWalletData();
    this.loadTransactions();
    this.loadChartData();
  }
  

  ngOnDestroy(): void {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    this.teardownResizeObserver();
    this.destroy$.next();
    this.destroy$.complete();
    super.ngOnDestroy();
  }

  loadWalletData(): void {
    this.walletService.getBalance()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (balance) => {
          this.walletBalance = balance;
        },
        error: (error) => {
          this.handleServerErrors(error);
        }
      });
  }

  loadTransactions(): void {
    this.loading = true;

    this.walletService.getTransactions(this.currentPage, this.pageSize, this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: TransactionResponse) => {
          this.transactions = response.data;
          this.totalRecords = response.meta.total;
          this.loading = false;
        },
        error: (error) => {
          this.loading = false;
          this.handleServerErrors(error);
        }
      });
  }

  loadChartData(): void {
    this.walletService.getChartData(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.chartApiData = response.data;
          this.hasRealData = this.chartApiData.length > 0;
          if (this.hasRealData) {
            this.initializeChart();
          }
        },
        error: (error) => {
          this.handleServerErrors(error);
          this.hasRealData = false;
          this.chartApiData = [];
        }
      });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleChartRefresh();
  }

  private scheduleChartRefresh(delay: number = 150): void {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = setTimeout(() => {
      const chartComponent = this.walletChart;
      if (!chartComponent) {
        return;
      }

      // If chart instance already exists, force a manual resize/update; otherwise fall back to full reinit.
      if (chartComponent.chart) {
        chartComponent.chart.canvas.style.width = '100%';
        chartComponent.chart.resize();
        chartComponent.chart.update('none');
      }

      if (typeof chartComponent.reinit === 'function') {
        chartComponent.reinit();
      }
    }, delay);
  }

  private initResizeObserver(): void {
    if (typeof window === 'undefined' || !(window as any).ResizeObserver || !this.chartContainer?.nativeElement) {
      return;
    }

    this.teardownResizeObserver();

    const NativeResizeObserver = (window as any).ResizeObserver;
    this.resizeObserver = new NativeResizeObserver(() => {
      this.scheduleChartRefresh(100);
    });
    this.resizeObserver.observe(this.chartContainer.nativeElement);
  }

  private teardownResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }



  onPageChange(event: any): void {
    this.currentPage = (event.page || 0) + 1;
    this.loadTransactions();
  }

  formatService(service: string): string {
    if (!service) return '';

    // Handle Arabic text that might come from API
    if (this.lang === 'ar') {
      if (service.includes('مبيعات المعرفة') || service === 'مبيعات المعرفة') {
        return 'مبيعات المستندات';
      }
      if (service.includes('دخل من المعرفة') || service === 'دخل من المعرفة') {
        return 'مبيعات المستندات';
      }
    }

    // Handle special cases for meeting-related transactions
    if (service === 'book_meeting') {
      return this.lang === 'ar' ? 'حجز اجتماع' : 'Book Meeting';
    }
    if (service === 'income_meeting') {
      return this.lang === 'ar' ? 'دخل من اجتماع' : 'Meeting Income';
    }
    if (service === 'income_knowledge') {
      return this.lang === 'ar' ? 'مبيعات المستندات' : 'Knowledge Income';
    }
    if (service === 'purchase_knowledge') {
      return this.lang === 'ar' ? 'شراء المعرفة' : 'Knowledge Purchase';
    }

    // Check if service contains knowledge sales keywords
    const normalizedService = service.toLowerCase().trim();
    if (normalizedService.includes('knowledge') && (normalizedService.includes('sales') || normalizedService.includes('income'))) {
      return this.lang === 'ar' ? 'مبيعات المستندات' : (normalizedService.includes('sales') ? 'Knowledge Sales' : 'Knowledge Income');
    }

    // Default formatting for other services
    return service
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatTransactionType(type: string): string {
    if (!type) return '';

    // Handle Arabic text that might come from API
    if (this.lang === 'ar') {
      if (type.includes('مبيعات المعرفة') || type === 'مبيعات المعرفة') {
        return 'مبيعات المستندات';
      }
    }

    // Handle English/Latin text
    const normalizedType = type.toLowerCase().trim();
    
    const typeTranslations: { [key: string]: { en: string; ar: string } } = {
      'book_meeting': { en: 'Book Meeting', ar: 'حجز اجتماع' },
      'income_meeting': { en: 'Meeting Income', ar: 'دخل اجتماع' },
      'income_knowledge': { en: 'Knowledge Income', ar: 'مبيعات المستندات' },
      'knowledge_sales': { en: 'Knowledge Sales', ar: 'مبيعات المستندات' },
      'purchase_knowledge': { en: 'Knowledge Purchase', ar: 'شراء معرفة' },
      'wallet_topup': { en: 'Wallet Top-up', ar: 'شحن المحفظة' },
      'refund': { en: 'Refund', ar: 'استرداد' },
      'commission': { en: 'Commission', ar: 'عمولة' },
      'bonus': { en: 'Bonus', ar: 'مكافأة' }
    };

    // Check for exact match first
    const translation = typeTranslations[normalizedType];
    if (translation) {
      return this.lang === 'ar' ? translation.ar : translation.en;
    }

    // Check if type contains keywords
    if (normalizedType.includes('knowledge') && normalizedType.includes('sales')) {
      return this.lang === 'ar' ? 'مبيعات المستندات' : 'Knowledge Sales';
    }
    if (normalizedType.includes('knowledge') && normalizedType.includes('income')) {
      return this.lang === 'ar' ? 'مبيعات المستندات' : 'Knowledge Income';
    }

    // Default formatting for unknown types
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatOperationType(type: string): string {
    if (!type) return '';

    const typeTranslations: { [key: string]: { en: string; ar: string } } = {
      'book_meeting': { en: 'Book Meeting', ar: 'حجز اجتماع' },
      'income_meeting': { en: 'Meeting Income', ar: 'دخل اجتماع' },
      'income_knowledge': { en: 'Knowledge Income', ar: 'دخل معرفة' },
      'purchase_knowledge': { en: 'Knowledge Purchase', ar: 'شراء معرفة' },
      'wallet_topup': { en: 'Wallet Top-up', ar: 'شحن المحفظة' },
      'refund': { en: 'Refund', ar: 'استرداد' },
      'commission': { en: 'Commission', ar: 'عمولة' },
      'bonus': { en: 'Bonus', ar: 'مكافأة' }
    };

    const translation = typeTranslations[type];
    if (translation) {
      return this.lang === 'ar' ? translation.ar : translation.en;
    }

    // Default formatting for unknown types
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTransactionType(transaction: Transaction): string {
    if (this.lang === 'ar') {
      return transaction.transaction === 'deposit' ? 'إيداع' : 'سحب';
    }
    return transaction.transaction === 'deposit' ? 'Deposit' : 'Withdraw';
  }

  getTransactionSeverity(transaction: Transaction): 'success' | 'danger' {
    return transaction.transaction === 'deposit' ? 'success' : 'danger';
  }
  
  get Math() {
    return Math;
  }

  getAmountClass(transaction: Transaction): string {
    return transaction.transaction === 'deposit' ? 'text-success' : 'text-danger';
  }

  formatAmount(amount: number): string {
    const absAmount = Math.abs(amount);
    const closeSign = amount >= 0 ? '' : ')';
    const openSign = amount >= 0 ? '' : '(';
    return `${openSign}$${absAmount.toFixed(2)}${closeSign}`;
  }

  formatOriginalAmount(amount: number | undefined): string {
    if (amount === undefined || amount === null) {
      return '$0.00';
    }
    return `$${amount.toFixed(2)}`;
  }


  showTransactionDetails(transaction: Transaction): void {
    this.selectedTransaction = transaction;
    this.showDetailsDialog = true;
  }

  getFileIcon(extension: string): string {
    if (!extension) return 'assets/media/svg/new-files/doc.svg';
    const ext = extension.toLowerCase();
    return `assets/media/svg/new-files/${ext}.svg`;
  }

  formatMeetingDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getBackgroundImage(url: string): string {
    return `url("${encodeURI(url)}")`;
  }

  getLatestTransactionAmount(): number {
    if (this.transactions.length > 0) {
      return this.transactions[0].amount;
    }
    return 0;
  }

  getLatestTransactionType(): string {
    if (this.transactions.length > 0) {
      return this.transactions[0].transaction;
    }
    return '';
  }

  // User helper methods
  getUserInitials(user: User | undefined): string {
    if (!user) return '';
    const firstInitial = user.first_name?.charAt(0) || user.name?.charAt(0) || '';
    const lastInitial = user.last_name?.charAt(0) || user.name?.split(' ')[1]?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase();
  }

  getRoleBadgeClass(role: string): string {
    switch (role?.toLowerCase()) {
      case 'insighter':
        return 'badge-light-success';
      case 'company':
      case 'client':
        return 'badge-light-info';
      case 'admin':
        return 'badge-light-warning';
      default:
        return 'badge-light-secondary';
    }
  }

  formatRole(role: string): string {
    if (!role) return '';

    if (this.lang === 'ar') {
      switch (role.toLowerCase()) {
        case 'insighter':
          return 'خبير';
        case 'company':
          return 'شركة';
        case 'client':
          return 'عميل';
        case 'admin':
          return 'مدير';
        default:
          return role;
      }
    }

    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  getStatusBadgeClass(status: string): string {
    if (!status) return 'badge-light-secondary';

    switch (status.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'badge-light-success';
      case 'pending':
      case 'processing':
        return 'badge-light-warning';
      case 'cancelled':
      case 'failed':
        return 'badge-light-danger';
      case 'postponed':
        return 'badge-light-info';
      default:
        return 'badge-light-secondary';
    }
  }

  formatStatus(status: string): string {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  // Profile redirect method
  redirectToProfile(user: User | undefined): void {
    if (user?.uuid) {
      const profileUrl = `https://insightabusiness.com/${this.lang}/profile/${user.uuid}?entity=insighter`;
      window.open(profileUrl, '_blank');
    }
  }

  // Get period label based on selected filter
  getPeriodLabel(): string {
    const currentYear = new Date().getFullYear();

    if (this.selectedPeriod === 'weekly') {
      return this.lang === 'ar' ? 'الأسبوع الحالي' : 'Current Week';
    } else if (this.selectedPeriod === 'monthly') {
      return this.lang === 'ar' ? `معاملات ${currentYear}` : `${currentYear} Transactions`;
    }

    return '';
  }

  // Translation helper methods
  getTranslation(key: string): string {
    const translations: { [key: string]: { en: string; ar: string } } = {
      'currentWalletBalance': { en: 'Balance', ar: 'الرصيد' },
      'transactionsHistory': { en: 'Transactions', ar: 'الحركات المالية' },
      'transactionsSubtitle': { en: 'Track money coming in and going out from this area.', ar: 'تتبع الأموال الواردة والصادرة من هذه المنطقة.' },
      'service': { en: 'Transactions', ar: 'الحركة' },
      'date': { en: 'Date', ar: 'التاريخ' },
      'transaction': { en: 'Description ', ar: 'المعاملة' },
      'type': { en: 'Type', ar: 'النوع' },
      'transactionType': { en: 'Type', ar: 'النوع' },
      'operationType': { en: 'Operation', ar: 'العملية' },
      'amount': { en: 'Amount', ar: 'المبلغ' },
      'amountAfterFees':{en:'After Tax',ar:'بعد الضرائب'},
      'originalAmount': { en: 'Original Amount', ar: 'المبلغ الأصلي' },
      'profitRate': { en: 'Profit Rate', ar: 'نسبة الربح' },
      'insighterProfit': { en: 'Insighter Profit', ar: 'ربح الخبير' },
      'details': { en: 'Details', ar: 'التفاصيل' },
      'deposit': { en: 'Deposit', ar: 'إيداع' },
      'withdraw': { en: 'Withdraw', ar: 'سحب' },
      'noTransactions': { en: 'No transactions found', ar: 'لم يتم العثور على معاملات' },
      'showingPage': { en: 'Showing page', ar: 'عرض الصفحة' },
      'of': { en: 'of', ar: 'من' },
      'pages': { en: 'pages', ar: 'صفحات' },
      'transactionDetails': { en: 'Transaction Details', ar: 'تفاصيل المعاملة' },
      'orderInformation': { en: 'Order Information', ar: 'معلومات الطلب' },
      'orderNumber': { en: 'Order Number', ar: 'رقم الطلب' },
      'invoiceNumber': { en: 'Invoice Number', ar: 'رقم الفاتورة' },
      'status': { en: 'Status', ar: 'الحالة' },
      'knowledgeItems': { en: 'Knowledge Items', ar: 'عناصر المعرفة' },
      'meetingDetails': { en: 'Session Details', ar: 'تفاصيل الجلسة الاستشارية' },
      'meetingTitle': { en: 'Session Title', ar: 'عنوان الجلسة الاستشارية' },
      'meetingStatus': { en: 'Session Status', ar: 'حالة الجلسة الاستشارية' },
      'meetingDate': { en: 'Session Date', ar: 'تاريخ الجلسة الاستشارية' },
      'meetingTime': { en: 'Session Time', ar: 'وقت الجلسة الاستشارية' },
      'meetingDescription': { en: 'Description', ar: 'الوصف' },
      'close': { en: 'Close', ar: 'إغلاق' },
      'viewDetails': { en: 'View Details', ar: 'عرض التفاصيل' },
      'balance': { en: 'Balance', ar: 'الرصيد' },
      'userInformation': { en: 'User Information', ar: 'معلومات المستخدم' },
      'sendEmail': { en: 'Send Email', ar: 'إرسال بريد إلكتروني' },
      'viewProfile': { en: 'View Profile', ar: 'عرض الملف الشخصي' },
      'emailNotAvailable': { en: 'Email not available', ar: 'البريد الإلكتروني غير متوفر' }
    };

    return translations[key] ? translations[key][this.lang === 'ar' ? 'ar' : 'en'] : key;
  }

  getWalletSubtitle(): string {
    if (this.lang === 'ar') {
      return 'عرض لرصيدك الحالي وتاريخ المعاملات المالية';
    }
    return 'View your current balance and transaction history';
  }

  private handleServerErrors(error: any): void {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          if (error.error.type === "warning") {
            this.showWarn(
              this.lang === "ar" ? "تحذير" : "Warning",
              messages.join(", ")
            );
          } else {
            this.showError(
              this.lang === "ar" ? "حدث خطأ" : "An error occurred",
              messages.join(", ")
            );
          }
        }
      }
    } else {
      if (error.error && error.error.type === "warning") {
        this.showWarn(
          this.lang === "ar" ? "تحذير" : "Warning",
          this.lang === "ar" ? "تحذير" : "An unexpected warning occurred."
        );
      } else {
        this.showError(
          this.lang === "ar" ? "حدث خطأ" : "An error occurred",
          this.lang === "ar" ? "حدث خطأ" : "An unexpected error occurred."
        );
      }
    }
  }


  generateSampleChartData(): void {
    const today = new Date();
    const data = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const baseDeposits = 5000 + Math.random() * 3000;
      const baseWithdrawals = 2000 + Math.random() * 2000;
      const deposits = Math.round(baseDeposits + Math.sin(i * 0.2) * 1000);
      const withdrawals = Math.round(baseWithdrawals + Math.cos(i * 0.15) * 800);

      data.push({
        date: date.toISOString().split('T')[0],
        deposits: deposits,
        balance: deposits - withdrawals + 3000,
        withdrawals: withdrawals
      });
    }

    this.chartApiData = data;
  }

  initializeChart(): void {
    console.log('Initializing chart with data:', this.chartApiData);

    if (!this.chartApiData || this.chartApiData.length === 0) {
      console.log('No data available for chart');
      return;
    }

    const labels = this.chartApiData.map(item => {
      // For the new API structure, date is already formatted (Mon, Tue, Jan, Feb, 2025, etc.)
      return item.date;
    });

    // Create gradients
    const createGradient = (ctx: CanvasRenderingContext2D, color1: string, color2: string) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, color1);
      gradient.addColorStop(1, color2);
      return gradient;
    };

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: this.lang === 'ar' ? 'الإيداعات' : 'Deposits',
          data: this.chartApiData.map(item => item.deposits),
          borderColor: '#10b981',
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            const {ctx: canvasCtx} = chart;
            return createGradient(canvasCtx, 'rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0)');
          },
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#10b981',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3
        },
        {
          label: this.lang === 'ar' ? 'السحوبات' : 'Withdrawals',
          data: this.chartApiData.map(item => item.withdrawals),
          borderColor: '#ef4444',
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            const {ctx: canvasCtx} = chart;
            return createGradient(canvasCtx, 'rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0)');
          },
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#ef4444',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3
        }
      ]
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (_event: any, activeElements: any[], chart: any) => {
        // Update vertical line on hover
        if (activeElements.length > 0) {
          const dataIndex = activeElements[0].index;
          this.updateHoverAnnotation(chart, dataIndex);
        } else {
          this.clearHoverAnnotation(chart);
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#1f2937',
          bodyColor: '#1f2937',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          usePointStyle: true,
          padding: 12,
          titleFont: {
            size: 12,
            weight: '600'
          },
          bodyFont: {
            size: 11
          },
          callbacks: {
            title: (context: any) => {
              const dataIndex = context[0].dataIndex;
              const dateValue = this.chartApiData[dataIndex].date;

              // Handle different period formats
              if (this.selectedPeriod === 'weekly') {
                // For weekly, dateValue is like "Mon", "Tue", etc.
                const dayNames = {
                  'Mon': 'Monday',
                  'Tue': 'Tuesday',
                  'Wed': 'Wednesday',
                  'Thu': 'Thursday',
                  'Fri': 'Friday',
                  'Sat': 'Saturday',
                  'Sun': 'Sunday'
                };
                return dayNames[dateValue as keyof typeof dayNames] || dateValue;
              } else if (this.selectedPeriod === 'monthly') {
                // For monthly, dateValue is like "Jan", "Feb", etc.
                const monthNames = {
                  'Jan': 'January',
                  'Feb': 'February',
                  'Mar': 'March',
                  'Apr': 'April',
                  'May': 'May',
                  'Jun': 'June',
                  'Jul': 'July',
                  'Aug': 'August',
                  'Sep': 'September',
                  'Oct': 'October',
                  'Nov': 'November',
                  'Dec': 'December'
                };
                return monthNames[dateValue as keyof typeof monthNames] || dateValue;
              } else if (this.selectedPeriod === 'yearly') {
                // For yearly, dateValue is like "2025"
                return `Year ${dateValue}`;
              }

              // Fallback for any other format
              return dateValue;
            },
            label: (context: any) => {
              return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
            }
          }
        },
        annotation: {
          annotations: this.createVerticalAnnotations()
        }
      },
      scales: {
        x: {
          type: 'category',
          grid: {
            color: '#f3f4f6',
            lineWidth: 1,
            drawBorder: false
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            },
            autoSkip: this.selectedPeriod === 'monthly' ? false : true,
            maxTicksLimit: this.selectedPeriod === 'monthly' ? 12 : (this.selectedPeriod === 'weekly' ? 7 : undefined)
          }
        },
        y: {
          grid: {
            color: '#f3f4f6',
            lineWidth: 1,
            drawBorder: false
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            },
            callback: function(value: any, index: number, ticks: any[]) {
              // Only show first and last tick values
              if (index === 0 || index === ticks.length - 1) {
                return '$' + value.toLocaleString();
              }
              return '';
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    };

    this.scheduleChartRefresh();
  }

  setPeriod(period: 'weekly' | 'monthly' | 'yearly'): void {
    this.selectedPeriod = period;
    this.currentPage = 1; // Reset to first page when period changes
    this.loadTransactions(); // Reload transactions with new period
    this.loadChartData(); // Reload chart data with new period
  }

  createVerticalAnnotations(): any {
    if (!this.chartApiData || this.chartApiData.length === 0) {
      return {};
    }

    const annotations: any = {};

    // Add a vertical line for each data point (initially hidden or very light)
    this.chartApiData.forEach((_, index) => {
      annotations[`verticalLine${index}`] = {
        type: 'line',
        scaleID: 'x',
        value: index,
        borderColor: 'rgba(209, 213, 219, 0)', // Initially transparent
        borderWidth: 1,
        borderDash: [3, 3],
        label: {
          display: false
        }
      };
    });

    return annotations;
  }

  updateHoverAnnotation(chart: any, dataIndex: number): void {
    if (!chart || !chart.options.plugins.annotation) {
      return;
    }

    const annotations = chart.options.plugins.annotation.annotations;

    // Reset all annotations to transparent
    Object.keys(annotations).forEach(key => {
      if (key.startsWith('verticalLine')) {
        annotations[key].borderColor = 'rgba(209, 213, 219, 0)';
      }
    });

    // Highlight the hovered annotation
    const hoveredAnnotation = annotations[`verticalLine${dataIndex}`];
    if (hoveredAnnotation) {
      hoveredAnnotation.borderColor = '#6b7280'; // Darker gray on hover
      hoveredAnnotation.borderWidth = 2;
    }

    chart.update('none'); // Update without animation for instant response
  }

  clearHoverAnnotation(chart: any): void {
    if (!chart || !chart.options.plugins.annotation) {
      return;
    }

    const annotations = chart.options.plugins.annotation.annotations;

    // Reset all annotations to transparent
    Object.keys(annotations).forEach(key => {
      if (key.startsWith('verticalLine')) {
        annotations[key].borderColor = 'rgba(209, 213, 219, 0)';
        annotations[key].borderWidth = 1;
      }
    });

    chart.update('none');
  }

  getChartLegendData(): {label: string, value: string, color: string}[] {
    if (!this.chartApiData || this.chartApiData.length === 0) {
      return [
        {
          label: this.lang === 'ar' ? 'الدخل' : 'Income',
          value: '$0',
          color: '#6366f1'
        },
        {
          label: this.lang === 'ar' ? 'المصروفات' : 'Expenditure',
          value: '$0',
          color: '#0ea5e9'
        }
      ];
    }

    const totalIncome = this.chartApiData.reduce((sum, item) => sum + item.deposits, 0);
    const totalExpenditure = this.chartApiData.reduce((sum, item) => sum + item.withdrawals, 0);

    return [
      {
        label: this.lang === 'ar' ? 'الدخل' : 'Income',
        value: `$${totalIncome.toLocaleString()}`,
        color: '#6366f1'
      },
      {
        label: this.lang === 'ar' ? 'المصروفات' : 'Expenditure',
        value: `$${totalExpenditure.toLocaleString()}`,
        color: '#0ea5e9'
      }
    ];
  }
}
