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
    identity_object?: any;
  }
  
export interface RequestsMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
}

export interface RequestsPageResponse {
  data: UserRequest[];
  meta: RequestsMeta;
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

  private normalizeRequestsResponse(response: any): UserRequest[] {
    const data = response?.data ?? response;
    if (Array.isArray(data)) return data as UserRequest[];
    if (data && typeof data === 'object') return Object.values(data) as UserRequest[];
    return [];
  }

  private normalizeRequestsMeta(response: any, page: number, perPage: number, dataLength: number): RequestsMeta {
    const meta = response?.meta;
    if (meta && typeof meta === 'object') {
      return {
        current_page: Number(meta.current_page) || page,
        last_page: Number(meta.last_page) || page,
        per_page: Number(meta.per_page) || perPage,
        total: Number(meta.total) || dataLength,
        from: meta.from != null ? Number(meta.from) : undefined,
        to: meta.to != null ? Number(meta.to) : undefined,
      };
    }

    return {
      current_page: page,
      last_page: page,
      per_page: perPage,
      total: dataLength,
      from: dataLength ? 1 : 0,
      to: dataLength,
    };
  }

  /**
   * Fetch user requests by page (backend pagination).
   */
  getAllUserRequestsPage(
    lang: string,
    page: number,
    perPage: number,
    filters?: { type?: string; final_status?: string }
  ): Observable<RequestsPageResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': lang
    });

    const params: Record<string, string> = {
      page: String(page),
      per_page: String(perPage),
    };
    if (filters?.type) params.type = filters.type;
    if (filters?.final_status) params.final_status = filters.final_status;

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers, params }).pipe(
      map((response) => {
        const data = this.normalizeRequestsResponse(response);
        return { data, meta: this.normalizeRequestsMeta(response, page, perPage, data.length) };
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Fetch insighter requests by page (backend pagination).
   */
  getInsighterRequestsPage(
    lang: string,
    page: number,
    perPage: number,
    filters?: { type?: string; final_status?: string }
  ): Observable<RequestsPageResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': lang
    });

    const params: Record<string, string> = {
      page: String(page),
      per_page: String(perPage),
    };
    if (filters?.type) params.type = filters.type;
    if (filters?.final_status) params.final_status = filters.final_status;

    this.setLoading(true);
    return this.http.get<any>(this.insighterRequestsUrl, { headers, params }).pipe(
      map((response) => {
        const data = this.normalizeRequestsResponse(response);
        return { data, meta: this.normalizeRequestsMeta(response, page, perPage, data.length) };
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
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
      map((response) => this.normalizeRequestsResponse(response)),
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
      map((response) => this.normalizeRequestsResponse(response)),
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
