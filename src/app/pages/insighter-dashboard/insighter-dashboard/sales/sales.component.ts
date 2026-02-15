import { Component, OnInit, Injector, OnDestroy, HostListener, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { SalesService, PeriodType, TotalStatisticsData, PeriodStatisticsData } from 'src/app/_fake/services/sales/sales.service';
import { MyOrdersService, Order } from '../my-orders/my-orders.service';
import { forkJoin, Subject, Observable, BehaviorSubject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { UIChart } from 'primeng/chart';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-sales',
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.scss']
})
export class SalesComponent extends BaseComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver?: any;
  private chartContainers: ElementRef<HTMLDivElement>[] = [];

  @ViewChild('revenueChart') revenueChart?: UIChart;
  @ViewChild('knowledgeChart') knowledgeChart?: UIChart;
  @ViewChild('meetingChart') meetingChart?: UIChart;

  @ViewChild('revenueChartContainer', { static: false })
  set revenueChartContainerRef(element: ElementRef<HTMLDivElement> | undefined) {
    if (element && this.chartContainers[0] !== element) {
      this.chartContainers[0] = element;
      this.initResizeObserver();
      this.scheduleChartRefresh(0);
    }
  }

  @ViewChild('knowledgeChartContainer', { static: false })
  set knowledgeChartContainerRef(element: ElementRef<HTMLDivElement> | undefined) {
    if (element && this.chartContainers[1] !== element) {
      this.chartContainers[1] = element;
      this.initResizeObserver();
      this.scheduleChartRefresh(0);
    }
  }

  @ViewChild('meetingChartContainer', { static: false })
  set meetingChartContainerRef(element: ElementRef<HTMLDivElement> | undefined) {
    if (element && this.chartContainers[2] !== element) {
      this.chartContainers[2] = element;
      this.initResizeObserver();
      this.scheduleChartRefresh(0);
    }
  }

  selectedPeriod: PeriodType = 'weekly';
  isLoading = false;

  totalStatistics: TotalStatisticsData | null = null;
  periodStatistics: PeriodStatisticsData | null = null;

  isCompany = false;
  isInsighter = false;

  // Tab management
  activeTab: 'analytics' | 'sold-details' | 'sold-meetings' = 'analytics';

  // Sold knowledge data
  soldOrders$ = new BehaviorSubject<Order[]>([]);
  soldTotalPages$ = new BehaviorSubject<number>(0);
  currentSoldPage = 1;
  isSoldLoading$ = new BehaviorSubject<boolean>(false);

  // Sold meeting data
  soldMeetingOrders$ = new BehaviorSubject<Order[]>([]);
  soldMeetingTotalPages$ = new BehaviorSubject<number>(0);
  currentSoldMeetingPage = 1;
  isSoldMeetingLoading$ = new BehaviorSubject<boolean>(false);

  selectedInsighterUuid: string | null = null;
  roles: string[] = [];

  // Modal dialog properties
  showOrderDetailsDialog = false;
  showMeetingOrderDetailsDialog = false;
  selectedOrderForDialog: Order | null = null;
  selectedMeetingOrderForDialog: Order | null = null;


  revenueChartData: any = null;
  revenueChartOptions: any = null;

  knowledgeChartData: any = null;
  knowledgeChartOptions: any = null;

  meetingChartData: any = null;
  meetingChartOptions: any = null;

  // Period options for custom select buttons
  periodOptions: Array<{label: string; labelAr: string; value: PeriodType}> = [
    { label: 'Weekly', labelAr: 'أسبوعي', value: 'weekly' },
    { label: 'Monthly', labelAr: 'شهري', value: 'monthly' },
    { label: 'Yearly', labelAr: 'سنوي', value: 'yearly' }
  ];

  getShortLabel(option: {label: string; labelAr: string; value: PeriodType}, lang: string): string {
    const shortLabels: Record<string, {en: string; ar: string}> = {
      'weekly': { en: 'Week', ar: 'أسبوع' },
      'monthly': { en: 'Month', ar: 'شهر' },
      'yearly': { en: 'Year', ar: 'سنة' }
    };

    return lang === 'ar'
      ? shortLabels[option.value]?.ar || option.labelAr
      : shortLabels[option.value]?.en || option.label;
  }

  constructor(
    injector: Injector,
    private salesService: SalesService,
    private authService: ProfileService,
    private myOrdersService: MyOrdersService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    super(injector);
  }

  ngAfterViewInit(): void {
    this.initResizeObserver();
    this.scheduleChartRefresh();
  }

  ngOnInit(): void {
    this.checkUserRole();
    this.loadData();
    this.loadUserRoles();
    this.handleTabFromUrl();
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

  // Localization methods
  getText(key: string): string {
    const translations: { [key: string]: { en: string; ar: string } } = {
      'TOTAL_ORDERS_TITLE': { en: 'Total Sale Orders', ar: 'إجمالي الحركات' },
      'TOTAL_ORDERS': { en: 'Items Sold', ar: 'المستندات المباعة' },
      'TOTAL_ORDERS_MEETINGS': { en: 'Meetings Booked', ar: 'الجلسات المنعقدة' },
      'ORDERS_REVENUE_TITLE': { en: 'Total Revenue', ar: 'إجمالي الإيرادات' },
      'ORDERS_REVENUE': { en: 'Revenue from Knowledge', ar: "الإيرادات" },
      'ORDERS_REVENUE_MEETINGS': { en: 'Meetings Revenue', ar: "الإيرادات" },
      'NET_PROFIT': { en: 'Net Profit', ar: 'صافي الربح' },
      'COMPANY_NET_PROFIT': { en: 'Your Net Profit', ar: 'صافي الأرباح' },
      'REVENUE_CHART': { en: 'Overview', ar: 'نظرة عامة على الإيرادات' },
      'KNOWLEDGE_ORDERS': { en: 'Documents', ar: "المستندات" },
      'MEETING_ORDERS': { en: 'Sessions', ar: 'الجلسات الاستشارية' },
      'LOADING': { en: 'Loading...', ar: 'جاري التحميل...' },
      'WEEKLY': { en: 'Weekly', ar: 'أسبوعي' },
      'MONTHLY': { en: 'Monthly', ar: 'شهري' },
      'YEARLY': { en: 'Yearly', ar: 'سنوي' },
      'KNOWLEDGE': { en: 'Insights', ar: 'المستندات' },
      'MEETINGS': { en: 'Sessions', ar: 'الجلسات' },
      'TOTAL_AMOUNT': { en: 'Total Amount', ar: 'إجمالي المبلغ' },
      'EXPORT_TO_EXCEL': { en: 'Export to Excel', ar: 'تصدير إلى إكسل' },
      'INSIGHTER_NAME': { en: 'Insighter Name', ar: 'اسم الخبير' },
      'COMPANY_PROFIT': { en: 'Company Profit', ar: 'ربح الشركة' }
    };

    const translation = translations[key];
    if (!translation) {
      return key; // fallback to key if translation not found
    }

    return this.lang === 'ar' ? translation.ar : translation.en;
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

  private checkUserRole(): void {
    const user = this.authService.getProfile().pipe(takeUntil(this.unsubscribe$), take(1));
    user.subscribe((user: any) => {
      if (user && user.roles) {
        this.isCompany = user.roles.includes('company') ;
        this.isInsighter = user.roles.includes('insighter');
        this.roles = user.roles;
      }
    });
  }

  private loadUserRoles(): void {
    const user = this.authService.getProfile().pipe(takeUntil(this.unsubscribe$), take(1));
    user.subscribe((user: any) => {
      if (user && user.roles) {
        this.roles = user.roles;
      }
    });
  }

  setActiveTab(tab: 'analytics' | 'sold-details' | 'sold-meetings'): void {
    this.activeTab = tab;

    // Update URL with tab parameter
    const tabNumbers = {
      'analytics': 1,
      'sold-details': 2,
      'sold-meetings': 3
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabNumbers[tab] },
      queryParamsHandling: 'merge'
    });

    if (tab === 'sold-details' && this.soldOrders$.value.length === 0) {
      this.loadSoldOrders();
    }
    if (tab === 'sold-meetings' && this.soldMeetingOrders$.value.length === 0) {
      this.loadSoldMeetingOrders();
    }
  }

  private loadSoldOrders(): void {
    this.isSoldLoading$.next(true);
    const role = this.isCompany ? 'company' : 'insighter';
    this.myOrdersService.getSalesKnowledgeOrders(this.currentSoldPage, role, this.selectedInsighterUuid || undefined)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (response) => {
          this.soldOrders$.next(response.data);
          this.soldTotalPages$.next(response.meta.last_page);
          this.isSoldLoading$.next(false);
        },
        error: (error) => {
          this.handleServerErrors(error);
          this.isSoldLoading$.next(false);
        }
      });
  }

  private loadSoldMeetingOrders(): void {
    this.isSoldMeetingLoading$.next(true);
    const role = this.isCompany ? 'company' : 'insighter';
    this.myOrdersService.getSalesMeetingOrders(this.currentSoldMeetingPage, role, this.selectedInsighterUuid || undefined)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (response) => {
          this.soldMeetingOrders$.next(response.data);
          this.soldMeetingTotalPages$.next(response.meta.last_page);
          this.isSoldMeetingLoading$.next(false);
        },
        error: (error) => {
          this.handleServerErrors(error);
          this.isSoldMeetingLoading$.next(false);
        }
      });
  }

  onSoldPageChange(page: number): void {
    this.currentSoldPage = page;
    this.loadSoldOrders();
  }

  onSoldMeetingPageChange(page: number): void {
    this.currentSoldMeetingPage = page;
    this.loadSoldMeetingOrders();
  }

  onOrderSelected(order: Order): void {
    if (this.activeTab === 'sold-details') {
      // Show knowledge order details dialog
      this.selectedOrderForDialog = order;
      this.showOrderDetailsDialog = true;
    } else if (this.activeTab === 'sold-meetings') {
      // Show meeting order details dialog
      this.selectedMeetingOrderForDialog = order;
      this.showMeetingOrderDetailsDialog = true;
    }
  }

  onInvoiceDownload(order: Order): void {
    // Open invoice in a new tab
    const orderNumber = order.invoice_no || order.order_no;
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/app/invoice', orderNumber])
    );
    window.open(url, '_blank');
  }

  onNavigateToDownloads(order: Order): void {
    // Navigate to downloads page
    this.router.navigate(['/app/my-downloads']);
  }

  onCopyOrderNo(orderNo: string): void {
    navigator.clipboard.writeText(orderNo).then(() => {
      this.showSuccess(
        this.lang === 'ar' ? 'تم النسخ' : 'Copied',
        this.lang === 'ar' ? 'تم نسخ رقم الطلب' : 'Order number copied to clipboard'
      );
    }).catch(() => {
      this.showError(
        this.lang === 'ar' ? 'خطأ' : 'Error',
        this.lang === 'ar' ? 'فشل في نسخ رقم الطلب' : 'Failed to copy order number'
      );
    });
  }

  onInsighterFilterChange(insighterUuid: string | null): void {
    this.selectedInsighterUuid = insighterUuid;
    this.currentSoldPage = 1;
    this.currentSoldMeetingPage = 1;
    if (this.activeTab === 'sold-details') {
      this.loadSoldOrders();
    }
    if (this.activeTab === 'sold-meetings') {
      this.loadSoldMeetingOrders();
    }
  }

  onOrderDetailsDialogVisibleChange(visible: boolean): void {
    this.showOrderDetailsDialog = visible;
    if (!visible) {
      this.selectedOrderForDialog = null;
    }
  }

  onMeetingOrderDetailsDialogVisibleChange(visible: boolean): void {
    this.showMeetingOrderDetailsDialog = visible;
    if (!visible) {
      this.selectedMeetingOrderForDialog = null;
    }
  }


  onPeriodChange(period: PeriodType): void {
    console.log('🔄 Period change requested:', period);
    console.log('📅 Current selectedPeriod before change:', this.selectedPeriod);
    this.selectedPeriod = period;
    console.log('📅 New selectedPeriod after change:', this.selectedPeriod);
    this.loadPeriodStatistics();
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
      this.refreshAllCharts();
    }, delay);
  }

  private refreshAllCharts(): void {
    const charts = [this.revenueChart, this.knowledgeChart, this.meetingChart];

    charts.forEach(chartComponent => {
      if (!chartComponent) return;

      // If chart instance already exists, force a manual resize/update
      if (chartComponent.chart) {
        chartComponent.chart.canvas.style.width = '100%';
        chartComponent.chart.resize();
        chartComponent.chart.update('none');
      }

      if (typeof chartComponent.reinit === 'function') {
        chartComponent.reinit();
      }
    });
  }

  private initResizeObserver(): void {
    if (typeof window === 'undefined' || !(window as any).ResizeObserver) {
      return;
    }

    this.teardownResizeObserver();

    const NativeResizeObserver = (window as any).ResizeObserver;
    this.resizeObserver = new NativeResizeObserver(() => {
      this.scheduleChartRefresh(100);
    });

    // Observe all chart containers
    this.chartContainers.forEach(container => {
      if (container?.nativeElement) {
        this.resizeObserver.observe(container.nativeElement);
      }
    });
  }

  private teardownResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }

  private loadData(): void {
    this.isLoading = true;

    const totalStats$ = this.isCompany
      ? this.salesService.getCompanyTotalStatistics()
      : this.salesService.getInsighterTotalStatistics();

    const periodStats$ = this.isCompany
      ? this.salesService.getCompanyPeriodStatistics(this.selectedPeriod)
      : this.salesService.getInsighterPeriodStatistics(this.selectedPeriod);

    forkJoin([totalStats$, periodStats$])
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: ([totalResponse, periodResponse]) => {
          this.totalStatistics = totalResponse.data;
          this.periodStatistics = periodResponse.data;
          this.setupCharts();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Sales Component - Error loading data:', error);
          this.handleServerErrors(error);
          this.isLoading = false;
        }
      });
  }

  private loadPeriodStatistics(): void {
    this.isLoading = true;

    const periodStats$ = this.isCompany
      ? this.salesService.getCompanyPeriodStatistics(this.selectedPeriod)
      : this.salesService.getInsighterPeriodStatistics(this.selectedPeriod);


    periodStats$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (response) => {
          this.periodStatistics = response.data;
          this.setupRevenueChart();
          this.isLoading = false;
        },
        error: (error) => {
          this.handleServerErrors(error);
          this.isLoading = false;
        }
      });
  }

  private setupCharts(): void {
    this.setupRevenueChart();
    if (this.isCompany) {
      this.setupKnowledgeChart();
      this.setupMeetingChart();
    }
  }

  private setupRevenueChart(): void {
    if (!this.periodStatistics) return;

    const labels = Object.keys(this.periodStatistics.order_statistics);
    const knowledgeData = labels.map(label => {
      const amount = this.periodStatistics!.knowledge_order_statistics[label]?.orders_amount || 0;
      return Math.max(0, amount); // Ensure no negative values
    });
    const meetingData = labels.map(label => {
      const amount = this.periodStatistics!.meeting_booking_order_statistics[label]?.orders_amount || 0;
      return Math.max(0, amount); // Ensure no negative values
    });

    // Create gradients function
    const createGradient = (ctx: CanvasRenderingContext2D, color1: string, color2: string) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, color1);
      gradient.addColorStop(1, color2);
      return gradient;
    };

    this.revenueChartData = {
      labels: labels,
      datasets: [
        {
          label: this.getText('KNOWLEDGE'),
          data: knowledgeData,
          borderColor: '#3799FF',
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            const {ctx: canvasCtx} = chart;
            return createGradient(canvasCtx, 'rgba(55, 153, 255, 0.3)', 'rgba(55, 153, 255, 0)');
          },
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3799FF',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#3799FF',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3
        },
        {
          label: this.getText('MEETINGS'),
          data: meetingData,
          borderColor: '#50C878',
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            const {ctx: canvasCtx} = chart;
            return createGradient(canvasCtx, 'rgba(80, 200, 120, 0.2)', 'rgba(80, 200, 120, 0)');
          },
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#50C878',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#50C878',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3
        }
      ]
    };

    this.revenueChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (_event: any, activeElements: any[], chart: any) => {
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
            label: (context: any) => {
              return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
            }
          }
        },
        annotation: {
          annotations: this.createVerticalAnnotations(labels)
        }
      },
      scales: {
        x: {
          grid: {
            color: '#f3f4f6',
            lineWidth: 1,
            drawBorder: false
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            }
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
              return '$' + value.toLocaleString();
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

  private setupKnowledgeChart(): void {
    if (!this.totalStatistics?.knowledge_order_statistics.company_insighter_orders_statistics) return;

    const data = this.totalStatistics.knowledge_order_statistics.company_insighter_orders_statistics;
    const labels = data.map(item => item.insighter_name);
    const amounts = data.map(item => Math.max(0, item.total_amount)); // Ensure no negative values

    this.knowledgeChartData = {
      labels: labels,
      datasets: [
        {
          label: this.getText('TOTAL_AMOUNT'),
          data: amounts,
          backgroundColor: [
            '#3b82f6',
            '#6366f1',
            '#8b5cf6',
            '#a855f7',
            '#d946ef'
          ],
          borderColor: [
            '#2563eb',
            '#4f46e5',
            '#7c3aed',
            '#9333ea',
            '#c026d3'
          ],
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 40
        }
      ]
    };

    this.knowledgeChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
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
          callbacks: {
            label: (context: any) => {
              return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          border: {
            display: false
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: '#f3f4f6',
            borderDash: [3, 3]
          },
          border: {
            display: false
          },
          beginAtZero: true,
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            },
            callback: function(value: any) {
              return '$' + value.toLocaleString();
            }
          }
        }
      }
    };
  }

  private setupMeetingChart(): void {
    if (!this.totalStatistics?.meeting_booking_order_statistics.company_insighter_orders_statistics) return;

    const data = this.totalStatistics.meeting_booking_order_statistics.company_insighter_orders_statistics;
    const labels = data.map(item => item.insighter_name);
    const amounts = data.map(item => Math.max(0, item.total_amount)); // Ensure no negative values

    this.meetingChartData = {
      labels: labels,
      datasets: [
        {
          label: this.getText('TOTAL_AMOUNT'),
          data: amounts,
          backgroundColor: [
            '#10b981',
            '#06b6d4',
            '#3b82f6',
            '#8b5cf6',
            '#f59e0b'
          ],
          borderColor: [
            '#059669',
            '#0891b2',
            '#2563eb',
            '#7c3aed',
            '#d97706'
          ],
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 40
        }
      ]
    };

    this.meetingChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
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
          callbacks: {
            label: (context: any) => {
              return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          border: {
            display: false
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: '#f3f4f6',
            borderDash: [3, 3]
          },
          border: {
            display: false
          },
          beginAtZero: true,
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            },
            callback: function(value: any) {
              return '$' + value.toLocaleString();
            }
          }
        }
      }
    };

    this.scheduleChartRefresh();
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
          this.lang === "ar" ? "تحذير غير متوقع" : "An unexpected warning occurred."
        );
      } else {
        this.showError(
          this.lang === "ar" ? "حدث خطأ" : "An error occurred",
          this.lang === "ar" ? "حدث خطأ غير متوقع" : "An unexpected error occurred."
        );
      }
    }
  }

  private createVerticalAnnotations(labels: string[]): any {
    if (!labels || labels.length === 0) {
      return {};
    }

    const annotations: any = {};

    labels.forEach((_, index) => {
      annotations[`verticalLine${index}`] = {
        type: 'line',
        scaleID: 'x',
        value: index,
        borderColor: 'rgba(209, 213, 219, 0)',
        borderWidth: 1,
        borderDash: [3, 3],
        label: {
          display: false
        }
      };
    });

    return annotations;
  }

  private updateHoverAnnotation(chart: any, dataIndex: number): void {
    if (!chart || !chart.options.plugins.annotation) {
      return;
    }

    const annotations = chart.options.plugins.annotation.annotations;

    Object.keys(annotations).forEach(key => {
      if (key.startsWith('verticalLine')) {
        annotations[key].borderColor = 'rgba(209, 213, 219, 0)';
      }
    });

    const hoveredAnnotation = annotations[`verticalLine${dataIndex}`];
    if (hoveredAnnotation) {
      hoveredAnnotation.borderColor = '#6b7280';
      hoveredAnnotation.borderWidth = 2;
    }

    chart.update('none');
  }

  private clearHoverAnnotation(chart: any): void {
    if (!chart || !chart.options.plugins.annotation) {
      return;
    }

    const annotations = chart.options.plugins.annotation.annotations;

    Object.keys(annotations).forEach(key => {
      if (key.startsWith('verticalLine')) {
        annotations[key].borderColor = 'rgba(209, 213, 219, 0)';
        annotations[key].borderWidth = 1;
      }
    });

    chart.update('none');
  }

  exportToExcel(): void {
    if (!this.periodStatistics) {
      this.showWarn(
        this.lang === 'ar' ? 'تحذير' : 'Warning',
        this.lang === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data available to export'
      );
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // Get period labels (Mon, Tue, Wed... or Week 1, Week 2... or Jan, Feb, Mar...)
      const periodLabels = Object.keys(this.periodStatistics.order_statistics);

      // Overall Order Statistics Sheet
      const overallHeaders = [
        this.lang === 'ar' ? 'الفترة' : 'Period',
        this.getText('TOTAL_ORDERS'),
        this.getText('ORDERS_REVENUE'),
        this.isCompany ? this.getText('COMPANY_NET_PROFIT') : this.getText('NET_PROFIT')
      ];

      const overallData = [
        overallHeaders,
        ...periodLabels.map(period => [
          period,
          this.periodStatistics!.order_statistics[period]?.orders_total || 0,
          `$${this.periodStatistics!.order_statistics[period]?.orders_amount || 0}`,
          `$${this.isCompany
            ? this.periodStatistics!.order_statistics[period]?.company_orders_amount || 0
            : this.periodStatistics!.order_statistics[period]?.insighter_orders_amount || 0}`
        ])
      ];

      const overallWS = XLSX.utils.aoa_to_sheet(overallData);
      XLSX.utils.book_append_sheet(workbook, overallWS, this.lang === 'ar' ? 'إحصائيات_الطلبات' : 'Order_Statistics');

      // Knowledge Order Statistics Sheet
      const knowledgeHeaders = [
        this.lang === 'ar' ? 'الفترة' : 'Period',
        this.getText('TOTAL_ORDERS'),
        this.getText('ORDERS_REVENUE'),
        this.isCompany ? this.getText('COMPANY_NET_PROFIT') : this.getText('NET_PROFIT')
      ];

      const knowledgeData = [
        knowledgeHeaders,
        ...periodLabels.map(period => [
          period,
          this.periodStatistics!.knowledge_order_statistics[period]?.orders_total || 0,
          `$${this.periodStatistics!.knowledge_order_statistics[period]?.orders_amount || 0}`,
          `$${this.isCompany
            ? this.periodStatistics!.knowledge_order_statistics[period]?.company_orders_amount || 0
            : this.periodStatistics!.knowledge_order_statistics[period]?.insighter_orders_amount || 0}`
        ])
      ];

      const knowledgeWS = XLSX.utils.aoa_to_sheet(knowledgeData);
      XLSX.utils.book_append_sheet(workbook, knowledgeWS, this.lang === 'ar' ? 'طلبات_المعرفة' : 'Knowledge_Orders');

      // Meeting Order Statistics Sheet
      const meetingHeaders = [
        this.lang === 'ar' ? 'الفترة' : 'Period',
        this.getText('TOTAL_ORDERS'),
        this.getText('ORDERS_REVENUE'),
        this.isCompany ? this.getText('COMPANY_NET_PROFIT') : this.getText('NET_PROFIT')
      ];

      const meetingData = [
        meetingHeaders,
        ...periodLabels.map(period => [
          period,
          this.periodStatistics!.meeting_booking_order_statistics[period]?.orders_total || 0,
          `$${this.periodStatistics!.meeting_booking_order_statistics[period]?.orders_amount || 0}`,
          `$${this.isCompany
            ? this.periodStatistics!.meeting_booking_order_statistics[period]?.company_orders_amount || 0
            : this.periodStatistics!.meeting_booking_order_statistics[period]?.insighter_orders_amount || 0}`
        ])
      ];

      const meetingWS = XLSX.utils.aoa_to_sheet(meetingData);
      XLSX.utils.book_append_sheet(workbook, meetingWS, this.lang === 'ar' ? 'طلبات_الاجتماعات' : 'Meeting_Orders');

      // Generate filename with current date and period
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split('T')[0];
      const periodText = this.selectedPeriod.charAt(0).toUpperCase() + this.selectedPeriod.slice(1);
      const fileName = `${this.lang === 'ar' ? 'تقرير_المبيعات' : 'sales_report'}_${periodText}_${dateString}.xlsx`;

      // Save the file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, fileName);

      this.showSuccess(
        this.lang === 'ar' ? 'نجح التصدير' : 'Export Successful',
        this.lang === 'ar' ? `تم تصدير تقرير ${this.getText(this.selectedPeriod.toUpperCase())} بنجاح` : `${periodText} report exported successfully`
      );
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      this.showError(
        this.lang === 'ar' ? 'خطأ في التصدير' : 'Export Error',
        this.lang === 'ar' ? 'حدث خطأ أثناء تصدير التقرير' : 'An error occurred while exporting the report'
      );
    }
  }

  exportKnowledgeToExcel(): void {
    if (!this.totalStatistics?.knowledge_order_statistics?.company_insighter_orders_statistics) {
      this.showWarn(
        this.lang === 'ar' ? 'تحذير' : 'Warning',
        this.lang === 'ar' ? 'لا توجد بيانات للتصدير' : 'No knowledge orders data available to export'
      );
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // Knowledge Orders Data
      const knowledgeHeaders = [
        this.getText('INSIGHTER_NAME'),
        this.getText('TOTAL_ORDERS'),
        this.getText('TOTAL_AMOUNT'),
        this.getText('COMPANY_PROFIT')
      ];

      const knowledgeData = [
        knowledgeHeaders,
        ...this.totalStatistics.knowledge_order_statistics.company_insighter_orders_statistics.map(item => [
          item.insighter_name,
          item.total_orders,
          `$${item.total_amount}`,
          `$${item.total_insighter_amount}`
        ])
      ];

      const knowledgeWS = XLSX.utils.aoa_to_sheet(knowledgeData);
      XLSX.utils.book_append_sheet(workbook, knowledgeWS, this.lang === 'ar' ? 'طلبات_المعرفة' : 'Knowledge_Orders');

      // Generate filename with current date
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split('T')[0];
      const fileName = `${this.lang === 'ar' ? 'تقرير_طلبات_المعرفة' : 'knowledge_orders_report'}_${dateString}.xlsx`;

      // Save the file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, fileName);

      this.showSuccess(
        this.lang === 'ar' ? 'نجح التصدير' : 'Export Successful',
        this.lang === 'ar' ? 'تم تصدير تقرير طلبات المعرفة بنجاح' : 'Knowledge orders report exported successfully'
      );
    } catch (error) {
      console.error('Error exporting knowledge orders to Excel:', error);
      this.showError(
        this.lang === 'ar' ? 'خطأ في التصدير' : 'Export Error',
        this.lang === 'ar' ? 'حدث خطأ أثناء تصدير التقرير' : 'An error occurred while exporting the report'
      );
    }
  }

  private handleTabFromUrl(): void {
    this.route.queryParams.subscribe(params => {
      const tabParam = params['tab'];
      if (tabParam) {
        const tabMap: { [key: string]: 'analytics' | 'sold-details' | 'sold-meetings' } = {
          '1': 'analytics',
          '2': 'sold-details',
          '3': 'sold-meetings'
        };

        const newTab = tabMap[tabParam];
        if (newTab && newTab !== this.activeTab) {
          this.activeTab = newTab;

          if (newTab === 'sold-details' && this.soldOrders$.value.length === 0) {
            this.loadSoldOrders();
          }
          if (newTab === 'sold-meetings' && this.soldMeetingOrders$.value.length === 0) {
            this.loadSoldMeetingOrders();
          }
        }
      }
    });
  }

  getSalesSubtitle(): string {
    if (this.totalStatistics) {
      return this.lang === 'ar' ? 'تحليل أداء المبيعات' : 'Sales performance analytics';
    }
    return this.lang === 'ar' ? 'تحليل أداء المبيعات' : 'Sales performance analytics';
  }

  exportMeetingToExcel(): void {
    if (!this.totalStatistics?.meeting_booking_order_statistics?.company_insighter_orders_statistics) {
      this.showWarn(
        this.lang === 'ar' ? 'تحذير' : 'Warning',
        this.lang === 'ar' ? 'لا توجد بيانات للتصدير' : 'No meeting orders data available to export'
      );
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // Meeting Orders Data
      const meetingHeaders = [
        this.getText('INSIGHTER_NAME'),
        this.getText('TOTAL_ORDERS'),
        this.getText('TOTAL_AMOUNT'),
        this.getText('COMPANY_PROFIT')
      ];

      const meetingData = [
        meetingHeaders,
        ...this.totalStatistics.meeting_booking_order_statistics.company_insighter_orders_statistics.map(item => [
          item.insighter_name,
          item.total_orders,
          `$${item.total_amount}`,
          `$${item.total_insighter_amount}`
        ])
      ];

      const meetingWS = XLSX.utils.aoa_to_sheet(meetingData);
      XLSX.utils.book_append_sheet(workbook, meetingWS, this.lang === 'ar' ? 'طلبات_الاجتماعات' : 'Meeting_Orders');

      // Generate filename with current date
      const currentDate = new Date();
      const dateString = currentDate.toISOString().split('T')[0];
      const fileName = `${this.lang === 'ar' ? 'تقرير_طلبات_الاجتماعات' : 'meeting_orders_report'}_${dateString}.xlsx`;

      // Save the file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, fileName);

      this.showSuccess(
        this.lang === 'ar' ? 'نجح التصدير' : 'Export Successful',
        this.lang === 'ar' ? 'تم تصدير تقرير طلبات الجلسات الاستشارية بنجاح' : 'Session orders report exported successfully'
      );
    } catch (error) {
      console.error('Error exporting meeting orders to Excel:', error);
      this.showError(
        this.lang === 'ar' ? 'خطأ في التصدير' : 'Export Error',
        this.lang === 'ar' ? 'حدث خطأ أثناء تصدير التقرير' : 'An error occurred while exporting the report'
      );
    }
  }
}