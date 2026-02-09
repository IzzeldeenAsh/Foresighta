import { Component, Injector, OnInit, OnDestroy } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { SentMeetingsService, SentMeeting, SentMeetingResponse } from 'src/app/_fake/services/meetings/sent-meetings.service';
import { WalletService } from 'src/app/_fake/services/wallet/wallet.service';
import { Subject, takeUntil } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-client-my-dashboard',
  templateUrl: './client-my-dashboard.component.html',
  styleUrl: './client-my-dashboard.component.scss'
})
export class ClientMyDashboardComponent extends BaseComponent implements OnInit, OnDestroy {
  todayMeetingsCount: number = 0;
  sentMeetings: SentMeeting[] = [];
  expertsCount: number = 1250;
  // topIndustries: string[] = ['Technology', 'Healthcare', 'Finance', 'Education', 'Marketing'];
  topIndustries: string[] = [
  'TOP_INDUSTRIES.TECHNOLOGY',
  'TOP_INDUSTRIES.HEALTHCARE',
  'TOP_INDUSTRIES.FINANCE',
  'TOP_INDUSTRIES.EDUCATION',
  'TOP_INDUSTRIES.MARKETING'
];
  knowledgeLinks = [
    { type: 'data',    translationKey: 'KNOWLEDGE.DATA',    descriptionKey: 'KNOWLEDGE.DATA_DESCRIPTION' },
    { type: 'report',  translationKey: 'KNOWLEDGE.REPORT',  descriptionKey: 'KNOWLEDGE.REPORT_DESCRIPTION' },
    { type: 'statistic', translationKey: 'KNOWLEDGE.STATISTIC', descriptionKey: 'KNOWLEDGE.INSIGHT_DESCRIPTION' },
    { type: 'manual',  translationKey: 'KNOWLEDGE.MANUAL',  descriptionKey: 'KNOWLEDGE.MANUAL_DESCRIPTION' },
    { type: 'course',  translationKey: 'KNOWLEDGE.COURSE',  descriptionKey: 'KNOWLEDGE.COURSE_DESCRIPTION' },
  ];
  walletBalance: number = 0;
  isLoadingBalance: boolean = true;
  private destroy$ = new Subject<void>();
  private readonly knowledgeTranslations = {
    en: {
      KNOWLEDGE: {
        TITLE: 'Latest Insights',
        DATA: 'Data',
        DATA_DESCRIPTION: 'Explore recently added datasets and figures.',
        STATISTIC: 'Statistics',
        INSIGHT_DESCRIPTION: 'Review the newest analyst statistics and findings.',
        MANUAL: 'Manuals',
        MANUAL_DESCRIPTION: 'Quick guides to help you apply best practices.',
        COURSE: 'Courses',
        COURSE_DESCRIPTION: 'Learning paths curated for your growth.',
        REPORT: 'Reports',
        REPORT_DESCRIPTION: 'Download the latest research and reports.'
      }
    },
    ar: {
      KNOWLEDGE: {
        TITLE: 'أحدث مصادر المعرفة',
        DATA: 'بيانات',
        DATA_DESCRIPTION: 'استكشف أحدث مجموعات البيانات والأرقام.',
        STATISTIC: 'إحصائيات',
        INSIGHT_DESCRIPTION: 'اطلع على أحدث الإحصائيات والاستنتاجات.',
        MANUAL: 'أدلة إرشادية',
        MANUAL_DESCRIPTION: 'أدلة سريعة لتطبيق أفضل الممارسات.',
        COURSE: 'دورات تدريبية',
        COURSE_DESCRIPTION: 'مسارات تعليمية مختارة لتطويرك.',
        REPORT: 'تقارير',
        REPORT_DESCRIPTION: 'قم بتنزيل أحدث التقارير والدراسات.'
      }
    }
  };

  constructor(
    injector: Injector,
    private sentMeetingsService: SentMeetingsService,
    private walletService: WalletService,
    private translateService: TranslateService
  ) {
    super(injector)
  }

  ngOnInit(): void {
    this.registerKnowledgeTranslations();
    this.loadTodayMeetings();
    this.loadWalletBalance();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTodayMeetings(): void {
    this.sentMeetingsService.getSentMeetings(1, 30)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: SentMeetingResponse) => {
          this.sentMeetings = response.data;
          
          // Calculate number of today's meetings
          const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
          this.todayMeetingsCount = this.sentMeetings.filter(meeting => meeting.date === today).length;
        },
        error: (error) => {
          console.error("Error loading sent meetings:", error);
          this.todayMeetingsCount = 0;
        },
      });
  }


  redirectToExperts(): void {
    window.open(`https://insightabusiness.com/${this.lang}/home?search_type=insighter&accuracy=any`, '_blank');
  }
  redirectToKnowledge(type: string): void {
    const currentLang = this.lang; 
    
    window.open(`https://insightabusiness.com/${currentLang}/home?search_type=knowledge&type=${type}`, '_blank');
  }

  loadWalletBalance(): void {
    this.walletService.getBalance()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (balance: number) => {
          this.walletBalance = balance;
          this.isLoadingBalance = false;
        },
        error: (error) => {
          console.error("Error loading wallet balance:", error);
          this.walletBalance = 0;
          this.isLoadingBalance = false;
        },
      });
  }

  private registerKnowledgeTranslations(): void {
    Object.entries(this.knowledgeTranslations).forEach(([lang, messages]) => {
      this.translateService.setTranslation(lang, messages, true);
    });
  }

}
