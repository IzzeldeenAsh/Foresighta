import { Component, Injector, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DocumentListResponse } from 'src/app/_fake/services/add-insight-steps/add-insight-steps.service';
import { KnowledgeService } from 'src/app/_fake/services/knowledge/knowledge.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BaseComponent } from 'src/app/modules/base.component';

@Component({
  selector: 'app-review-knowledge-details',
  templateUrl: './review-knowledge-details.component.html',
  styleUrls: ['./review-knowledge-details.component.scss'],
  animations: [
    trigger('fadeInMoveY', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('300ms ease-in', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class ReviewKnowledgeDetailsComponent extends BaseComponent implements OnInit {
  knowledgeId: number;
  documents: any[] = [];
  activeDocumentId: number | null = null;
  knowledge: any;
  
  constructor(
    injector:Injector,
    private route: ActivatedRoute,
    private knowledgeService: KnowledgeService,
    private http: HttpClient,
    
  ) {
    super(injector);
  }

  ngOnInit(): void {
    // Get the knowledge ID from the parent route
    this.route.parent?.params.subscribe(params => {
      this.knowledgeId = +params['id'];
      this.loadData();
    });
  }

  loadData(): void {
    // Get knowledge data from the parent component
    this.route.parent?.snapshot.data['knowledge'] && 
      (this.knowledge = this.route.parent.snapshot.data['knowledge']);

    if (this.knowledgeId) {
      // Get knowledge if not already available
      if (!this.knowledge) {
        // Define headers for the request
        const headers = new HttpHeaders({
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Accept-Language': this.lang
        });
        
        // Use company API endpoint to get knowledge data
        this.http.get<any>(`https://api.foresighta.co/api/company/library/knowledge/${this.knowledgeId}`, { headers })
          .subscribe({
            next: (response) => {
              this.knowledge = response.data;
            },
            error: (error) => {
              console.error('Error loading knowledge data:', error);
            }
          });
      }

      // Load documents - skip for now since it might cause 403 errors
      
      this.knowledgeService.getReviewDocumentsList(this.knowledgeId).subscribe(
        (response: DocumentListResponse) => {
          this.documents = response.data;
        }
      );
      
    }
  }

  toggleCollapse(documentId: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.activeDocumentId = this.activeDocumentId === documentId ? null : documentId;
  }

  onDocumentMouseEnter(documentId: number): void {
    // Not used for any functionality in the review component
  }

  onDocumentMouseLeave(documentId: number): void {
    // Not used for any functionality in the review component
  }

  getFileIconByExtension(extension: string): string {
    const extensionMap: { [key: string]: string } = {
      pdf: './assets/media/svg/new-files/pdf.svg',
      doc: './assets/media/svg/new-files/doc.svg',
      docx: './assets/media/svg/new-files/docx.svg',
      xls: './assets/media/svg/new-files/xls.svg',
      ppt: './assets/media/svg/new-files/ppt.svg',
      pptx: './assets/media/svg/new-files/pptx.svg',
      txt: './assets/media/svg/new-files/txt.svg',
      zip: './assets/media/svg/new-files/zip.svg',
      xlsx: './assets/media/svg/new-files/xlsx.svg',
      default: './assets/media/svg/new-files/default.svg',
    };

    return extensionMap[extension.toLowerCase()] || 'assets/icons/file.svg';
  }

  shouldShowTableOfContents(doc: any): boolean {
    return doc.type !== 'insight';
  }
} 