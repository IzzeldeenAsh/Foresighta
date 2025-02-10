import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KnowledgeService, Knowledge } from 'src/app/_fake/services/knowledge/knowledge.service';

@Component({
  selector: 'app-scheduled',
  templateUrl: './scheduled.component.html',
})
export class ScheduledComponent implements OnInit {
  knowledges: Knowledge[] = [];
  currentPage: number = 1;
  totalPages: number = 1;
  totalItems: number = 0;
  searchTerm: string = '';
  searchTimeout: any;

  constructor(
    private knowledgeService: KnowledgeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPage(1);
  }

  onSearch(event: any) {
    const value = event.target.value;
    this.searchTerm = value;
    
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Set new timeout for debouncing
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1; // Reset to first page when searching
      this.loadPage(this.currentPage);
    }, 300); // 300ms debounce
  }

  loadPage(page: number): void {
    this.knowledgeService.getPaginatedKnowledges(page, 'scheduled', this.searchTerm).subscribe(
      (response) => {
        this.knowledges = response.data;
        this.currentPage = response.meta.current_page;
        this.totalPages = response.meta.last_page;
        this.totalItems = response.meta.total;
      }
    );
  }

  onPageClick(page: string | number): void {
    if (typeof page === 'number') {
      this.loadPage(page);
    }
  }

  
  getPages(): (number | string)[] {
    const totalPages = this.totalPages;
    const currentPage = this.currentPage;
    const delta = 2; // Number of pages to show on either side of current page
    let pages: (number | string)[] = [];
  
    // Determine the left and right bounds of the page window
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);
  
    // Always include the first page
    pages.push(1);
  
    // Insert left ellipsis if needed
    if (left > 2) {
      pages.push('...');
    }
  
    // Add the range of pages
    for (let i = left; i <= right; i++) {
      pages.push(i);
    }
  
    // Insert right ellipsis if needed
    if (right < totalPages - 1) {
      pages.push('...');
    }
  
    // Always include the last page (if there is more than one page)
    if (totalPages > 1) {
      pages.push(totalPages);
    }
  
    return pages;
  }

  deleteKnowledge(knowledge: Knowledge): void {
    if (confirm('Are you sure you want to delete this knowledge?')) {
      this.knowledgeService.deleteKnowledge(knowledge.id).subscribe(
        () => {
          this.loadPage(this.currentPage);
        }
      );
    }
  }

  publishKnowledge(knowledgeId: number): void {
    this.knowledgeService.setKnowledgeStatus(knowledgeId, 'published', new Date().toISOString()).subscribe(
      () => {
        this.loadPage(this.currentPage);
      }
    );
  }

  editKnowledge(knowledgeId: number): void {
    this.router.navigate(['/']);
  }
} 