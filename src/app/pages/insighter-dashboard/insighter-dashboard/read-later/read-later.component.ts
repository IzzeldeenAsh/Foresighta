import { Component, Injector, OnInit, signal } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { ReadLaterService, ReadLaterItem, ReadLaterResponse } from './read-later.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-read-later',
  templateUrl: './read-later.component.html',
  styleUrls: ['./read-later.component.scss']
})
export class ReadLaterComponent extends BaseComponent implements OnInit {
  readLaterItems = signal<ReadLaterItem[]>([]);
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  totalItems = signal<number>(0);
  isLoading = signal<boolean>(false);
  
  filters = {
    title: '',
    type: '',
  };

  private filterTimeout: any;

  constructor(
    injector:Injector,
    private _readLater:ReadLaterService,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.loadReadLaterItems();
  }

  loadReadLaterItems(page: number = 1): void {
    const filtersToApply = this.hasActiveFilters() ? {
      title: this.filters.title,
      type: this.filters.type,
    } : undefined;

    this._readLater.getReadLaterItems(page, filtersToApply).subscribe({
      next: (response: ReadLaterResponse) => {
        this.readLaterItems.set(response.data);
        this.currentPage.set(response.meta.current_page);
        this.totalPages.set(response.meta.last_page);
        this.totalItems.set(response.meta.total);
      },
      error: (error) => {
        this.handleServerErrors(error);
      }
    });

    this._readLater.isLoading$.subscribe(loading => {
      this.isLoading.set(loading);
    });
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.loadReadLaterItems(page);
    }
  }

  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          if (error.error.type === "warning") {
            this.showWarn(
              this.lang === "ar" ? "تحذير" : "Warning",
              messages.join(", ")
            );
          } else {
            this.showError(
              this.lang === "ar" ? "حدث خطأ" : "An error occurred",
              messages.join(", ")
            );
          }
        }
      }
    } else {
      if (error.error && error.error.type === "warning") {
        this.showWarn(
          this.lang === "ar" ? "تحذير" : "Warning",
          this.lang === "ar" ? "تحذير" : "An unexpected warning occurred."
        );
      } else {
        this.showError(
          this.lang === "ar" ? "حدث خطأ" : "An error occurred",
          this.lang === "ar" ? "حدث خطأ" : "An unexpected error occurred."
        );
      }
    }
  }

  getRoleClass(role: string): string {
    switch (role) {
      case 'company':
      case 'company-insighter':
        return 'badge badge-light-info';
      case 'insighter':
        return 'badge badge-light-success';
      default:
        return 'badge badge-light-secondary';
    }
  }

  getRoleLabel(role: string, companyLegalName: string=''): string {
    switch (role) {
      case 'company':
        return 'Company';
      case 'company-insighter':
        return companyLegalName ? `${companyLegalName} Insighter` : 'Company Insighter';
      case 'insighter':
        return companyLegalName ? `${companyLegalName} Insighter` : 'Insighter';
      default:
        return role;
    }
  }

  viewKnowledge(item: ReadLaterItem): void {
    const url = `https://insightabusiness.com/${this.lang}/knowledge/${item.type}/${item.slug}`;
    window.open(url, '_blank');
  }

  formatPrice(price: string): string {
    const numPrice = parseFloat(price);
    return isNaN(numPrice) ? price : numPrice.toFixed(2);
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) {
      return diffYears === 1 ? 
        (this.lang === 'ar' ? 'سنة' : '1 year ago') : 
        (this.lang === 'ar' ? `${diffYears} سنوات` : `${diffYears} years ago`);
    } else if (diffMonths > 0) {
      return diffMonths === 1 ? 
        (this.lang === 'ar' ? 'شهر' : '1 month ago') : 
        (this.lang === 'ar' ? `${diffMonths} أشهر` : `${diffMonths} months ago`);
    } else if (diffWeeks > 0) {
      return diffWeeks === 1 ? 
        (this.lang === 'ar' ? 'أسبوع' : '1 week ago') : 
        (this.lang === 'ar' ? `${diffWeeks} أسابيع` : `${diffWeeks} weeks ago`);
    } else if (diffDays > 0) {
      return diffDays === 1 ? 
        (this.lang === 'ar' ? 'يوم' : '1 day ago') : 
        (this.lang === 'ar' ? `${diffDays} أيام` : `${diffDays} days ago`);
    } else {
      return this.lang === 'ar' ? 'اليوم' : 'Today';
    }
  }

  isPaid(price: string): boolean {
    const numPrice = parseFloat(price);
    return !isNaN(numPrice) && numPrice > 0;
  }

  getInitials(name: string): string {
    if (!name) return '';
    
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  async deleteReadLaterItem(item: ReadLaterItem): Promise<void> {
    const isArabic = this.lang === 'ar';
    
    const result = await Swal.fire({
      title: isArabic ? 'هل أنت متأكد؟' : 'Are you sure?',
      text: isArabic ? 
        `هل تريد إزالة "${item.title}" من قائمة القراءة اللاحقة؟` : 
        `Do you want to remove "${item.title}" from your read later list?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: isArabic ? 'نعم، احذف' : 'Yes, remove it!',
      cancelButtonText: isArabic ? 'إلغاء' : 'Cancel',
      reverseButtons: isArabic
    });

    if (result.isConfirmed) {
      this._readLater.deleteReadLaterItem(item.slug).subscribe({
        next: () => {
          // Remove item from the list
          const currentItems = this.readLaterItems();
          const updatedItems = currentItems.filter(readItem => readItem.slug !== item.slug);
          this.readLaterItems.set(updatedItems);
          
          // Update total count
          this.totalItems.update(count => count - 1);
          
          // Show success message
          this.showSuccess(
            isArabic ? 'تم الحذف' : 'Removed',
            isArabic ? 'تم إزالة العنصر من قائمة القراءة اللاحقة' : 'Item removed from read later list'
          );

          // If current page is empty and not the first page, go to previous page
          if (updatedItems.length === 0 && this.currentPage() > 1) {
            this.onPageChange(this.currentPage() - 1);
          }
        },
        error: (error) => {
          this.handleServerErrors(error);
        }
      });
    }
  }

  onFilterChange(): void {
    clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => {
      this.currentPage.set(1);
      this.loadReadLaterItems(1);
    }, 500);
  }

  hasActiveFilters(): boolean {
    return !!(this.filters.title?.trim() || this.filters.type);
  }

  clearFilters(): void {
    this.filters = {
      title: '',
      type: '',
    };
    this.currentPage.set(1);
    this.loadReadLaterItems(1);
  }

  /**
   * Get subtitle for the page header
   */
  getReadLaterSubtitle(): string {
    const totalItems = this.totalItems();

    if (this.lang === 'ar') {
      // Arabic and English subtitle as in the image box
      return `المستندات التي حفظتها للمراجعة أو الشراء لاحقًا.`;
    }

    return `Insights you've saved to review or buy later.`;
  }
}