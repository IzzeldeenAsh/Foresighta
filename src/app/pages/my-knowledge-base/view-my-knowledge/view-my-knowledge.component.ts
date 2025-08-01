import { Component, Injector, OnInit } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { forkJoin } from "rxjs";
import { Breadcrumb } from "src/app/_fake/models/breadcrumb.model";
import { IKnoldgProfile } from "src/app/_fake/models/profile.interface";
import { AddInsightStepsService, DocumentListResponse, PublishKnowledgeRequest } from "src/app/_fake/services/add-insight-steps/add-insight-steps.service";
import { ProfileService } from "src/app/_fake/services/get-profile/get-profile.service";
import {
  Knowledge,
  KnowledgeService,
} from "src/app/_fake/services/knowledge/knowledge.service";
import { BaseComponent } from "src/app/modules/base.component";
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SchedulePublishDialogComponent } from "./schedule-publish-dialog/schedule-publish-dialog.component";
import Swal from 'sweetalert2';
import { KnowledgeUpdateService } from "src/app/_fake/services/knowledge/knowledge-update.service";
import { UserRequestsService, UserRequest } from "src/app/_fake/services/user-requests/user-requests.service";

@Component({
  selector: "app-view-my-knowledge",
  templateUrl: "./view-my-knowledge.component.html",
  styleUrls: ["./view-my-knowledge.component.scss"],
  providers: [DialogService]
})
export class ViewMyKnowledgeComponent extends BaseComponent implements OnInit {
  breadcrumbs: Breadcrumb[] = [];
  knowledgeId: string;
  knowledge: Knowledge;
  documents: DocumentListResponse;
  isLoading: boolean = false;
  dialogRef: DynamicDialogRef | undefined;
  isShareDialogVisible: boolean = false;
  linkCopied: boolean = false;
  userProfile: IKnoldgProfile;
  isResendReviewDialogVisible: boolean = false;
  reviewComments: string = "";
  showAllMarkets: boolean = false;
  private hasShownLanguageMismatchToast: boolean = false;

  // Request conversation properties
  currentRequest: any = null;
  requestUser: any = null;
  hasChildRequest: boolean = false;
  showConversation: boolean = false;

  constructor(
    injector: Injector,
    private knowledgeService: KnowledgeService,
    private knowledgeUpdateService: KnowledgeUpdateService,
    private route: ActivatedRoute,
    private router: Router,
    private addInsightStepsService: AddInsightStepsService,
    private dialogService: DialogService,
    private profileService: ProfileService,
    private userRequestsService: UserRequestsService
  ) {
    super(injector);
  }

  ngOnInit() {
    this.route.data.subscribe((data) => {
      if (data["breadcrumb"]) {
        this.breadcrumbs = data["breadcrumb"];
      }
    });
    
    const paramsSubscription = this.route.params.subscribe((params: Params) => {
      this.knowledgeId = params["id"];
      if (this.knowledgeId) {
        this.loadKnowledgeData();
        this.loadUserProfile();
        if (this.isCompanyInsighter()) {
          this.loadRequestData();
        }
      }
    });
    
    // Subscribe to knowledge updates
    const updateSubscription = this.knowledgeUpdateService.knowledgeUpdated$.subscribe(() => {
      this.loadKnowledgeData();
    });
    
    this.unsubscribe.push(paramsSubscription, updateSubscription);
  }

  private loadUserProfile(): void {
    const profileSubscription = this.profileService.getProfile().subscribe(
      (profile: IKnoldgProfile) => {
        this.userProfile = profile;
        // Load request data if company insighter
        if (this.isCompanyInsighter() && this.knowledgeId) {
          this.loadRequestData();
        }
      }
    );
    this.unsubscribe.push(profileSubscription);
  }

  loadRequestData(): void {
    this.userRequestsService.getAllUserRequests(this.lang)
      .subscribe({
        next: (requests: UserRequest[]) => {
          // Filter requests for the current knowledge ID and accept_knowledge type
          const relevantRequests = requests.filter(request => 
            request.identity === this.knowledgeId && 
            request.type && 
            request.type.key === 'accept_knowledge'
          );
          
          if (relevantRequests.length > 0) {
            // Store the current request for reference
            this.currentRequest = relevantRequests[0];
            this.requestUser = this.currentRequest.requestable;
            this.hasChildRequest = this.hasChildrenRequests(this.currentRequest);
            this.showConversation = true;
            
            console.log('Request found:', this.currentRequest);
          } else {
            this.currentRequest = null;
            this.requestUser = null;
            this.hasChildRequest = false;
            this.showConversation = false;
          }
        },
        error: (error) => {
          this.handleServerErrors(error);
        }
      });
  }

  /**
   * Recursively check if a request has any children requests
   */
  private hasChildrenRequests(request: any): boolean {
    return request && request.children && request.children.length > 0;
  }

  toggleConversation(): void {
    this.showConversation = !this.showConversation;
  }

  public loadKnowledgeData(): void {
    this.isLoading = true;
    const knowledgeSubscription = forkJoin({
      knowledge: this.knowledgeService.getKnowledgeById(
        Number(this.knowledgeId)
      ),
      documents: this.knowledgeService.getListDocumentsInfo(
        Number(this.knowledgeId)
      ),
    }).subscribe({
      next: (response) => {
        this.knowledge = response.knowledge.data;
        this.documents = response.documents;
        this.isLoading = false;
        
        // Check for language mismatch after knowledge is loaded
        this.checkLanguageMismatch();
      },
      error: (error) => {
        this.handleServerErrors(error);
        this.isLoading = false;
      },
    });
    this.unsubscribe.push(knowledgeSubscription);
  }

  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
         this.showError('',messages.join(", "));
        }
      }
    } else {
      this.showError('','An unexpected error occurred.');
    }
  }

  isCompanyInsighter(): boolean {
    if (!this.userProfile || !this.userProfile.roles) {
      return false;
    }
    return this.userProfile.roles.includes('company-insighter');
  }

  needsReview(): boolean {
    return this.knowledge && this.knowledge.account_manager_process && this.knowledge.account_manager_process.need_to_review === true;
  }
  
  hasReviewRequest(): boolean {
    return this.knowledge && 
           this.knowledge.account_manager_process && 
           this.knowledge.account_manager_process.need_to_review === true && 
           this.knowledge.account_manager_process.action === 'resend_review';
  }
  
  isPendingResendReview(): boolean {
    return this.knowledge && 
           this.knowledge.account_manager_process && 
           this.knowledge.account_manager_process.need_to_review === true && 
           this.knowledge.account_manager_process.action === 'resend_review' && 
           this.knowledge.account_manager_process.request_status === 'pending';
  }

  sendToReview(): void {
    Swal.fire({
      title: this.lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
      text: this.lang === 'ar' ? "أنت على وشك إرسال هذه المعرفة للمراجعة" : "You are about to send this knowledge for review",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.lang === 'ar' ? 'نعم، أرسل للمراجعة!' : 'Yes, send for review!',
      cancelButtonText: this.lang === 'ar' ? 'إلغاء' : 'Cancel',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-light'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        const request: PublishKnowledgeRequest = {
          status: 'in_review',
          published_at: ''
        };
        
        this.addInsightStepsService.publishKnowledge(Number(this.knowledgeId), request)
          .subscribe({
            next: () => {
              this.loadKnowledgeData();
              this.showSuccess('Knowledge has been sent for review', 'Success');
            },
            error: (error) => {
              this.handleServerErrors(error);
            }
          });
      }
    });
  }
  
  openResendReviewDialog(): void {
    this.isResendReviewDialogVisible = true;
    this.reviewComments = '';
  }
  
  closeResendReviewDialog(): void {
    this.isResendReviewDialogVisible = false;
  }
  
  resendReview(): void {
    if (!this.reviewComments) {
      this.showWarn('', 'Please enter comments before submitting');
      return;
    }
    
    if (!this.knowledge?.account_manager_process?.request_id) {
      this.showError('', 'No request ID found');
      return;
    }
    
    this.isLoading = true;
    
    this.userRequestsService.sendKnowledgeReviewRequest(
      this.reviewComments,
      this.knowledge.account_manager_process.request_id.toString(),
      this.knowledgeId
    ).subscribe({
      next: () => {
        this.isLoading = false;
        this.isResendReviewDialogVisible = false;
        this.showSuccess('', 'Review request has been sent');
        this.router.navigate(['/app/insighter-dashboard/my-requests']);
      },
      error: (error) => {
        this.isLoading = false;
        this.handleServerErrors(error);
      }
    });
  }

  confirmPublish(): void {
    Swal.fire({
      title: this.lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
      text: this.lang === 'ar' ? "أنت على وشك نشر هذه المعرفة" : "You are about to publish this knowledge",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.lang === 'ar' ? 'نعم، انشرها!' : 'Yes, publish it!',
      cancelButtonText: this.lang === 'ar' ? 'إلغاء' : 'Cancel',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-light'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.publishKnowledge();
      }
    });
  }

  confirmUnpublish(): void {
    Swal.fire({
      title: this.lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
      text: this.lang === 'ar' ? "أنت على وشك إلغاء نشر هذه المعرفة" : "You are about to unpublish this knowledge",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.lang === 'ar' ? 'نعم، قم بإلغاء نشرها!' : 'Yes, unpublish it!',
      cancelButtonText: this.lang === 'ar' ? 'إلغاء' : 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-light'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.unpublishKnowledge();
      }
    });
  }

  confirmDelete(): void {
    Swal.fire({
      title: this.lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
      text: this.lang === 'ar' ? "لن تتمكن من استعادة هذا!" : "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: this.lang === 'ar' ? 'نعم، احذفها!' : 'Yes, delete it!',
      cancelButtonText: this.lang === 'ar' ? 'إلغاء' : 'Cancel',
      customClass: {
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-light'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteKnowledge();
      }
    });
  }

  deleteKnowledge(): void {
    this.isLoading = true;
    this.knowledgeService.deleteKnowledge(Number(this.knowledgeId)).subscribe(
      () => {
        this.showSuccess('Knowledge has been deleted.', 'Success');
        // Navigate back to the knowledge list
        this.router.navigate(['/app/insighter-dashboard/my-knowledge/general']);
      },
      (error) => {
        this.isLoading = false;
        this.handleServerErrors(error);
      }
    );
  }

  publishKnowledge(): void {
    const request: PublishKnowledgeRequest = {
      status: 'published',
      published_at: new Date().toISOString()
    };
    
    this.addInsightStepsService.publishKnowledge(Number(this.knowledgeId), request)
      .subscribe({
        next: () => {
          this.loadKnowledgeData();
        },
        error: (error) => {
          this.handleServerErrors(error);
        }
      });
  }

  unpublishKnowledge(): void {
    const request: PublishKnowledgeRequest = {
      status: 'unpublished',
      published_at: ''
    };
    
    this.addInsightStepsService.publishKnowledge(Number(this.knowledgeId), request)
      .subscribe({
        next: () => {
          this.loadKnowledgeData();
        },
        error: (error) => {
          this.handleServerErrors(error);
        }
      });
  }

  openScheduleDialog(): void {
    this.dialogRef = this.dialogService.open(SchedulePublishDialogComponent, {
      header: 'Schedule Publication',
      width: '50vw',
      contentStyle: { overflow: 'visible' },
      baseZIndex: 10000,
      data: { published_at: this.knowledge.published_at },
      appendTo: 'body'
    });

    this.dialogRef.onClose.subscribe(result => {
      if (result) {
        const request: PublishKnowledgeRequest = {
          status: 'scheduled',
          published_at: result.publishDate
        };
        
        this.addInsightStepsService.publishKnowledge(Number(this.knowledgeId), request)
          .subscribe({
            next: () => {
              this.loadKnowledgeData();
            },
            error: (error) => {
              this.handleServerErrors(error);
            }
          });
      }
    });
  }

  publishAs(type: 'both' | 'package'): void {
    Swal.fire({
      title: this.lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
      text: type === 'package' ? 
        (this.lang === 'ar' ? 'سيجعل هذا المعرفة متاحة في الحزم فقط' : 'This will make the knowledge available in packages only') : 
        (this.lang === 'ar' ? 'سيجعل هذا المعرفة متاحة بشكل مستقل وفي الحزم' : 'This will make the knowledge available both standalone and in packages'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.lang === 'ar' ? 'نعم، تابع!' : 'Yes, proceed!',
      cancelButtonText: this.lang === 'ar' ? 'إلغاء' : 'Cancel',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-light'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.knowledgeService.publishAs(Number(this.knowledgeId), type)
          .subscribe({
            next: () => {
              this.loadKnowledgeData();
              this.showSuccess('', 'Publishing options updated successfully');
            },
            error: (error) => {
              this.handleServerErrors(error);
            }
          });
      }
    });
  }

  hasRequiredFields(): boolean {
    if (!this.knowledge) return false;
    if (!this.documents || !this.documents.data || this.documents.data.length === 0) return false;
    
    // Check for all required fields
    return !!(
      this.knowledge.title &&
      this.knowledge.description &&
      this.knowledge.topic &&
      this.knowledge.industry &&
      this.knowledge.language &&
      (
        (this.knowledge.countries && this.knowledge.countries.length > 0) ||
        (this.knowledge.regions && this.knowledge.regions.length > 0) ||
        (this.knowledge.economic_blocs && this.knowledge.economic_blocs.length > 0)
      ) &&
      this.knowledge.keywords &&
      this.knowledge.tags && 
      this.knowledge.tags.length > 0
    );
  }

  navigateToEdit(): void {
    this.router.navigate(['/app/edit-knowledge/stepper', this.knowledge.id]);
  }

  openShareDialog(): void {
    this.isShareDialogVisible = true;
    this.linkCopied = false;
  }

  getSocialShareLink(platform: string): string {
    const shareUrl = this.getShareableLink();
    const title = encodeURIComponent(this.knowledge.title || 'Check out this knowledge');
    
    switch(platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${title}&url=${encodeURIComponent(shareUrl)}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${title}%20${encodeURIComponent(shareUrl)}`;
      default:
        return '';
    }
  }

  getShareableLink(): string {
    const knowledgeType = this.knowledge.type?.toLowerCase() || 'insight';
    const slug = this.knowledge.slug || '';
    return `https://knoldg.com/en/knowledge/${knowledgeType}/${slug}`;
  }

  copyLink(inputElement: HTMLInputElement): void {
    inputElement.select();
    document.execCommand('copy');
    this.linkCopied = true;
    
    // Reset the "copied" message after 3 seconds
    setTimeout(() => {
      this.linkCopied = false;
    }, 3000);
  }

  /**
   * Copy text directly to clipboard without requiring an input element
   * @param text Text to copy to clipboard
   */
  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.linkCopied = true;
      setTimeout(() => {
        this.linkCopied = false;
      }, 3000);
    });
  }

  /**
   * Get total number of target market items across all categories
   */
  getTotalMarketItems(): number {
    let total = 0;
    if (this.knowledge) {
      total += this.knowledge.economic_blocs?.length || 0;
      // Only count regions if we don't have "Worldwide" selected
      if (!(this.knowledge.regions && this.knowledge.regions.length === 6)) {
        total += this.knowledge.regions?.length || 0;
      }
      total += this.knowledge.countries?.length || 0;
    }
    return total;
  }

  /**
   * Calculate how many market items are visible in the collapsed state
   */
  getVisibleMarketItemsCount(): number {
    let count = 0;
    if (this.knowledge) {
      // For economic blocs, show up to 2 in collapsed state
      count += Math.min(this.knowledge.economic_blocs?.length || 0, 2);
      
      // For regions, show 1 if we have economic blocs, otherwise 2
      const regionsToShow = this.knowledge.economic_blocs?.length ? 1 : 2;
      count += Math.min(this.knowledge.regions?.length || 0, regionsToShow);
      
      // For countries, show 1 if we have either economic blocs or regions, otherwise 2
      const countriesToShow = (this.knowledge.economic_blocs?.length || this.knowledge.regions?.length) ? 1 : 2;
      count += Math.min(this.knowledge.countries?.length || 0, countriesToShow);
    }
    return count;
  }

  /**
   * Check if knowledge language matches current locale and show toast if different
   */
  private checkLanguageMismatch(): void {
    if (!this.knowledge || !this.knowledge.language || this.hasShownLanguageMismatchToast) {
      return;
    }

    const knowledgeLanguage = this.knowledge.language.toLowerCase();
    const currentLocale = this.lang.toLowerCase();
    
    // Map knowledge language to locale format
    const languageMap: { [key: string]: string } = {
      'arabic': 'ar',
      'english': 'en',
      'ar': 'ar',
      'en': 'en'
    };
    
    const mappedKnowledgeLanguage = languageMap[knowledgeLanguage] || knowledgeLanguage;
    
    if (mappedKnowledgeLanguage !== currentLocale) {
      const targetLanguage = mappedKnowledgeLanguage === 'ar' ? 'Arabic' : 'English';
      const message = this.lang === 'ar' 
        ? `للحصول على قراءة أفضل، يُفضل التبديل إلى اللغة ${mappedKnowledgeLanguage === 'ar' ? 'العربية' : 'الإنجليزية'}`
        : `For better readability, it's recommended to switch to ${targetLanguage}`;
      
      this.showInfo('', message);
      this.hasShownLanguageMismatchToast = true;
    }
  }
}
