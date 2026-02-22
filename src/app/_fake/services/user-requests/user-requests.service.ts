import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';
// models/type.model.ts
export interface Type {
    key: string;
    label: string;
  }
  
  // models/requestable.model.ts
  export interface Requestable {
    id?: number;
    uuid?: string;
    legal_name?: string;
    website?: string | null;
    verified_email?: string | null;
    about_us?: string;
    register_document?: string;
    logo?: string;
    status?: string;
    verified?: boolean;
    address?: string;
    company_phone?: string;
    first_name?: string;
        final_status_label:string;
    status_label:string;
    last_name?: string;
    roles?: string[];
    // Properties for insighter requestable objects
    name?: string;
    profile_photo_url?: string | null;
  }
  
  // models/data-item.model.ts
  export interface UserRequest {
    id: number;
    type: Type;
    requestable_type: string;
    comments: string;
    staff_notes: string | null;
    handel_by: string | null; // Consider renaming to 'handled_by' for clarity
    handel_at: string | null; // Consider renaming to 'handled_at' for clarity
    status: string;
    requestable: Requestable;
    final_status: string;
    children: UserRequest[];
    final_status_label:string;
    status_label:string;
    identity?:string;
  }
  


@Injectable({
  providedIn: 'root'
})
export class UserRequestsService {
  private apiUrl = 'https://api.insightabusiness.com/api/account/request';
  private insighterRequestsUrl = 'https://api.insightabusiness.com/api/company/insighter/request';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';
  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.translationService.getSelectedLanguage();
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    return throwError(() => error);
  }

  /**
   * Fetch all user requests.
   * @returns Observable of UserRequest array
   */
  getAllUserRequests(lang:string): Observable<UserRequest[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': lang
    });

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map(response => response.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Fetch all insighter requests.
   * @returns Observable of UserRequest array
   */
  getInsighterRequests(lang: string): Observable<UserRequest[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': lang
    });

    this.setLoading(true);
    return this.http.get<any>(this.insighterRequestsUrl, { headers }).pipe(
      map(response => response.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Send activation request for a company
   * @param comments User comments for the request
   * @param parentId Parent company ID
   * @returns Observable of the request response
   */
  sendActivationRequest(comments: string, parentId: string): Observable<any> {
    const url = 'https://api.insightabusiness.com/api/company/request/activate';
    const formData = new FormData();
    formData.append('comments', comments);
    formData.append('parent_id', parentId);

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post(url, formData, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Send verification request for a company
   * @param comments User comments for the request
   * @param parentId Parent company ID
   * @returns Observable of the request response
   */
  sendVerificationRequest(comments: string, parentId: string): Observable<any> {
    const url = 'https://api.insightabusiness.com/api/company/request/verified';
    const formData = new FormData();
    formData.append('comments', comments);
    formData.append('parent_id', parentId);

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post(url, formData, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Send deactivate and delete request for a company
   * @param comments User comments for the request 
   * @param parentId Parent company ID
   * @returns Observable of the request response
   */
  sendDeactivateAndDeleteRequest(comments: string, parentId: string): Observable<any> {
    const url = 'https://api.insightabusiness.com/api/company/request/deactivate-delete';
    const formData = new FormData();
    formData.append('comments', comments);
    formData.append('parent_id', parentId);

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post(url, formData, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Send deactivate and delete request for an insighter
   * @param comments User comments for the request 
   * @param parentId Parent insighter ID
   * @returns Observable of the request response
   */
  sendDeactivateAndDeleteRequestInsighter(comments: string, parentId: string): Observable<any> {
    const url = 'https://api.insightabusiness.com/api/insighter/request/deactivate-delete';
    const formData = new FormData();
    formData.append('comments', comments);
    formData.append('parent_id', parentId);

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post(url, formData, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  };

  /**
   * Send reactivate request for a company
   * @param comments User comments for the request 
   * @param parentId Parent company ID
   * @returns Observable of the request response
   */
  sendReactivateRequest(type:string): Observable<any> {
    const url = type === 'company' ? 'https://api.insightabusiness.com/api/company/activate' : 'https://api.insightabusiness.com/api/insighter/activate';
    
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post(url, {}, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Update insighter request status (approve or decline)
   * @param requestId ID of the request to update
   * @param status New status ('approved' or 'declined')
   * @param staffNotes Staff notes for the decision
   * @returns Observable of the request response
   */
  updateInsighterRequestStatus(requestId: string, status: string, staffNotes: string): Observable<any> {
    const url = `${this.insighterRequestsUrl}/${requestId}/accept`;
    
    const formData = new FormData();
    formData.append('status', status);
    formData.append('staff_notes', staffNotes);
    
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });
    
    this.setLoading(true);
    return this.http.post(url, formData, { headers }).pipe(
      catchError((error: any) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Send knowledge review request
   * @param comments User comments for the request
   * @param parentId Parent request ID
   * @param knowledgeId Knowledge ID to review
   * @returns Observable of the request response
   */
  sendKnowledgeReviewRequest(comments: string, parentId: string, knowledgeId: string): Observable<any> {
    const url = 'https://api.insightabusiness.com/api/insighter/request/knowledge/review';
    
    const formData = new FormData();
    formData.append('comments', comments);
    formData.append('parent_id', parentId);
    formData.append('knowledge_id', knowledgeId);
    
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });
    
    this.setLoading(true);
    return this.http.post(url, formData, { headers }).pipe(
      catchError((error: any) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}
