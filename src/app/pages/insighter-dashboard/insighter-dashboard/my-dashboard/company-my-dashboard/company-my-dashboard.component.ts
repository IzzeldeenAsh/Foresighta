import { Component, Injector, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import { BaseComponent } from 'src/app/modules/base.component';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { IKnoldgProfile } from 'src/app/_fake/models/profile.interface';
import { CompanyAccountService, DashboardStatisticsResponse } from 'src/app/_fake/services/company-account/company-account.service';
import { AgreementService } from 'src/app/_fake/services/agreement/agreement.service';

@Component({
  selector: "app-company-my-dashboard",
  templateUrl: "./company-my-dashboard.component.html",
  styleUrls: ["./company-my-dashboard.component.scss"],
})
export class CompanyMyDashboardComponent extends BaseComponent implements OnInit {
  userRole: string = '';
  userProfile: IKnoldgProfile | null = null;
  private destroy$ = new Subject<void>();
  showDonutChart = true;
  showEmployeeStats = true;
  dashboardStats: DashboardStatisticsResponse['data'] | null = null;
  publishedKnowledgeChartData: any = null;
  publishedKnowledgeChartOptions: any = null;
  publishedKnowledgeLegend: Array<{ labelKey: string; color: string }> = [];
  isArabicAndNotRtl: boolean = false;
  needsAgreement: boolean = false;
  showAgreementModal: boolean = false;
  showNotificationPreferencesBanner = false;
  readonly notificationBannerImageUrl =
    "https://res.cloudinary.com/dsiku9ipv/image/upload/v1771139272/whatsappsms_l4scor.png";
  readonly notificationPreferencesRoute = "/app/profile/settings/personal-info";

  private readonly knowledgeTypeColors: Record<string, string> = {
    statistic: '#0a7abf',
    report: '#3b9ae1',
    manual: '#6bb6ff',
    data: '#1e88e5',
    course: '#42a5f5'
  };

  constructor(
    injector: Injector,
    private profileService: ProfileService,
    private router: Router,
    private companyAccountService: CompanyAccountService,
    private agreementService: AgreementService
  ) {
    super(injector);
  }

  goToNotificationPreferences(): void {
    this.router.navigateByUrl(this.notificationPreferencesRoute);
  }

  private computeNotificationBannerVisibility(profile: any): void {
    const whatsappNumber = String(profile?.whatsapp_number ?? "").trim();
    const smsNumber = String(profile?.sms_number ?? "").trim();
    this.showNotificationPreferencesBanner = !(whatsappNumber || smsNumber);
  }

  ngOnInit(): void {
    this.getUserRole();
    this.loadDashboardStatistics();
    const isArabic = this.lang === 'ar';
    const isRtlModeActive = false; 
    this.isArabicAndNotRtl = isArabic && !isRtlModeActive;
    // Check if company accepted the latest agreement
    this.agreementService.checkLatestAgreement().subscribe({
      next: (accepted) => {
        this.needsAgreement = !accepted;
      },
      error: () => {
        this.needsAgreement = true;
      }
    });
  }
  
  getUserRole(): void {
    this.profileService.getProfile().subscribe({
      next: (profile: IKnoldgProfile) => {
        this.userProfile = profile;
        this.computeNotificationBannerVisibility(profile as any);
        if (profile.roles.includes('company')) {
          this.userRole = 'company';
        } else if (profile.roles.includes('client')) {
          this.userRole = 'client';
        } else if (profile.roles.includes('statisticer')) {
          this.userRole = 'statisticer';
        }
      },
      error: (error) => {
        console.error('Error getting user profile:', error);
      }
    });
  }

  onHasMultipleEmployees($event: boolean) {
    this.showEmployeeStats = $event;
    console.log("hasMultipleEmployees", $event);
  }

  onHasMultipleEmployeesDonut($event: boolean) {
    this.showDonutChart = $event;
    console.log("hasMultipleEmployeesDonut", $event);
  }

  loadDashboardStatistics(): void {
    this.companyAccountService.getDashboardStatistics().subscribe({
      next: (data) => {
        this.dashboardStats = data;
        this.setupPublishedKnowledgeChart();
      },
      error: (error) => {
        console.error('Error loading dashboard statistics:', error);
      }
    });
  }

  private setupPublishedKnowledgeChart(): void {
    const stats = this.dashboardStats?.knowledge_published_statistics;
    this.publishedKnowledgeLegend = [];

    if (!stats) {
      this.publishedKnowledgeChartData = null;
      return;
    }

    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];

    Object.entries(stats.type || {}).forEach(([type, count]) => {
      const numericCount = Number(count) || 0;

      if (numericCount > 0) {
        const translationKey = `KNOWLEDGE.${type.toUpperCase()}`;
        const color = this.knowledgeTypeColors[type as keyof typeof this.knowledgeTypeColors] || '#999';
        
        labels.push(type); 
        data.push(numericCount);
        backgroundColors.push(color);

        this.publishedKnowledgeLegend.push({
          labelKey: translationKey,
          color
        });
      }
    });

    if (!data.length) {
      this.publishedKnowledgeChartData = null;
      return;
    }

    this.publishedKnowledgeChartData = {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors,
          borderWidth: 0
        }
      ]
    };

    this.publishedKnowledgeChartOptions = {
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context: any) => `${context.label}: ${context.parsed}`
          }
        }
      },
      maintainAspectRatio: false,
      responsive: true
    };
  }

  get totalPublishedKnowledge(): number {
    return this.dashboardStats?.knowledge_published_statistics?.total ?? 0;
  }
  openAgreementModal(): void {
    this.showAgreementModal = true;
  }
  onAgreementAccepted(): void {
    this.needsAgreement = false;
    this.showAgreementModal = false;
  }
  onAgreementCancelled(): void {
    this.showAgreementModal = false;
  }
}
