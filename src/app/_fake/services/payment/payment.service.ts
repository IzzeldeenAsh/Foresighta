import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface StripeCountry {
  id: number;
  name: string;
  flag: string;
  showFlag?: boolean;
}

export interface PaymentMethod {
  type: 'manual' | 'provider';
  // Manual account fields
  account_name?: string;
  account_country?: {
    id: number;
    name: string;
    flag: string;
  };
  account_address?: string;
  account_phone?: string;
  account_phone_code?: string;
  bank_name?: string;
  bank_country?: {
    id: number;
    name: string;
    flag: string;
  };
  bank_address?: string;
  bank_iban?: string;
  bank_swift_code?: string;
  // Provider account fields
  stripe_account?: boolean;
  details_submitted_at?: string | null;
  charges_enable_at?: string | null;
  restricted_at?: string | null;
  restricted_deadline?: string | null;
  disabled_reason?: string | null;
  requirements?: Array<{
    field?: string | null;
    message?: string | null;
  }> | null;
  country?: {
    id: number;
    name: string;
    flag: string;
  };
  // Common fields
  accept_agreement: boolean;
  status: 'active' | 'inactive' | 'restricted';
  primary: boolean;
}

export interface PaymentDetailsResponse {
  data: PaymentMethod[];
}

export interface SetPrimaryRequest {
  type: 'manual' | 'provider';
}

export interface ManualAccountRequest {
  account_name: string;
  account_country_id: number;
  account_address?: string;
  account_phone?: string;
  account_phone_code?: string;
  bank_name: string;
  bank_country_id: number;
  bank_address: string;
  bank_iban: string;
  bank_swift_code?: string;
  accept_terms: boolean;
  code: string;
}

export interface UpdateManualAccountRequest {
  account_name: string;
  account_country_id: number;
  account_address?: string;
  account_phone?: string;
  account_phone_code?: string;
  bank_name: string;
  bank_country_id: number;
  bank_address: string;
  bank_iban: string;
  bank_swift_code?: string;
  accept_terms: boolean;
  code: string;
}

export interface StripeAccountRequest {
  country_id: number;
  code: string;
  accept_terms: boolean;
}

export interface StripeAccountResponse {
  data: {
    stripe_account_link: {
      object: string;
      created: number;
      expires_at: number;
      url: string;
    };
  };
}

export interface TermsResponse {
  data: {
    slug: string;
    name: string;
    guideline: string;
    version: string;
    file: string | null;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private stripeCountriesApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/stripe/countries';
  private setPrimaryApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/primary/set';
  private generateOtpApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/otp/generate';
  private accountDetailsApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/details';
  private setManualAccountApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/manual/set';
  private updateManualAccountApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/manual/update';
  private deleteManualAccountApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/manual/delete';
  private stripeCreateApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/stripe/create';
  private stripeLinkApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/stripe/link';
  private stripeCompleteApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/stripe/complete';
  private deleteStripeApiUrl = 'https://api.foresighta.co/api/insighter/payment/account/stripe/delete';
  private manualTermsApiUrl = 'https://api.foresighta.co/api/common/setting/guideline/slug/wallet-payment-terms-and-conditions';
  private stripeTermsApiUrl = 'https://api.foresighta.co/api/common/setting/guideline/slug/stripe-payment-terms-and-conditions';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';
  private authLocalStorageKey = 'foresighta-creds';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    return throwError(() => error);
  }

  private getAuthToken(): string | null {
    try {
      const authData = localStorage.getItem(this.authLocalStorageKey);
      if (authData) {
        const parsedData = JSON.parse(authData);
        return parsedData.authToken || null;
      }
    } catch (error) {
      console.error('Error parsing auth data from localStorage:', error);
    }
    return null;
  }

  private getHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': this.currentLang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });
  }

  // 1. Set payment as primary
  setPrimaryPaymentMethod(type: 'provider' | 'manual'): Observable<any> {
    this.setLoading(true);
    const request: SetPrimaryRequest = { type };
    return this.http.post<any>(this.setPrimaryApiUrl, request, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 2. Generate payment OTP
  generatePaymentOTP(): Observable<any> {
    this.setLoading(true);
    return this.http.post<any>(this.generateOtpApiUrl, {}, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 3. Get payment account details
  getPaymentAccountDetails(): Observable<PaymentDetailsResponse> {
    this.setLoading(true);
    return this.http.get<PaymentDetailsResponse>(this.accountDetailsApiUrl, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 4. Set manual account (create)
  setManualAccount(request: ManualAccountRequest): Observable<any> {
    this.setLoading(true);
    return this.http.post<any>(this.setManualAccountApiUrl, request, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 5. Update manual account
  updateManualAccount(request: UpdateManualAccountRequest): Observable<any> {
    this.setLoading(true);
    return this.http.post<any>(this.updateManualAccountApiUrl, request, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 6. Delete manual account
  deleteManualAccount(): Observable<any> {
    this.setLoading(true);
    return this.http.delete<any>(this.deleteManualAccountApiUrl, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 7. Create Stripe (Provider) Account
  createStripeAccount(request: StripeAccountRequest): Observable<StripeAccountResponse> {
    this.setLoading(true);
    return this.http.post<StripeAccountResponse>(this.stripeCreateApiUrl, request, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 8. Link Stripe Account
  linkStripeAccount(request: StripeAccountRequest): Observable<StripeAccountResponse> {
    this.setLoading(true);
    return this.http.post<StripeAccountResponse>(this.stripeLinkApiUrl, request, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 9. Complete Stripe account
  completeStripeAccount(): Observable<any> {
    this.setLoading(true);
    return this.http.post<any>(this.stripeCompleteApiUrl, {}, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 10. Delete provider account (stripe)
  deleteStripeAccount(): Observable<any> {
    this.setLoading(true);
    return this.http.delete<any>(this.deleteStripeApiUrl, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // 11. Get stripe countries
  getStripeCountries(): Observable<StripeCountry[]> {
    this.setLoading(true);
    return this.http.get<any>(this.stripeCountriesApiUrl, { headers: this.getHeaders() }).pipe(
      map(res => res.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get terms and conditions for manual payment
  getManualPaymentTerms(): Observable<TermsResponse> {
    this.setLoading(true);
    return this.http.get<TermsResponse>(this.manualTermsApiUrl, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get terms and conditions for stripe payment
  getStripePaymentTerms(): Observable<TermsResponse> {
    this.setLoading(true);
    return this.http.get<TermsResponse>(this.stripeTermsApiUrl, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Helper methods to get specific payment account types
  getPrimaryAccount(methods: PaymentMethod[]): PaymentMethod | null {
    return methods.find(m => m.primary) || null;
  }

  getManualAccount(methods: PaymentMethod[]): PaymentMethod | null {
    return methods.find(m => m.type === 'manual') || null;
  }

  getProviderAccount(methods: PaymentMethod[]): PaymentMethod | null {
    return methods.find(m => m.type === 'provider') || null;
  }

  getProviderAccounts(methods: PaymentMethod[]): PaymentMethod[] {
    return methods.filter(m => m.type === 'provider');
  }
}