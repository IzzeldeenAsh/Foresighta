import { Component, Injector, ViewChild } from '@angular/core';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { UserRequestsService } from 'src/app/_fake/services/user-requests/user-requests.service';
import { KnowledgeTypesStatisticsComponent } from './knowledge-types-statistics/knowledge-types-statistics.component';
import { KnowledgeService } from 'src/app/_fake/services/knowledge/knowledge.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-my-dashboard',
  templateUrl: './my-dashboard.component.html',
  styleUrl: './my-dashboard.component.scss'
})
export class MyDashboardComponent extends BaseComponent {
  roles: any[] = [];
  hasPendingActivationRequest: boolean = false;
  hasPendingInsighterRequests: boolean = false;
  pendingInsighterRequestsCount: number = 0;
  private statisticsLoaded: boolean = false;
  hasMultipleEmployees: boolean = false;
  hasEmployeeData: boolean = false;
  private knowledgeTypesLoaded: boolean = false;
  insighterStatus: string = '';
  isLoading: boolean = true;
  isClientOnly:Observable<any>;
  // Loading state trackers
  private profileLoaded: boolean = false;
  private requestsLoaded: boolean = false;
  private statisticsApiLoaded: boolean = false;
  private insighterRequestsLoaded: boolean = false;

constructor(
  injector: Injector,
  private profileService: ProfileService,
  private userRequestsService: UserRequestsService,
  private knowledgeService: KnowledgeService
){
  super(injector);
}

ngOnInit(){
  this.isLoading = true;
  this.isClientOnly= this.profileService.isClient();
  const profileSub = this.profileService.getProfile().subscribe((res: any) => {
    this.roles = res.roles;
    this.insighterStatus = res.insighter_status || '';
    this.profileLoaded = true;
    
    // Check for pending insighter requests only for company role
    if (this.roles.includes('company')) {
      this.checkPendingInsighterRequests();
    } else {
      this.insighterRequestsLoaded = true; // Skip this check for non-company users
      this.checkLoadingComplete();
    }
    
    this.checkLoadingComplete();
  });
  this.unsubscribe.push(profileSub);

  // Check if user has a pending activation request
  const requestsSub = this.userRequestsService.getAllUserRequests(this.lang).subscribe((requests) => {
    this.hasPendingActivationRequest = requests.some(
      request => request.type.key === 'activate_company' && request.status === 'pending'
    );
    this.requestsLoaded = true;
    this.checkLoadingComplete();
  });
  this.unsubscribe.push(requestsSub);

  // Check if there are statistics
  const statsSub = this.knowledgeService.getKnowledgeTypeStatistics().subscribe(
    (response) => {
      this.statisticsLoaded = response.data && response.data.length > 0;
      this.knowledgeTypesLoaded = this.statisticsLoaded;
      this.statisticsApiLoaded = true;
      this.checkLoadingComplete();
    },
    () => {
      this.statisticsLoaded = false;
      this.knowledgeTypesLoaded = false;
      this.statisticsApiLoaded = true;
      this.checkLoadingComplete();
    }
  );
  this.unsubscribe.push(statsSub);
}

/**
 * Check if all data loading is complete
 */
private checkLoadingComplete(): void {
  // Only mark loading as complete when all required data has been loaded
  if (this.profileLoaded && this.requestsLoaded && 
      this.statisticsApiLoaded && this.insighterRequestsLoaded) {
    this.isLoading = false;
  }
}

// Handle the event when the number of employees is determined
onHasMultipleEmployees(hasMultiple: boolean): void {
  this.hasMultipleEmployees = hasMultiple;
  this.hasEmployeeData = hasMultiple;
  this.checkLoadingComplete();
}

hasRole(role: string){
  return this.roles.includes(role);
}

/**
 * Check if user is an active insighter
 */
isActiveInsighter(): boolean {
  return this.hasRole('insighter') && this.insighterStatus === 'active';
}

hasStatistics(): boolean {
  return this.statisticsLoaded;
}

/**
 * Check if knowledge types statistics are available
 */
hasKnowledgeTypes(): boolean {
  return this.knowledgeTypesLoaded;
}

/**
 * Determine if the empty state message should be shown
 * Only show empty state when there are no statistics, no employee data, and no pending insighter requests
 * AND loading is complete
 */
shouldShowEmptyState(): boolean {
  return !this.isLoading && !this.hasStatistics() && !this.hasEmployeeData && !this.hasPendingInsighterRequests;
}

/**
 * Check if there are pending insighter requests for company users
 */
checkPendingInsighterRequests(): void {
  const insighterRequestsSub = this.userRequestsService.getInsighterRequests(this.lang).subscribe((requests) => {
    const pendingRequests = requests.filter(request => request.status === 'pending');
    this.pendingInsighterRequestsCount = pendingRequests.length;
    this.hasPendingInsighterRequests = this.pendingInsighterRequestsCount > 0;
    this.insighterRequestsLoaded = true;
    this.checkLoadingComplete();
  });
  this.unsubscribe.push(insighterRequestsSub);
}

}

