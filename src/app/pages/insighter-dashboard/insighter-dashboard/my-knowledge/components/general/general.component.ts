import { Component, OnInit, HostListener, Injector, OnDestroy } from '@angular/core';
import { KnowledgeService, Knowledge } from 'src/app/_fake/services/knowledge/knowledge.service';
import { KnowldegePackegesService } from 'src/app/_fake/services/knowldege-packages/knowldege-packeges.service';
import { PageEvent } from '@angular/material/paginator';
import { trigger, state, style, animate, transition } from '@angular/animations';
import Swal from 'sweetalert2';
import { switchMap, Subject, Observable, of, Subscription } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import { DialogService } from 'primeng/dynamicdialog';
import { ScheduleDialogComponent } from '../packages/schedule-dialog/schedule-dialog.component';

interface PackageData {
  packageName: string;
  knowledge_ids: number[];
  discount: number;
}

// Add interface for filter state
interface FilterState {
  searchTerm: string;
  knowledgeType: string;
  page: number;
  timestamp?: number; // Optional timestamp for forcing refresh
}

@Component({
  selector: 'app-general',
  templateUrl: './general.component.html',
  styleUrls: ['./general.component.scss'],
  providers: [DialogService],
  animations: [
    trigger('slideInOut', [
      state('void', style({
        transform: 'translateX(100%)',
        opacity: 0
      })),
      state('*', style({
        transform: 'translateX(0)',
        opacity: 1
      })),
      transition(':enter', [
        animate('300ms ease-out')
      ]),
      transition(':leave', [
        animate('300ms ease-in')
      ])
    ]),
    trigger('columnResize', [
      transition('* => *', [
        animate('300ms ease-out')
      ])
    ])
  ]
})
export class GeneralComponent extends BaseComponent implements OnInit, OnDestroy {
  Math = Math; // Add this line for Math operations in template
  knowledges: Knowledge[] = [];
  packages: Knowledge[] = [];
  showPackageBuilder = false;
  showDialog = false;
  isSmallScreen = false;
  discount: number = 0;
  packageName: string = '';

  // Pagination variables
  currentPage: number = 1;
  totalItems: number = 0;
  itemsPerPage: number = 10;

  draggedItem: Knowledge | null = null;
  // allKnowledges: Knowledge[] = [];
  selectedKnowledge: Knowledge | null = null;

  // Add loading property
  loading: boolean = false;

  selectedKnowledges: Set<number> = new Set();
  allSelected: boolean = false;

  // Add these properties
  searchTerm: string = '';
  searchTimeout: any;
  selectedType: 'grid' | 'list' = 'list';
  selectedKnowledgeType: string = ''; // Add this property for type filter

  // Update filter state to use the interface
  filterState: FilterState = {
    searchTerm: '',
    knowledgeType: '',
    page: 1
  };
  
  // Filter change subject for debouncing
  private filterChange = new Subject<any>();

  // Cache for pagination to prevent recalculation
  private pagesCache: { [key: string]: (number | string)[] } = {};

  // Add destroy subject for cleanup
  private destroy$ = new Subject<void>();
  private filterSubscription: Subscription | null = null;
  private readonly isCompanyInsighterRole = (() => {
    try {
      if (typeof window === 'undefined') return false;
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      return Array.isArray(user?.roles) && user.roles.includes('company-insighter');
    } catch {
      return false;
    }
  })();

  constructor(
    injector: Injector,
    private knowledgeService: KnowledgeService,
    private knowldegePackegesService: KnowldegePackegesService,
    private dialogService: DialogService
  ) {
    super(injector);
  }

  canShowDeleteButton(knowledge: Knowledge): boolean {
    const requestStatus = knowledge?.account_manager_process?.request_status;
    if (requestStatus === 'declined') return false;
    if (this.isCompanyInsighterRole && requestStatus === 'pending') return false;
    return true;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  ngOnInit() {
    // Clean up any existing subscription
    if (this.filterSubscription) {
      this.filterSubscription.unsubscribe();
    }
    
    // Set up filter debounce with proper cleanup
    this.filterSubscription = this.filterChange.pipe(
      takeUntil(this.destroy$),
      debounceTime(500)
    ).subscribe(() => {
      this.loadFilteredKnowledges();
    });
    
    // Initial data load
    this.loadFilteredKnowledges();
    // this.loadAllKnowledges();
    this.checkScreenSize();
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    
    if (this.filterSubscription) {
      this.filterSubscription.unsubscribe();
      this.filterSubscription = null;
    }
  }

  private checkScreenSize() {
    this.isSmallScreen = window.innerWidth < 1040;
    if (this.isSmallScreen && this.showPackageBuilder) {
      this.showDialog = true;
      this.showPackageBuilder = false;
    }
  }

  get totalPrice(): number {
    const subtotal = this.packages.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
    return subtotal * (1 - this.discount / 100);
  }

  get subtotal(): number {
    return this.packages.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
  }

  toggleSelectAll() {
    this.allSelected = !this.allSelected;
    if (this.allSelected) {
      this.knowledges.forEach(knowledge => this.selectedKnowledges.add(knowledge.id));
    } else {
      this.selectedKnowledges.clear();
    }
  }

  toggleSelect(id: number) {
    if (this.selectedKnowledges.has(id)) {
      this.selectedKnowledges.delete(id);
      this.allSelected = false;
    } else {
      this.selectedKnowledges.add(id);
      this.allSelected = this.knowledges.every(k => this.selectedKnowledges.has(k.id));
    }
  }

  isSelected(id: number): boolean {
    return this.selectedKnowledges.has(id);
  }

  deleteSelectedKnowledges() {
    if (this.selectedKnowledges.size === 0) return;

    Swal.fire({
      title: this.lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
      text: this.lang === 'ar' ? 'لن تتمكن من التراجع عن هذا!' : "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: this.lang === 'ar' ? 'نعم، احذفهم!' : 'Yes, delete them!',
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
        const deletePromises = Array.from(this.selectedKnowledges).map(id =>
          this.knowledgeService.deleteKnowledge(id).toPromise()
        );

        Promise.all(deletePromises)
          .then(() => {
            // Remove deleted items from packages
            this.packages = this.packages.filter(pkg => !this.selectedKnowledges.has(pkg.id));
            // Remove deleted items from knowledges list
            this.knowledges = this.knowledges.filter(k => !this.selectedKnowledges.has(k.id));
            // Update total items count
            this.totalItems -= this.selectedKnowledges.size;
            // Clear selection
            this.selectedKnowledges.clear();
            this.allSelected = false;
            
            // Check if current page is now empty and we're not on the first page
            if (this.knowledges.length === 0 && this.currentPage > 1) {
              // Calculate the new page to load
              const newPage = this.totalItems > 0 ? Math.min(this.currentPage, Math.ceil(this.totalItems / this.itemsPerPage)) : 1;
              this.loadPage(newPage);
            }
            
            this.showSuccess('Selected knowledges have been deleted.', 'success');
          })
          .catch((error) => {
            console.error('Error deleting knowledges:', error);
            const errorMessage = error.error?.message || error.error?.errors?.common?.[0] || (this.lang === 'ar' ? 'حدث خطأ أثناء حذف المعارف.' : 'There was an error deleting the knowledges.');
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
          });
      }
    });
  }

  loadKnowledges(page: number) {
    // Create a new filter state object to ensure change detection
    this.filterState = {
      ...this.filterState,
      page: page
    };
    this.filterChange.next(this.filterState);
  }

  onPageChange(event: PageEvent) {
    this.itemsPerPage = event.pageSize;
    this.currentPage = event.pageIndex + 1;
    this.loadKnowledges(this.currentPage);
  }

  onDragStart(event: DragEvent, item: Knowledge) {
    if (event.dataTransfer) {
      this.draggedItem = item;
      
      // Use a more efficient approach - only transfer the ID and type
      const minimalData = {
        id: item.id,
        type: item.type,
        title: item.title,
        total_price: item.total_price
      };
      
      event.dataTransfer.setData('text', JSON.stringify(minimalData));
      
      // Set drag effect
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  onDragEnd(event: DragEvent) {
    this.draggedItem = null;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); // This is crucial!
    
    // Change cursor to indicate valid drop target
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      try {
        const data = event.dataTransfer.getData('text');
        const parsedData = JSON.parse(data);
        
        // Find the complete item in our knowledges array
        const fullItem = this.knowledges.find(k => k.id === parsedData.id);
        
        // If we found the full item and it's not already in packages
        if (fullItem && !this.packages.some(pkg => pkg.id === fullItem.id)) {
          this.packages = [...this.packages, fullItem];
        } else if (parsedData.id && !this.packages.some(pkg => pkg.id === parsedData.id)) {
          // Fall back to parsed data if we can't find the full item
          this.packages = [...this.packages, parsedData as Knowledge];
        }
      } catch (e) {
        console.error('Error processing dropped item:', e);
      }
    }
  }

  togglePackageBuilder() {
    // First reset packages if we're closing the builder
    if ((this.isSmallScreen && this.showDialog) || (!this.isSmallScreen && this.showPackageBuilder)) {
      this.resetPackageBuilder();
    }

    // Then update state variables
    if (this.isSmallScreen) {
      this.showDialog = !this.showDialog;
      this.showPackageBuilder = false; // Ensure main toggle is always false on small screens
    } else {
      this.showPackageBuilder = !this.showPackageBuilder;
      this.showDialog = false; // Ensure dialog is always closed on large screens
    }
  }

  private resetPackageBuilder() {
    this.packages = [];
    this.discount = 0;
    this.packageName = '';
  }

  hideDialog() {
    this.showDialog = false;
    this.resetPackageBuilder();
  }

  updateDiscount(event: any) {
    const value = parseFloat(event.target.value);
    this.discount = isNaN(value) ? 0 : Math.min(Math.max(value, 0), 100);
  }

  removePackageItem(item: Knowledge) {
    this.packages = this.packages.filter(pkg => pkg.id !== item.id);
  }

  savePackage(packageData: PackageData) {
    if (!packageData.packageName.trim()) {
      Swal.fire({
        title: this.lang === 'ar' ? 'خطأ' : 'Error',
        text: this.lang === 'ar' ? 'اسم الحزمة مطلوب' : 'Package name is required',
        icon: 'error',
        confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
        customClass: {
          popup: 'text-center',
          title: 'text-center',
          htmlContainer: 'text-center',
          confirmButton: 'text-center'
        }
      });
      this.loading = false;
      return;
    }

    if (packageData.knowledge_ids.length === 0) {
      Swal.fire({
        title: this.lang === 'ar' ? 'خطأ' : 'Error',
        text: this.lang === 'ar' ? 'يرجى إضافة معرفة واحدة على الأقل إلى الحزمة' : 'Please add at least one knowledge to the package',
        icon: 'error',
        confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
        customClass: {
          popup: 'text-center',
          title: 'text-center',
          htmlContainer: 'text-center',
          confirmButton: 'text-center'
        }
      });
      this.loading = false;
      return;
    }

    this.loading = true;
    this.handleAPIPackage(packageData);
  }

  handleAPIPackage(packageData: PackageData) {
    this.knowldegePackegesService.createPackage(packageData.packageName.trim()).pipe(
      switchMap((response: any) => {
        const libraryPackageId = response.data.library_package_id;
        return this.knowldegePackegesService.syncPackageKnowledge(
          libraryPackageId,
          packageData.knowledge_ids,
          packageData.discount
        );
      })
    ).subscribe(
      () => {
        Swal.fire({
          title: this.lang === 'ar' ? 'نجح' : 'Success',
          text: this.lang === 'ar' ? 'تم حفظ الحزمة بنجاح' : 'Package saved successfully',
          icon: 'success',
          confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
          customClass: {
            popup: 'text-center',
            title: 'text-center',
            htmlContainer: 'text-center',
            confirmButton: 'text-center'
          }
        }).then(() => {
          this.togglePackageBuilder();
        });
      },
      (error) => {
        console.error('Error saving package:', error);
        Swal.fire({
          title: this.lang === 'ar' ? 'خطأ' : 'Error',
          text: error.error?.message || (this.lang === 'ar' ? 'فشل حفظ الحزمة' : 'Failed to save package'),
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
    ).add(() => {
      this.loading = false;
    });
  }

  showEmittedPackage(packageData: PackageData) {
    this.savePackage(packageData);
  }

  cancelPackage() {
    this.packages = [];
  }

  loadPage(page: number) {
    this.currentPage = page;
    this.loadKnowledges(page);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }
  onPageClick(page: string | number): void {
    if (typeof page === 'number') {
      this.loadPage(page);
    }
  }

  
  getPages(): (number | string)[] {
    // Create cache key based on current state
    const cacheKey = `${this.totalPages}-${this.currentPage}`;
    
    // Return cached result if available
    if (this.pagesCache[cacheKey]) {
      return this.pagesCache[cacheKey];
    }
    
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
  
    // Cache the result
    this.pagesCache[cacheKey] = pages;
    
    return pages;
  }
  

  deleteKnowledge(knowledge: Knowledge) {
    Swal.fire({
      title: this.lang === 'ar' ? 'إزالة الملف! ' : 'Delete file!',
      text: this.lang === 'ar' ? 'هل أنت متأكد من إزالة هذا الملف؟' : "Are you sure you want to Delete this file?",
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
            // Remove from packages if exists
            this.packages = this.packages.filter(pkg => pkg.id !== knowledge.id);
            // Remove from knowledges list
            this.knowledges = this.knowledges.filter(k => k.id !== knowledge.id);
            // Update total items count
            this.totalItems--;
            
            // Check if current page is now empty and we're not on the first page
            if (this.knowledges.length === 0 && this.currentPage > 1) {
              // Calculate the new page to load
              const newPage = this.totalItems > 0 ? Math.min(this.currentPage, Math.ceil(this.totalItems / this.itemsPerPage)) : 1;
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

  // loadAllKnowledges() {
  //   this.knowledgeService.getListKnowledge().subscribe(
  //     (response) => {
  //       this.allKnowledges = response.data.slice(0, 100);
  //     },
  //     (error) => {
  //       console.error('Error fetching all knowledges:', error);
  //     }
  //   );
  // }

  onKnowledgeSelect(event: any) {
    if (event && !this.packages.some(pkg => pkg.id === event.id)) {
      this.packages = [...this.packages, event];
      this.selectedKnowledge = null;
    }
  }

  updateStatus(knowledgeId: number, status: string) {
    if (status === 'scheduled') {
      this.openScheduleDialog(knowledgeId);
    } else {
      this.setKnowledgeStatus(knowledgeId, status, new Date().toISOString());
    }
  }

  openScheduleDialog(knowledgeId: number) {
    const dialogRef = this.dialogService.open(ScheduleDialogComponent, {
      header: 'Schedule Publication',
      width: '400px'
    });

    dialogRef.onClose.subscribe((dateTime: string | null) => {
      if (dateTime) {
        this.setKnowledgeStatus(knowledgeId, 'scheduled', dateTime);
      }
    });
  }

  setKnowledgeStatus(knowledgeId: number, status: string, publishedAt: string) {
    this.knowledgeService.setKnowledgeStatus(knowledgeId, status, publishedAt).subscribe(
      () => {
        // Update the knowledge status in the local array
        const knowledge = this.knowledges.find(k => k.id === knowledgeId);
        if (knowledge) {
          knowledge.status = status;
        }
        this.showSuccess('Status updated successfully', 'success');
      },
      (error:any) => {
        console.error('Error updating status:', error);
        const errorMessage = error.error?.message || error.error?.errors?.common?.[0] || (this.lang === 'ar' ? 'حدث خطأ أثناء تحديث الحالة.' : 'There was an error updating the status.');
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

  // Refactored to use the filter state
  onSearch(event: any) {
    const value = event.target.value;
    this.searchTerm = value; // Keep this for template binding
    
    // Create a new filter state object to ensure change detection
    this.filterState = {
      ...this.filterState,
      searchTerm: value,
      page: 1
    };
    this.filterChange.next(this.filterState);
  }

  // Add this method to handle status classes
  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'published':
        return 'badge badge-light-success';
      case 'unpublished':
        return 'badge badge-light-danger';
      case 'scheduled':
        return 'badge badge-light-warning';
      default:
        return 'badge badge-light-info';
    }
  }

  onTypeChange(event: any) {
    this.selectedType = event.target.value;
  }

  // Refactored to use the filter state
  onKnowledgeTypeChange(event: any) {
    this.selectedKnowledgeType = event.target.value; // Keep this for template binding
    
    // Create a new filter state object to ensure change detection
    this.filterState = {
      ...this.filterState,
      knowledgeType: event.target.value,
      page: 1
    };
    this.filterChange.next(this.filterState);
  }
  
  // Get knowledge types for dropdown
  get knowledgeTypes(): {value: string, labelKey: string}[] {
  return [
    { value: '', labelKey: 'KNOWLEDGE.ALL' },
    { value: 'data', labelKey: 'KNOWLEDGE.DATA' },
    { value: 'statistic', labelKey: 'KNOWLEDGE.STATISTIC' },
    { value: 'course', labelKey: 'KNOWLEDGE.COURSE' },
    { value: 'report', labelKey: 'KNOWLEDGE.REPORT' },
    { value: 'manual', labelKey: 'KNOWLEDGE.MANUAL' }
  ];
}

  // New method to load filtered knowledges
  loadFilteredKnowledges() {
    this.loading = true;
    this.pagesCache = {}; // Clear pagination cache
    
    console.log('Loading with filter state:', this.filterState);
    
    this.knowledgeService.getPaginatedKnowledges(
      this.filterState.page, 
      undefined, 
      this.filterState.searchTerm, 
      this.filterState.knowledgeType
    ).subscribe(
      (response) => {
        console.log('Received API response:', response);
        this.knowledges = response.data;
        this.totalItems = response.meta.total;
        this.currentPage = response.meta.current_page;
        this.selectedKnowledges.clear();
        this.allSelected = false;
      },
      (error) => {
        console.error('Error fetching knowledges:', error);
        // Show error to user
        this.displayFilterError('Failed to load knowledge items. Please try again.');
      }
    ).add(() => {
      this.loading = false;
    });
  }
  
  // Helper method to show filter errors
  private displayFilterError(message: string) {
    Swal.fire({
      title: this.lang === 'ar' ? 'خطأ' : 'Error',
      text: message,
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

  // TrackBy functions for better rendering performance
  trackById(index: number, item: Knowledge): number {
    return item.id;
  }
  
  trackByType(index: number, item: {value: string, label: string}): string {
    return item.value;
  }
  
  trackByIndex(index: number, item: any): number {
    return index;
  }

  // Force refresh method for manual refresh button
  forceRefresh(): void {
    console.log('Manual refresh triggered');
    // Regenerate filter state with timestamp to force change detection
    this.filterState = {
      ...this.filterState,
      timestamp: Date.now() // Add timestamp to ensure it's treated as a new state
    };
    this.filterChange.next(this.filterState);
  }
  
  // Method to filter knowledge items by type when a chip is clicked
  filterByType(type: string): void {
    // Update the selected type
    this.selectedKnowledgeType = type;
    
    // Create mock event with target property for the onKnowledgeTypeChange method
    const mockEvent = {
      target: {
        value: type
      }
    };
    
    // Call the existing method that handles type filtering
    this.onKnowledgeTypeChange(mockEvent);
  }
}
