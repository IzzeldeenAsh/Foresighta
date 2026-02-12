import { Component, Injector, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, first, Observable } from 'rxjs';
import { IKnoldgProfile } from 'src/app/_fake/models/profile.interface';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { UserRequestsService } from 'src/app/_fake/services/user-requests/user-requests.service';
import { UserRequest } from 'src/app/_fake/services/user-requests/user-requests.service';
import { BaseComponent } from 'src/app/modules/base.component';

// Extend the UserRequest interface to include knowledge_id
interface ExtendedUserRequest extends UserRequest {
  knowledge_id?: number;
  parent_id?: number;
  insighter?: {
    uuid: string;
    name: string;
    profile_photo_url: string | null;
  };
}

@Component({
  selector: 'app-my-requests',
  templateUrl: './my-requests.component.html',
  styleUrl: './my-requests.component.scss'
})
export class MyRequestsComponent extends BaseComponent implements OnInit {
  userRequests: ExtendedUserRequest[] = [];
  filteredUserRequests: ExtendedUserRequest[] = [];
  insighterRequests: ExtendedUserRequest[] = [];
  filteredInsighterRequests: ExtendedUserRequest[] = [];
  isLoading$: Observable<boolean>;
  private loadingSubject = new BehaviorSubject<boolean>(true);
  selectedType: string = '';
  selectedStatus: string = '';
  selectedInsighterType: string = '';
  selectedInsighterStatus: string = '';
  resendComments: string = '';
  displayRequestDialog: boolean = false;
  selectedRequest: ExtendedUserRequest | null = null;
  userProfile: IKnoldgProfile | null = null;
  hasPendingRequestOfSameType: boolean = false;
  
  // Loading state trackers
  private profileLoaded = false;
  private userRequestsLoaded = false;
  private insighterRequestsLoaded = false;
  
  // Added properties for approve/decline functionality
  isInsighterRequest: boolean = false;
  isApproving: boolean = false;
  isDeclining: boolean = false;
  staffNotes: string = '';
  
  constructor(
    injector: Injector,
    private userRequestsService: UserRequestsService,
    private getProfileService: ProfileService,
    private router: Router
  ) {
    super(injector);
    this.isLoading$ = this.loadingSubject.asObservable();
  }

  ngOnInit(): void {
    this.loadingSubject.next(true);
    this.loadData();
    this.getProfile();
  }

  getProfile() {
    this.getProfileService.getProfile().pipe(first()).subscribe({
      next: (user) => {
        console.log('User profile loaded:', user);
        console.log('User roles:', user?.roles);
        this.userProfile = user;
        this.profileLoaded = true;
        // Load insighter requests for all users for now
        if(user?.roles.includes('company')){
          this.loadInsighterRequests();
        } else {
          this.insighterRequestsLoaded = true;
          this.checkLoadingComplete();
        }
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.profileLoaded = true;
        this.checkLoadingComplete();
      }
    });
  }

  loadData() {
    this.userRequestsService.getAllUserRequests(this.lang).subscribe({
      next: (requests) => {
        this.userRequests = requests;
        this.filterRequests();
        this.userRequestsLoaded = true;
        this.checkLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading user requests:', error);
        this.userRequestsLoaded = true;
        this.checkLoadingComplete();
      }
    });
  }

  loadInsighterRequests() {
    console.log('Loading insighter requests...');
    this.userRequestsService.getInsighterRequests(this.lang).subscribe({
      next: (requests) => {
        console.log('Insighter requests loaded:', requests);
        this.insighterRequests = requests;
        this.filterInsighterRequests();
        this.insighterRequestsLoaded = true;
        this.checkLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading insighter requests:', error);
        this.insighterRequestsLoaded = true;
        this.checkLoadingComplete();
      }
    });
  }
  
  /**
   * Check if all data has loaded and update loading state
   */
  private checkLoadingComplete() {
    if (this.profileLoaded && this.userRequestsLoaded && this.insighterRequestsLoaded) {
      this.loadingSubject.next(false);
    }
  }

  filterRequests() {
    this.filteredUserRequests = this.userRequests.filter((request) => {
      const matchesType = this.selectedType ? request.type.key === this.selectedType : true;
      const matchesStatus = this.selectedStatus ? request.final_status === this.selectedStatus : true;
      return matchesType && matchesStatus;
    }).sort((a, b) => this.getRequestSortValue(b) - this.getRequestSortValue(a));
  }

  filterInsighterRequests() {
    console.log('Filtering insighter requests. Total count:', this.insighterRequests.length);
    console.log('Current filters - Type:', this.selectedInsighterType, 'Status:', this.selectedInsighterStatus);
    
    this.filteredInsighterRequests = this.insighterRequests.filter((request) => {
      const matchesType = this.selectedInsighterType ? request.type.key === this.selectedInsighterType : true;
      const matchesStatus = this.selectedInsighterStatus ? request.final_status === this.selectedInsighterStatus : true;
      return matchesType && matchesStatus;
    }).sort((a, b) => this.getRequestSortValue(b) - this.getRequestSortValue(a));
    
    console.log('Filtered insighter requests count:', this.filteredInsighterRequests.length);
  }
  
  // Check if any filters are active (either user or insighter)
  hasActiveFilters(): boolean {
    return this.hasUserFilters() || this.hasInsighterFilters();
  }
  
  // Check if user request filters are active
  hasUserFilters(): boolean {
    return !!this.selectedType || !!this.selectedStatus;
  }
  
  // Check if insighter request filters are active
  hasInsighterFilters(): boolean {
    return !!this.selectedInsighterType || !!this.selectedInsighterStatus;
  }
  
  // Clear user request filters
  clearUserFilters(): void {
    this.selectedType = '';
    this.selectedStatus = '';
    this.filterRequests();
  }
  
  // Clear insighter request filters
  clearInsighterFilters(): void {
    this.selectedInsighterType = '';
    this.selectedInsighterStatus = '';
    this.filterInsighterRequests();
  }

  openRequestDialog(request: ExtendedUserRequest) {
    const latestRequest = this.getLatestChild(request);
    this.selectedRequest = latestRequest;
    this.isInsighterRequest = false;
    
    // Check if there's already a pending request of the same type
    this.hasPendingRequestOfSameType = this.userRequests.some(req => 
      req.type.key === latestRequest.type.key && 
      req.final_status === 'pending' &&
      req.id !== latestRequest.id
    );
    
    this.displayRequestDialog = true;
  }

  openInsighterRequestDialog(request: ExtendedUserRequest) {
    const latestRequest = this.getLatestChild(request);
    
    // If it's an accept_knowledge request with a knowledge_id, navigate directly
    if (latestRequest.type?.key === 'accept_knowledge' && latestRequest.identity) {
      this.selectedRequest = latestRequest;
      this.navigateToReview();
      return;
    }
    
    // Otherwise, show the dialog as usual
    this.selectedRequest = latestRequest;
    this.isInsighterRequest = true;
    
    // Reset action state
    this.isApproving = false;
    this.isDeclining = false;
    this.staffNotes = '';
    
    // Check if there's already a pending request of the same type
    this.hasPendingRequestOfSameType = this.insighterRequests.some(req => 
      req.type.key === latestRequest.type.key && 
      req.final_status === 'pending' &&
      req.id !== latestRequest.id
    );
    
    this.displayRequestDialog = true;
  }

  // Methods for approval/decline actions
  onApproveRequest() {
    this.isApproving = true;
    this.isDeclining = false;
  }

  onDeclineRequest() {
    this.isApproving = false;
    this.isDeclining = true;
  }

  cancelAction() {
    this.isApproving = false;
    this.isDeclining = false;
    this.staffNotes = '';
  }

  confirmAction() {
    if (!this.selectedRequest || !this.staffNotes.trim()) {
      return;
    }

    if (this.isApproving) {
      this.approveInsighterRequest();
    } else if (this.isDeclining) {
      this.declineInsighterRequest();
    }
  }

  // API calls for approve/decline
  approveInsighterRequest() {
    if (!this.selectedRequest || !this.staffNotes.trim()) return;

    const requestId = this.selectedRequest.id.toString();
    const status = "approved";
    
    this.loadingSubject.next(true);

    this.userRequestsService.updateInsighterRequestStatus(requestId, status, this.staffNotes).subscribe({
      next: () => {
        this.showSuccess('Success', 'Request approved successfully');
        this.displayRequestDialog = false;
        if(this.userProfile?.roles.includes('company')){
          this.loadInsighterRequests();
        } else {
          this.loadData();
        }
        this.resetActionState();
      },
      error: (error: any) => {
        console.error('Error approving request:', error);
        this.showError('Error', 'Failed to approve request');
        this.loadingSubject.next(false);
      }
    });
  }

  declineInsighterRequest() {
    if (!this.selectedRequest || !this.staffNotes.trim()) return;

    const requestId = this.selectedRequest.id.toString();
    const status = "declined";
    
    this.loadingSubject.next(true);

    this.userRequestsService.updateInsighterRequestStatus(requestId, status, this.staffNotes).subscribe({
      next: () => {
        this.showSuccess('Success', 'Request declined successfully');
        this.displayRequestDialog = false;
        if(this.userProfile?.roles.includes('company')){
          this.loadInsighterRequests();
        } else {
          this.loadData();
        }
        this.resetActionState();
      },
      error: (error: any) => {
        console.error('Error declining request:', error);
        this.showError('Error', 'Failed to decline request');
        this.loadingSubject.next(false);
      }
    });
  }

  resetActionState() {
    this.isApproving = false;
    this.isDeclining = false;
    this.staffNotes = '';
    this.selectedRequest = null;
  }

  viewFilteredStock() {
    // Implement based on your needs
  }

  private getLatestChild(request: ExtendedUserRequest): ExtendedUserRequest {
    let latest = request;
    let latestSortValue = this.getSingleRequestSortValue(request);

    if (request.children && request.children.length > 0) {
      for (const child of request.children as ExtendedUserRequest[]) {
        const candidate = this.getLatestChild(child);
        const candidateSortValue = this.getSingleRequestSortValue(candidate);

        if (candidateSortValue > latestSortValue) {
          latest = candidate;
          latestSortValue = candidateSortValue;
        }
      }
    }

    return latest;
  }

  private getRequestSortValue(request: ExtendedUserRequest): number {
    return this.getSingleRequestSortValue(this.getLatestChild(request));
  }

  private getSingleRequestSortValue(request: ExtendedUserRequest): number {
    const requestAny = request as any;

    const dateCandidates: Array<string | null | undefined> = [
      requestAny.updated_at,
      requestAny.created_at,
      requestAny.handel_at,
      requestAny.handled_at,
      requestAny.updatedAt,
      requestAny.createdAt,
      request.handel_at,
    ];

    for (const value of dateCandidates) {
      if (!value) continue;
      const parsed = this.parseRequestDate(value);
      if (parsed !== null) return parsed;
    }

    return typeof request.id === 'number' ? request.id : Number(requestAny.id) || 0;
  }

  private parseRequestDate(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed);
    const normalized = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;

    const attempts = hasTimezone
      ? [trimmed, normalized]
      : [trimmed, normalized, `${normalized}Z`];

    for (const attempt of attempts) {
      const parsed = Date.parse(attempt);
      if (!Number.isNaN(parsed)) return parsed;
    }

    return null;
  }

  onResendRequest() {
    if (this.selectedRequest?.id && this.resendComments.trim()) {
      this.loadingSubject.next(true);
      
      // Use sendVerificationRequest if the request type is 'activate_company'
      if (this.selectedRequest.type.key === 'activate_company') {
        const sub = this.userRequestsService
          .sendActivationRequest(this.resendComments, this.selectedRequest.id.toString())
          .subscribe({
            next: () => {
              this.showSuccess('Success', 'Verification request resent successfully.');
              this.loadData();
              this.displayRequestDialog = false;
              this.resendComments = '';
            },
            error: (error) => {
              console.error('Error resending verification request:', error);
              this.showError('Error', 'Failed to resend verification request.');
              this.loadingSubject.next(false);
            },
          });
        this.unsubscribe.push(sub);
      } else if(this.selectedRequest?.type.key === 'verified_company') {
        // Otherwise, keep using the original method
        const sub = this.userRequestsService
          .sendVerificationRequest(this.resendComments, this.selectedRequest.id.toString())
          .subscribe({
            next: () => {
              this.showSuccess('Success', 'Activation request resent successfully.');
              this.loadData();
              this.displayRequestDialog = false;
              this.resendComments = '';
            },
            error: (error) => {
              console.error('Error resending activation request:', error);
              this.showError('Error', 'Failed to resend activation request.');
              this.loadingSubject.next(false);
            },
          });
        this.unsubscribe.push(sub);
      } else if(this.selectedRequest?.type.key === 'deactivate_delete_company'){
        const sub = this.userRequestsService
          .sendDeactivateAndDeleteRequest(this.resendComments, this.selectedRequest.id.toString())
          .subscribe({
            next: () => {
              this.showSuccess('Success', 'Deactivation request sent successfully.');
              this.loadData();
              this.displayRequestDialog = false;
              this.resendComments = '';
            },
            error: (error) => {
              this.loadingSubject.next(false);
            }
          });
        this.unsubscribe.push(sub);
      } else if(this.selectedRequest?.type.key === 'deactivate_delete_insighter'){
        const sub = this.userRequestsService
          .sendDeactivateAndDeleteRequestInsighter(this.resendComments, this.selectedRequest.id.toString())
          .subscribe({
            next: () => {
              this.showSuccess('Success', 'Deactivation request sent successfully.');
              this.loadData();
              this.displayRequestDialog = false;
              this.resendComments = '';
            },
            error: (error) => {
              this.loadingSubject.next(false);
            }
          });
        this.unsubscribe.push(sub);
      } else if(this.selectedRequest?.type.key === 'accept_knowledge' && this.selectedRequest.identity) {
        // Handle knowledge review requests
        const sub = this.userRequestsService
          .sendKnowledgeReviewRequest(
            this.resendComments, 
            this.selectedRequest.id.toString(),
            this.selectedRequest.identity
          )
          .subscribe({
            next: () => {
              this.showSuccess('Success', 'Knowledge review request sent successfully.');
              this.loadData();
              if(this.userProfile?.roles.includes('company')){
                this.loadInsighterRequests();
              } else {
                this.loadData();
              }
              this.displayRequestDialog = false;
              this.resendComments = '';
            },
            error: (error) => {
              console.error('Error sending knowledge review request:', error);
              this.showError('Error', 'Failed to send knowledge review request.');
              this.loadingSubject.next(false);
            },
          });
        this.unsubscribe.push(sub);
      }
    }
  }

  // Navigate to review page for knowledge
  navigateToReview(): void {
    if (this.selectedRequest?.identity) {
      this.router.navigate(['/app/review-insighter-knowledge/review', this.selectedRequest.identity], {
        queryParams: { requestId: this.selectedRequest.id }
      });
      this.displayRequestDialog = false;
    }
  }

  /**
   * Navigate to view knowledge page
   */
  viewKnowledge(): void {
    if (this.selectedRequest?.identity) {
      this.router.navigate(['/app/my-knowledge-base/view-my-knowledge/', parseInt(this.selectedRequest.identity), 'details']);
      this.displayRequestDialog = false;
    }
  }

  /**
   * Get subtitle for the page header
   */
  getRequestsSubtitle(): string {
    if (this.lang === 'ar') {
      return 'هنا يمكنك متابعة حالة الطلبات الواردة على المنصة.';
    }

    return 'Review the status of your platform requests here.';
  }
}
