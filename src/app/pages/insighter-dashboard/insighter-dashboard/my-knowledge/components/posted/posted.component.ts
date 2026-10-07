import { Component, OnInit, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { KnowledgeService, Knowledge } from 'src/app/_fake/services/knowledge/knowledge.service';
import Swal from 'sweetalert2';
import { BaseComponent } from 'src/app/modules/base.component';

@Component({
  selector: 'app-posted',
  templateUrl: './posted.component.html',
  styleUrls: ['./posted.component.scss']
})
export class PostedComponent extends BaseComponent implements OnInit {
  knowledges: Knowledge[] = [];
  loading: boolean = false;
  currentPage: number = 1;
  totalPages: number = 1;
  totalItems: number = 0;
  searchTerm: string = '';
  searchTimeout: any;
  selectedType: string = 'grid'; // Default view type

  // Type filtering
  selectedKnowledgeType: string = ''; // Empty means all types

  constructor(
    injector: Injector,
    private knowledgeService: KnowledgeService,
    private router: Router
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.loadPage(1);
  }

  // Filter knowledges by type
  filterByType(type: string): void {
    this.selectedKnowledgeType = type;
    this.currentPage = 1; // Reset to first page when filtering
    this.loadPage(this.currentPage);
  }

  loadPage(page: number): void {
    this.loading = true;
    this.knowledgeService.getPaginatedKnowledges(
      page, 
      'published', 
      this.searchTerm,
      this.selectedKnowledgeType // Pass the type filter
    ).subscribe(
      (response) => {
        this.knowledges = response.data;
        this.currentPage = response.meta.current_page;
        this.totalPages = response.meta.last_page;
        this.totalItems = response.meta.total;
        
        
        this.loading = false;
      },
      (error) => {
        console.error('Error loading knowledge data:', error);
        this.loading = false;
      }
    );
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

  onPageClick(page: string | number): void {
    if (typeof page === 'number') {
      this.loadPage(page);
    }
    // If page is ellipsis ('...'), do nothing
  }

  trackById(index: number, item: Knowledge): number {
    return item.id;
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }

  onTypeChange(event: any): void {
    this.selectedType = event.target.value;
  }

  getStatusDisplayLabel(knowledge: Knowledge): string {
    return knowledge.status_label || (knowledge.status === 'unpublished' ? 'Draft' : knowledge.status);
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
    Swal.fire({
      title: this.lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
      text: this.lang === 'ar' ? 'لن تتمكن من التراجع عن هذا!' : "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: this.lang === 'ar' ? 'نعم، احذفه!' : 'Yes, delete it!',
      cancelButtonText: this.lang === 'ar' ? 'إلغاء' : 'Cancel',
      customClass: {
            popup: 'text-center',
            title: 'text-center',
            htmlContainer: 'text-center',
            confirmButton: 'text-center',
            cancelButton: 'text-center'
          }
    }).then((result) => {
      if (result.isConfirmed) {
        this.knowledgeService.deleteKnowledge(knowledge.id).subscribe(
          () => {
                    this.knowledges = this.knowledges.filter(k => k.id !== knowledge.id);
            this.totalItems--;
            
            // Check if current page is now empty and we're not on the first page
            if (this.knowledges.length === 0 && this.currentPage > 1) {
              // Calculate the new page to load
              const newPage = this.totalItems > 0 ? Math.min(this.currentPage, Math.ceil(this.totalItems / 10)) : 1;
              this.loadPage(newPage);
            }
            
            this.showSuccess('Knowledge has been deleted.', 'success');
          },
          (error) => {
            console.error('Error deleting knowledge:', error);
            const errorMessage = error.error?.message || error.error?.errors?.common?.[0] || (this.lang === 'ar' ? 'حدث خطأ أثناء حذف المعرفة.' : 'There was an error deleting the knowledge.');
            Swal.fire({
              title: this.lang === 'ar' ? 'خطأ!' : 'Error!',
              text: errorMessage,
              icon: 'error',
              confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
              customClass: {
                popup: 'text-center',
                title: 'text-center',
                htmlContainer: 'text-center',
                confirmButton: 'text-center'
              }
            });
          }
        );
      }
    });
  }

  editKnowledge(knowledgeId: number): void {
    this.router.navigate(['/app/edit-knowledge/stepper', knowledgeId]);
  }

  unpublishKnowledge(knowledgeId: number): void {
    Swal.fire({
      title: this.lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
      text: this.lang === 'ar' ? 'أنت على وشك إلغاء نشر هذه المعرفة. لن تكون مرئية للمستخدمين بعد الآن.' : "You are about to unpublish this knowledge. It will no longer be visible to users.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: this.lang === 'ar' ? 'نعم، ألغِ نشره!' : 'Yes, unpublish it!',
      cancelButtonText: this.lang === 'ar' ? 'إلغاء' : 'Cancel',
      customClass: {
            popup: 'text-center',
            title: 'text-center',
            htmlContainer: 'text-center',
            confirmButton: 'text-center',
            cancelButton: 'text-center'
          }
    }).then((result) => {
      if (result.isConfirmed) {
        this.knowledgeService.setKnowledgeStatus(knowledgeId, 'unpublished', new Date().toISOString()).subscribe(
          () => {
            this.loadPage(this.currentPage);
            Swal.fire({
              title: this.lang === 'ar' ? 'تم إلغاء النشر!' : 'Unpublished!',
              text: this.lang === 'ar' ? 'تم إلغاء نشر المعرفة.' : 'The knowledge has been unpublished.',
              icon: 'success',
              confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
              customClass: {
                popup: 'text-center',
                title: 'text-center',
                htmlContainer: 'text-center',
                confirmButton: 'text-center'
              }
            });
          }
        );
      }
    });
  }
}
