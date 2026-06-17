import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KnowledgeService, Knowledge } from 'src/app/_fake/services/knowledge/knowledge.service';
import { trigger, state, style, animate, transition } from '@angular/animations';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-scheduled',
  templateUrl: './scheduled.component.html',
  styleUrls: ['./scheduled.component.scss'],
  animations: [
    trigger('columnResize', [
      transition('* => *', [
        animate('300ms ease-out')
      ])
    ])
  ]
})
export class ScheduledComponent implements OnInit {
  knowledges: Knowledge[] = [];
  allKnowledges: Knowledge[] = [];
  currentPage: number = 1;
  totalPages: number = 1;
  totalItems: number = 0;
  searchTerm: string = '';
  searchTimeout: any;
  loading: boolean = false;
  selectedType: 'grid' | 'list' = 'grid';
  selectedKnowledgeType: string = '';

  constructor(
    private knowledgeService: KnowledgeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPage(1);
    this.loadAllKnowledges();
  }

  loadAllKnowledges() {
    this.knowledgeService.getListKnowledge().subscribe(
      (knowledges) => {
        this.allKnowledges = knowledges.data.filter(k => k.status === 'scheduled');
      }
    );
  }

  // Filter knowledges by type
  filterByType(type: string): void {
    this.selectedKnowledgeType = type;
    this.currentPage = 1; // Reset to first page when filtering
    this.loadPage(this.currentPage);
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

  onTypeChange(event: any) {
    this.selectedType = event.target.value;
  }

  getStatusDisplayLabel(knowledge: Knowledge): string {
    return knowledge.status_label || (knowledge.status === 'unpublished' ? 'Draft' : knowledge.status === 'in_review' ? 'In Review' : knowledge.status);
  }

  loadPage(page: number): void {
    this.loading = true;
    this.knowledgeService.getPaginatedKnowledges(page, 'scheduled', this.searchTerm, this.selectedKnowledgeType).subscribe(
      (response) => {
        this.knowledges = response.data;
        this.currentPage = response.meta.current_page;
        this.totalPages = response.meta.last_page;
        this.totalItems = response.meta.total;
        
      },
      (error) => {
        console.error('Error fetching scheduled knowledges:', error);
        Swal.fire({
          title: 'Error',
          text: 'Failed to load scheduled items. Please try again.',
          icon: 'error'
        });
      }
    ).add(() => {
      this.loading = false;
    });
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
          // Remove the item from the local array first
          this.knowledges = this.knowledges.filter(k => k.id !== knowledge.id);
          this.totalItems--;
          
          // Check if current page is now empty and we're not on the first page
          if (this.knowledges.length === 0 && this.currentPage > 1) {
            // Calculate the new page to load
            const newPage = this.totalItems > 0 ? Math.min(this.currentPage, Math.ceil(this.totalItems / 10)) : 1;
            this.loadPage(newPage);
          }
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

  // TrackBy functions for better rendering performance
  trackById(index: number, item: Knowledge): number {
    return item.id;
  }
  
  trackByIndex(index: number, item: any): number {
    return index;
  }
} 
