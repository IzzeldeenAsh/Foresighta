import { Component, Injector, OnInit } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { forkJoin } from "rxjs";
import { Breadcrumb } from "src/app/_fake/models/breadcrumb.model";
import { DocumentListResponse } from "src/app/_fake/services/add-insight-steps/add-insight-steps.service";
import { Knowledge, KnowledgeService } from "src/app/_fake/services/knowledge/knowledge.service";
import { BaseComponent } from "src/app/modules/base.component";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import Swal from 'sweetalert2';
import { TranslationService } from "src/app/modules/i18n";
import { UserRequestsService, UserRequest } from "src/app/_fake/services/user-requests/user-requests.service";

@Component({
  selector: "app-review-insighter-knowledge",
  templateUrl: "./review-insighter-knowledge.component.html",
  styleUrls: ["./review-insighter-knowledge.component.scss"]
})
export class ReviewInsighterKnowledgeComponent extends BaseComponent implements OnInit {
  breadcrumbs: Breadcrumb[] = [];
  knowledgeId: string;
  requestId: string;
  knowledge: Knowledge;
  documents: DocumentListResponse;
  isLoading: boolean = false;
  staffNotes: string = '';
  staffNotesInvalid: boolean = false;
  showReviewBox: boolean = true;
  knowledgeRequests: UserRequest[] = [];
  currentRequest: any = null;
  hasChildRequest: boolean = false;
  childRequest: any = null;
  requestUser: any = null;
  pendingRequest: any = null;
  statusRequestString: { en: string; ar: string } = { en: '', ar: '' };
  isSocialShareModalVisible: boolean = false;
  customShareMessage: string = '';
  linkCopied: boolean = false;
  navigateAfterShareClose: boolean = false;

  constructor(
    injector: Injector,
    private knowledgeService: KnowledgeService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
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
        this.checkRequestStatus();
      }
    });
    
    // Get request ID from query parameters
    this.route.queryParams.subscribe(params => {
      this.requestId = params['requestId'];
      console.log('Request ID from query params:', this.requestId);
    });
    
    this.unsubscribe.push(paramsSubscription);
  }

  checkRequestStatus(): void {
    this.userRequestsService.getInsighterRequests(this.lang)
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
            
            // Find the pending request in the entire tree
            this.pendingRequest = this.findPendingRequest(this.currentRequest);
            
            // Only show the review box if there is a pending request
            this.showReviewBox = !!this.pendingRequest;
            
            console.log('Root request:', this.currentRequest);
            console.log('Pending request:', this.pendingRequest);
            console.log('Show review box:', this.showReviewBox);
            if(this.currentRequest.comments == "Accept Knowledge Request"){
              this.statusRequestString = { en: 'Approve to Publish', ar: "طلب موافقة على النشر" };
            }
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

  /**
   * Recursively find a pending request in the tree
   */
  private findPendingRequest(request: any): any {
    // Check if the current request is pending
    if (request.status === 'pending') {
      return request;
    }
    
    // If this request has children, check each child
    if (this.hasChildrenRequests(request)) {
      for (const child of request.children) {
        const pendingChild = this.findPendingRequest(child);
        if (pendingChild) {
          return pendingChild;
        }
      }
    }
    
    // No pending request found in this branch
    return null;
  }

  public loadKnowledgeData(): void {
    this.isLoading = true;
    
    // Define headers for the request
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.lang,
    });
    
    // Using the company API endpoint for getting knowledge
    const knowledgeSubscription = this.http.get<any>(`https://api.insightabusiness.com/api/company/library/knowledge/${this.knowledgeId}`, { headers })
      .subscribe({
        next: (response) => {
          this.knowledge = response.data;
          // Get documents info from the knowledge service
          this.knowledgeService.getReviewDocumentsList(Number(this.knowledgeId))
            .subscribe({
              next: (documentsResponse) => {
                this.documents = documentsResponse;
                this.isLoading = false;
              },
              error: (error) => {
                this.handleServerErrors(error);
                this.isLoading = false;
              }
            });
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
          if (error.error.type === "warning") {
            this.showWarn('', messages.join(", "));
          } else {
            this.showError('', messages.join(", "));
          }
        }
      }
    } else {
      if (error.error && error.error.type === "warning") {
        this.showWarn('','An unexpected warning occurred.');
      } else {
        this.showError('','An unexpected error occurred.');
      }
    }
  }

  approveKnowledge(): void {
    this.confirmAction('approve');
  }

  rejectKnowledge(): void {
    // Partial reject (allows resubmission)
    if (!this.ensureStaffNotesForRejection()) return;
    this.confirmAction('decline');
  }

  totalRejectKnowledge(): void {
    // Final reject (no resubmission allowed)
    if (!this.ensureStaffNotesForRejection()) return;
    this.confirmAction('reject');
  }

  private ensureStaffNotesForRejection(): boolean {
    if (!this.staffNotes || this.staffNotes.trim() === '') {
      const errorMessage =
        this.lang === 'ar'
          ? 'يرجى إضافة ملاحظات للمستبصر قبل الرفض.'
          : 'Please add notes to the Insighter before rejecting.';

      this.showError('', errorMessage);
      this.staffNotesInvalid = true;

      setTimeout(() => {
        const textareaElement = document.querySelector('.notes-textarea') as HTMLElement;
        textareaElement?.focus();
      }, 100);

      return false;
    }

    this.staffNotesInvalid = false;
    return true;
  }

  confirmAction(status: 'approve' | 'decline' | 'reject'): void {
    const actionIcon = status === 'approve' ? 'success' : status === 'reject' ? 'error' : 'warning';
    const actionButtonClass =
      status === 'approve'
        ? 'btn btn-success fw-bold px-10'
        : 'btn btn-danger fw-bold px-10';
    
    // Arabic translations
    const arMessages = {
      approve: {
        title: 'هل أنت متأكد أنك تريد الموافقة على هذه المعرفة؟',
        text: 'أنت على وشك الموافقة على تقديم هذه المعرفة.',
        confirmButton: 'نعم، وافق عليها!',
        cancelButton: 'إلغاء'
      },
      decline: {
        title: 'هل أنت متأكد أنك تريد إرجاع هذه المعرفة؟',
        text: 'أنت على وشك ارجاع هذه المعرفة (مع السماح بإعادة الإرسال).',
        confirmButton: 'نعم، ارجع!',
        cancelButton: 'إلغاء'
      },
      reject: {
        title: 'هل أنت متأكد أنك تريد الرفض النهائي لهذه المعرفة؟',
        text: 'هذا رفض نهائي ولن يُسمح بإرسال متابعة/رد لاحقًا.',
        confirmButton: 'نعم، ارفض نهائياً!',
        cancelButton: 'إلغاء'
      },
    };

    // English messages
    const enMessages = {
      approve: {
        title: 'Are you sure you want to approve this Insight?',
        text: 'You are about to approve this insight submission.',
        confirmButton: 'Yes, approve it!',
        cancelButton: 'Cancel'
      },
      decline: {
        title: 'Are you sure you want to return this insight?',
        text: 'You are about to return this insight submission (resubmission allowed).',
        confirmButton: 'Yes, return it!',
        cancelButton: 'Cancel'
      },
      reject: {
        title: 'Are you sure you want to finally reject this insight?',
        text: 'This is a final rejection and no follow-up response will be allowed.',
        confirmButton: 'Yes, reject it permanently!',
        cancelButton: 'Cancel'
      },
    };

    // Select messages based on language
    const messages = this.lang === 'ar' ? arMessages : enMessages;
    const currentMessages =
      status === 'approve'
        ? messages.approve
        : status === 'decline'
          ? messages.decline
          : messages.reject;
    
    Swal.fire({
      title: currentMessages.title,
      text: currentMessages.text,
      icon: actionIcon as any,
      showCancelButton: true,
      confirmButtonText: currentMessages.confirmButton,
      cancelButtonText: currentMessages.cancelButton,
      customClass: {
        confirmButton: actionButtonClass,
        cancelButton: 'btn btn-light-primary fw-bold px-10'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.submitDecision(status);
      }
    });
  }

  submitDecision(status: 'approve' | 'decline' | 'reject'): void {
    this.isLoading = true;
    
    // Map to the API's expected values
    const apiStatus = status === 'approve' ? 'approved' : status === 'decline' ? 'declined' : 'rejected';
    
    const body = {
      staff_notes: this.staffNotes,
      status: apiStatus
    };

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.lang,
    });

    // Determine which request ID to use
    let targetRequestId = this.requestId;
    
    // If we have a child request that's pending, use its ID instead
    if (this.hasChildRequest && this.childRequest && this.childRequest.status === 'pending') {
      targetRequestId = this.childRequest.id.toString();
    }

    if (!targetRequestId) { return; }
    
    // Use request ID instead of knowledge ID if available
    const apiEndpoint = `https://api.insightabusiness.com/api/company/insighter/request/knowledge/accept/${targetRequestId}`;

    this.http.post(apiEndpoint, body, { headers })
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          
          // Success messages based on language
          const successMessages = this.lang === 'ar' ? {
            title: 'تم بنجاح!',
            text:
              status === 'approve'
                ? 'تمت الموافقة على المعرفة بنجاح.'
                : status === 'decline'
                  ? 'تم رفض المعرفة (رفض جزئي) بنجاح.'
                  : 'تم رفض المعرفة (رفض نهائي) بنجاح.',
            confirmButton: 'حسناً'
          } : {
            title: 'Success!',
            text:
              status === 'approve'
                ? 'Knowledge has been approved successfully.'
                : status === 'decline'
                  ? 'Knowledge has been partially rejected successfully.'
                  : 'Knowledge has been rejected permanently successfully.',
            confirmButton: 'OK'
          };

          Swal.fire({
            title: successMessages.title,
            text: successMessages.text,
            icon: 'success',
            confirmButtonText: successMessages.confirmButton,
            customClass: {
              confirmButton: 'btn btn-primary fw-bold px-10'
            },
            buttonsStyling: false
          }).then(() => {
            if (status === 'approve') {
              this.loadKnowledgeData();
              this.checkRequestStatus();
              this.openSocialShareModal(true);
              return;
            }

            this.router.navigate(['/app/insighter-dashboard/my-requests']);
          });
        },
        error: (error) => {
          this.isLoading = false;
          this.handleServerErrors(error);
        }
      });
  }

  openSocialShareModal(navigateAfterClose: boolean = false): void {
    this.isSocialShareModalVisible = true;
    this.linkCopied = false;
    this.navigateAfterShareClose = navigateAfterClose;

    if (!this.customShareMessage) {
      this.customShareMessage = this.getDefaultShareMessage();
    }
  }

  closeSocialShareModal(): void {
    this.isSocialShareModalVisible = false;

    if (this.navigateAfterShareClose) {
      this.navigateAfterShareClose = false;
      this.router.navigate(['/app/insighter-dashboard/my-requests']);
    }
  }

  getShareableLink(): string {
    const knowledgeType = this.knowledge?.type?.toLowerCase() || 'knowledge';
    const slug = this.knowledge?.slug || '';
    return `https://insightabusiness.com/${this.lang}/knowledge/${knowledgeType}/${slug}`;
  }

  getSocialShareTitle(): string {
    const knowledgeType = this.knowledge?.type
      ? this.knowledge.type.charAt(0).toUpperCase() + this.knowledge.type.slice(1)
      : 'Knowledge';
    const title = this.knowledge?.title || 'Amazing Knowledge';
    return `${knowledgeType} - ${title}`;
  }

  private translateKnowledgeTypeToArabic(type: string): string {
    if (!type) return 'معرفة';
    const normalized = type.toLowerCase();

    switch (normalized) {
      case 'data':
        return 'بيانات';
      case 'statistic':
      case 'insight':
      case 'insights':
        return 'رؤية';
      case 'report':
      case 'reports':
        return 'تقرير';
      case 'manual':
      case 'manuals':
        return 'دليل';
      case 'course':
      case 'courses':
        return 'دورة';
      case 'media':
        return 'وسائط';
      case 'knowledge':
        return 'معرفة';
      default:
        return type;
    }
  }

  getDefaultShareMessage(): string {
    if (!this.knowledge) {
      return this.lang === 'ar' ? 'اكتب رسالة المشاركة الخاصة بك' : 'Write your share message';
    }

    const knowledgeType = this.knowledge.type || 'knowledge';

    if (this.lang === 'ar') {
      const knowledgeTypeAr = this.translateKnowledgeTypeToArabic(knowledgeType);
      return `لقد نشرت ${knowledgeTypeAr} جديد في ...`;
    }

    return `I just published a business ${knowledgeType} in ...`;
  }

  shareToSocial(platform: string): void {
    const shareUrl = this.getSocialShareLinkWithCustomMessage(platform);
    window.open(shareUrl, '_blank', 'width=600,height=400');
    this.closeSocialShareModal();
  }

  getSocialShareLinkWithCustomMessage(platform: string): string {
    const shareUrl = this.getShareableLink();
    const message = `${this.customShareMessage} `;
    const title = this.getSocialShareTitle();

    switch (platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(message)}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(message)}`;
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}%20${encodeURIComponent(shareUrl)}`;
      default:
        return '';
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.linkCopied = true;
      setTimeout(() => {
        this.linkCopied = false;
      }, 3000);
    });
  }
}
