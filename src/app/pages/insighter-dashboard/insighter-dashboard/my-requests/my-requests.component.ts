import { Component, Injector, OnInit } from '@angular/core';
import { first, Observable } from 'rxjs';
import { IKnoldgProfile } from 'src/app/_fake/models/profile.interface';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { UserRequestsService } from 'src/app/_fake/services/user-requests/user-requests.service';
import { UserRequest } from 'src/app/_fake/services/user-requests/user-requests.service';
import { BaseComponent } from 'src/app/modules/base.component';

@Component({
  selector: 'app-my-requests',
  templateUrl: './my-requests.component.html',
  styleUrl: './my-requests.component.scss'
})
export class MyRequestsComponent extends BaseComponent implements OnInit {
  userRequests: UserRequest[] = [];
  filteredUserRequests: UserRequest[] = [];
  isLoading$!: Observable<boolean>;
  selectedType: string = '';
  selectedStatus: string = '';
  resendComments: string = '';
  displayRequestDialog: boolean = false;
  selectedRequest: UserRequest | null = null;
  userProfile: IKnoldgProfile | null = null;
  hasPendingRequestOfSameType: boolean = false;
  
  constructor(
    injector: Injector,
    private userRequestsService: UserRequestsService,
    private getProfileService: ProfileService
  ) {
    super(injector);
    this.isLoading$ = this.userRequestsService.isLoading$;
  }

  ngOnInit(): void {
    this.loadData();
    this.getProfile();
  }

  getProfile() {
    this.getProfileService.getProfile().pipe(first()).subscribe((user)=>{
      this.userProfile=user
    })
  }

  loadData() {
    this.userRequestsService.getAllUserRequests(this.lang).subscribe((requests) => {
      this.userRequests = requests;
      this.filterRequests();
    });
  }

  filterRequests() {
    this.filteredUserRequests = this.userRequests.filter((request) => {
      const matchesType = this.selectedType ? request.type.key === this.selectedType : true;
      const matchesStatus = this.selectedStatus ? request.status === this.selectedStatus : true;
      return matchesType && matchesStatus;
    });
  }

  openRequestDialog(request: UserRequest) {
    const latestRequest = this.getLatestChild(request);
    this.selectedRequest = latestRequest;
    
    // Check if there's already a pending request of the same type
    this.hasPendingRequestOfSameType = this.userRequests.some(req => 
      req.type.key === latestRequest.type.key && 
      req.final_status === 'pending' &&
      req.id !== latestRequest.id
    );
    
    this.displayRequestDialog = true;
  }

  viewFilteredStock() {
    // Implement based on your needs
  }

  private getLatestChild(request: UserRequest): UserRequest {
    let latest = request;

    if (request.children && request.children.length > 0) {
      for (const child of request.children) {
        const candidate = this.getLatestChild(child);
        if (candidate.id > latest.id) {
          latest = candidate;
        }
      }
    }

    return latest;
  }

  onResendRequest() {
    if (this.selectedRequest?.id && this.resendComments.trim()) {
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
          });
        this.unsubscribe.push(sub);
      }else if(this.selectedRequest?.type.key === 'deactivate_delete_insighter'){
        const sub = this.userRequestsService
          .sendDeactivateAndDeleteRequestInsighter(this.resendComments, this.selectedRequest.id.toString())
          .subscribe({
            next: () => {
              this.showSuccess('Success', 'Deactivation request sent successfully.');
              this.loadData();
              this.displayRequestDialog = false;
              this.resendComments = '';
            },
          });
        this.unsubscribe.push(sub);
      }
    }
  }
}
