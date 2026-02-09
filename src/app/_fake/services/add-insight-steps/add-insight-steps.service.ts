import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders, HttpEventType, HttpEvent } from "@angular/common/http";
import { BehaviorSubject, Observable, throwError } from "rxjs";
import { catchError, finalize, map } from "rxjs/operators";
import { TranslationService } from "src/app/modules/i18n";

export interface CreateKnowledgeRequest {
  type: string;
  title: string;
  description: string;
  topic_id: number;
  industry_id: number;
  isic_code_id?: number | null;
  hs_code_id?: number | null;
  language: string;
  region: number[];
  country: number[];
  economic_bloc: any[];
}

export interface CreateKnowledgeResponse {
  data: {
    knowledge_id: number;
  };
}

export interface SuggestTopicRequest {
  industry_id: number;
  name: {
    en: string;
    ar: string;
  };
}

export interface SuggestTopicResponse {
  data: {
    topic_id: number;
  };
}

export interface Chapter {
  chapter: {
    title: string;
    sub_child: {
      title: string;
    }[];
  };
}

export interface AddKnowledgeDocumentRequest {
  file_name: string;
  table_of_content?: Chapter[];
  price: string;
  file: File;
  status?: string;
  description?: string;
  _method?: string;
}

export interface RawDocumentInfo extends Omit<DocumentInfo, 'table_of_content'> {
  table_of_content: string;
}

export interface RawDocumentListResponse {
  data: RawDocumentInfo[];
}

export interface DocumentInfo {
  id: number;
  file_name: string;
  table_of_content: Chapter[];
  price: string;
  file_size: number;
  file_extension: string;
  description?: string;
  type?: string;
  language?: string;
}

export interface DocumentListResponse {
  data: DocumentInfo[];
}

export interface DocumentUrlResponse {
  data: {
    url: string;
  };
}

export interface SyncTagsKeywordsRequest {
  keywords: string[];
  tag_ids: string[];
}

export interface PublishKnowledgeRequest {
  status: string;
  published_at: string;
}

export interface UpdateKnowledgeAbstractsRequest {
  documents: {
    id: number;
    description: string;
    table_of_content?: any[];
  }[];
}

export interface KnowledgeDetailsRequest {
  title: string;
  description: string;
  topic_id: number;
  industry_id: number;
  isic_code_id?: number | null;
  hs_code_id?: number | null;
  language: string;
  region: number[];
  country: number[];
  economic_bloc: number[];
  keywords: string[];
  tag_ids: string[];
}

export interface DocumentParserResponse {
  data: {
    metadata: {
      title: string;
      mime: string;
      author: string;
      pages: number;
      words: number;
      subject: string;
      keywords: string[];
      description: string;
    };
    keywords: string[];
    summary: string;
  };
}

export interface DocumentDetailsRequest {
  id: number;
  file_name: string;
  price: number | string;
}

export interface DocumentUploadResponse {
  data: {
    knowledge_document_id: number;
    language: string;
  };
}

@Injectable({
  providedIn: "root",
})
export class AddInsightStepsService {
  private insightaHost = "https://api.insightabusiness.com";
  private apiUrl = `${this.insightaHost}/api/insighter/library/knowledge`;
  private suggestTopicUrl = `${this.insightaHost}/api/insighter/topic/suggest`;

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = "en";

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.translationService.getSelectedLanguage();
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.currentLang = lang || "en";
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    return throwError(error);
  }

  step1HandleKnowledgeType(type: string): Observable<CreateKnowledgeResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .post<CreateKnowledgeResponse>(`${this.apiUrl}/type`, { type }, { headers })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
  updateKnowledgeType(knowledgeId: number, type: string): Observable<CreateKnowledgeResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });
  
    this.setLoading(true);
    return this.http
      .put<CreateKnowledgeResponse>(`${this.apiUrl}/type/${knowledgeId}`, { type }, { headers })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
  step2CreateKnowledge(
    request: CreateKnowledgeRequest
  ): Observable<CreateKnowledgeResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .post<CreateKnowledgeResponse>(this.apiUrl, request, { headers })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  step2UpdateKnowledge(
    knowledgeId: number,
    request: CreateKnowledgeRequest
  ): Observable<CreateKnowledgeResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .put<CreateKnowledgeResponse>(`${this.apiUrl}/${knowledgeId}`, request, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  createSuggestTopic(
    request: SuggestTopicRequest,
    lang: string
  ): Observable<SuggestTopicResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": lang,
    });

    this.setLoading(true);
    return this.http
      .post<SuggestTopicResponse>(this.suggestTopicUrl, request, { headers })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  uploadKnowledgeDocument(knowledgeId: number, formData: FormData): Observable<DocumentUploadResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .post<DocumentUploadResponse>(`${this.apiUrl}/document/upload/${knowledgeId}`, formData, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  uploadKnowledgeDocumentWithProgress(knowledgeId: number, formData: FormData): Observable<{ type: string; progress?: number; response?: DocumentUploadResponse }> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });
    this.setLoading(true);
    return this.http
      .post<DocumentUploadResponse>(`${this.apiUrl}/document/upload/${knowledgeId}`, formData, {
        headers,
        reportProgress: true,
        observe: 'events'
      })
      .pipe(
        map((event: HttpEvent<DocumentUploadResponse>) => {
          switch (event.type) {
            case HttpEventType.UploadProgress:
              const progress = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
              return { type: 'progress', progress };
            case HttpEventType.Response:
              return { type: 'response', response: event.body! };
            default:
              return { type: 'other' };
          }
        }),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  updateKnowledgeDocumentDetails(knowledgeId: number, documents: DocumentDetailsRequest[]): Observable<any> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .put(`${this.apiUrl}/document/details/set/${knowledgeId}`, { documents }, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  step3AddKnowledgeDocument(
    knowledgeId: number,
    request: AddKnowledgeDocumentRequest,
    isUpdate: boolean = false
  ): Observable<any> {
    const formData = new FormData();
    formData.append("file_name", request.file_name);
    formData.append("price", request.price);
    if (request.file) {
      formData.append("file", request.file);
    }
    formData.append("status", request.status || "active");
    if (request.description) {
      formData.append("description", request.description);
    }
    
    if (request.table_of_content) {
      request.table_of_content.forEach((chapter: any, index: number) => {
        formData.append(`table_of_content[${index}][chapter][title]`, chapter.chapter.title);
      });
    }

    if (isUpdate) {
      formData.append("_method", "PUT");
    }

    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    
    const url = isUpdate 
      ? `${this.apiUrl}/document/${knowledgeId}`
      : `${this.apiUrl}/document/upload/${knowledgeId}`;

    return this.http
      .post(url, formData, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  getListDocumentsInfo(knowledgeId: number): Observable<DocumentListResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .get<RawDocumentListResponse>(`${this.apiUrl}/document/list/${knowledgeId}`, {
        headers,
      })
      .pipe(
        map((res) => ({
          data: res.data.map(doc => ({
            ...doc,
            table_of_content: this.parseTableOfContent(doc.table_of_content)
          }))
        })),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
  getListDocumentsInfoParsed(knowledgeId: number): Observable<DocumentListResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .get<RawDocumentListResponse>(`${this.apiUrl}/document/list/${knowledgeId}`, {
        headers,
      })
      .pipe(
        map((res) => ({
          data: res.data.map(doc => ({
            ...doc,
            table_of_content: this.parseTableOfContent(doc.table_of_content)
          }))
        })),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
  private parseTableOfContent(toc: any): Chapter[] {
    try {
      // If it's already an array of chapters, return it
      if (Array.isArray(toc) && toc.every(item => item.chapter?.title)) {
        return toc;
      }

      // If it's a string, try to parse it
      if (typeof toc === 'string') {
        const parsed = JSON.parse(toc);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }

      // If we get here, either the parse failed or the data isn't in the right format
      console.warn('Invalid table of content format:', toc);
      return [];
    } catch (e) {
      console.error('Error parsing table of content:', e);
      return [];
    }
  }

  getDocumentUrl(documentId: number): Observable<DocumentUrlResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .get<DocumentUrlResponse>(`${this.apiUrl}/document/download/${documentId}`, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  getDocumentSummary(documentId: number): Observable<DocumentParserResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .get<DocumentParserResponse>(`${this.insightaHost}/api/insighter/library/knowledge/document/parser/${documentId}`, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
  runDocumentParser(documentId: number): Observable<any> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .post<any>(`${this.insightaHost}/api/insighter/library/knowledge/document/parser/${documentId}`, {}, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
  getKnowledgeParserData(knowledgeId: number): Observable<any> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .get<any>(`${this.insightaHost}/api/insighter/library/knowledge/parser/${knowledgeId}`, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  deleteKnowledgeDocument(documentId: number): Observable<any> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .delete(`${this.apiUrl}/document/${documentId}`, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  syncTagsKeywords(knowledgeId: number, request: SyncTagsKeywordsRequest): Observable<any> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .put(`${this.apiUrl}/tag-keyword/sync/${knowledgeId}`, request, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  publishKnowledge(knowledgeId: number, request: PublishKnowledgeRequest): Observable<any> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .put(`${this.apiUrl}/status/${knowledgeId}`, request, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  updateKnowledgeAbstracts(knowledgeId: number, request: UpdateKnowledgeAbstractsRequest): Observable<any> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .put(`https://api.insightabusiness.com/api/insighter/library/knowledge/abstract/document/${knowledgeId}`, request, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  updateKnowledgeDetails(knowledgeId: number, request: KnowledgeDetailsRequest): Observable<any> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .put(`${this.apiUrl}/details/${knowledgeId}`, request, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
}