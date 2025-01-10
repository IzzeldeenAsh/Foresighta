import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface Tag {
  id: number;
  name: string;
  category: string;
  names: {
    en: string;
    ar: string;
  };
  status?:string;
  industries:number[];
}

export interface TagResponse {
  data: Tag[];
}

export interface PaginatedTagResponse {
  data: Tag[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    links: {
      url: string | null;
      label: string;
      active: boolean;
    }[];
    path: string;
    per_page: number;
    to: number;
    total: number;
  };
}

export interface IndustryTagResponse {
  data: {
    id: number;
    name: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class TagsService {
  private insightaHost = 'https://api.foresighta.co';
  private apiUrl = `${this.insightaHost}/api/common/setting/tag/list`;
  private createApi = `${this.insightaHost}/api/admin/setting/tag`;
  private updateDeleteApi = `${this.insightaHost}/api/admin/setting/tag`;

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';;
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    return throwError(error);
  }

  // Fetch tag data from the API
  getTags(): Observable<Tag[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<TagResponse>(this.apiUrl, { headers }).pipe(
      map(res => res.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get admin tags with pagination
  getAdminTags(page: number = 1): Observable<PaginatedTagResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<PaginatedTagResponse>(`${this.updateDeleteApi}?page=${page}`, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

// Create a new tag
createTag(tag:   { name: { en: string; ar: string }; status: string; industries:any }): Observable<any> {
  const headers = new HttpHeaders({
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Accept-Language': this.currentLang
  });

  this.setLoading(true);
  return this.http.post<any>(this.createApi, tag, { headers }).pipe(
    map(res => res),
    catchError(error => this.handleError(error)),
    finalize(() => this.setLoading(false))
  );
}

// Update an existing tag
updateTag(tagId: number, tag:   { name: { en: string; ar: string }; status: string; industries:any } ): Observable<Tag> {
  const headers = new HttpHeaders({
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Accept-Language': this.currentLang
  });

  this.setLoading(true);
  return this.http.put<Tag>(`${this.updateDeleteApi}/${tagId}`, tag, { headers }).pipe(
    map(res => res),
    catchError(error => this.handleError(error)),
    finalize(() => this.setLoading(false))
  );
}

  // Delete a tag
  deleteTag(tagId: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.delete<any>(`${this.updateDeleteApi}/${tagId}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get tags by industry
  getTagsByIndustry(industryId: number,lang:string): Observable<{id: number, name: string}[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': lang
    });

    return this.http.get<IndustryTagResponse>(`${this.insightaHost}/api/common/setting/tag/industry/${industryId}`, { headers })
      .pipe(
        map(res => res.data),
        catchError(error => this.handleError(error))
      );
  }

  getCategories(): Observable<{ id: string; name: string }[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });
  
    return this.http.get<{ data: { id: string; name: string }[] }>(`${this.insightaHost}/api/common/setting/tag/category/list`, { headers })
      .pipe(
        map(res => res.data),
        catchError(error => this.handleError(error))
      );
  }

  getSuggestKeywords(industryId: number,lang:string): Observable<string[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    return this.http.get<{data: {[key: string]: string}}>(`${this.insightaHost}/api/insighter/library/knowledge/keyword/suggest/${industryId}`, { headers })
      .pipe(
        map(res => Object.values(res.data)),
        catchError(error => this.handleError(error))
      );
  }
}
