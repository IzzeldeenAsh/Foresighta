import { Component, OnInit, signal, computed, inject, DestroyRef, Injector, Inject, HostListener, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Observable, debounceTime, distinctUntilChanged, of, take } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { BaseComponent } from 'src/app/modules/base.component';
import { ComponentCanDeactivate } from 'src/app/guards/pending-changes.guard';

import { Router, ActivatedRoute } from '@angular/router';

import { Document, KnowledgeItem, MyDownloadsService, LibraryStatistics } from './my-downloads.service';
import { FileSizePipe } from 'src/app/pipes/file-size-pipe/file-size.pipe';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';


@Component({
  selector: 'app-my-downloads',
  templateUrl: './my-downloads.component.html',
  styleUrls: ['./my-downloads.component.scss']
})
export class MyDownloadsComponent extends BaseComponent implements OnInit, AfterViewInit, ComponentCanDeactivate {
  private static readonly PROMPT_IMAGE_URL_EN =
    'https://res.cloudinary.com/dsiku9ipv/image/upload/v1774703126/418842237_70d13ee0-5e30-4521-8a99-057840ea5113_cmhjeq.webp';
  private static readonly PROMPT_IMAGE_URL_AR =
    'https://res.cloudinary.com/dsiku9ipv/image/upload/v1774703126/whatsapp_arabic_bbrfku.webp';
  private static readonly NOTIFICATION_SETTINGS_URL =
    '/app/insighter-dashboard/account-settings/notification-settings';
  private static readonly ARABIC_CHAR_REGEX =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/;
  private static readonly LETTER_REGEX = /\p{L}/u;

  //Signals
  knowledgeItems = signal<KnowledgeItem[]>([]);
  selectedKnowledge = signal<KnowledgeItem | null >(null);
  selectedDocument = signal<Document| null> (null);
  loading = signal<boolean>(false);
  // Replace single downloadLoading signal with Set to track individual item loading
  downloadingItems = signal<Set<string>>(new Set());

  //Pagination Signals
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  totalItems = signal<number>(0);
  perPage = signal<number>(15);

  // Search state
  searchControl = new FormControl('');
  currentSearchTerm = signal<string>('');
  currentUuids = signal<string[]>([]);

  // UI state
  selectedColumn = signal<'knowledge' | 'document' | 'details'>('knowledge');

  // Archived downloads state
  showArchivedDownloads = signal<boolean>(false);
  archivedKnowledgeItems = signal<KnowledgeItem[]>([]);
  archivedCurrentPage = signal<number>(1);
  archivedTotalPages = signal<number>(1);
  archivedTotalItems = signal<number>(0);

  // Library statistics
  libraryStatistics = signal<LibraryStatistics | null>(null);
  showAddChannelsPrompt = false;
  private pendingNavigationObserver: { next: (value: boolean) => void; complete: () => void } | null = null;
  private allowPromptBypass = false;
  // URL-param selection/highlight state
  selectFirstAfterLoad = signal<boolean>(false);
  highlightedKnowledgeUuid = signal<string | null>(null);
  
  // Scroll state
  canScrollUp = signal<boolean>(false);
  canScrollDown = signal<boolean>(false);
  showScrollButton = computed(() => {
    const up = this.canScrollUp();
    const down = this.canScrollDown();
    
    // Priority: show down button when both are possible (user likely wants to see more content)
    // Only show up button when can't scroll down anymore
    if (down) return 'down';
    if (up) return 'up';
    return null;
  });
  
  @ViewChild('knowledgeList', { static: false }) knowledgeListElement!: ElementRef;
  
  //Computed Properties
  currentKnowledgeDocuments = computed(()=>{
    const knowledge = this.selectedKnowledge();
    return knowledge?.documents || []
  });

  currentKnowledgeDetails = computed (()=>{
    const knowledge = this.selectedKnowledge();
    if(!knowledge) return null
    return {
      type:knowledge.type,
      publisher:knowledge.insighter,
      purchaseDate: knowledge.purchase_date,
      slug:knowledge.knowledge_slug
    }
  })

  // Get current knowledge items based on archive state
  currentKnowledgeItems = computed(() => {
    return this.showArchivedDownloads() ? this.archivedKnowledgeItems() : this.knowledgeItems();
  });

  // Get current pagination based on archive state
  currentDisplayPage = computed(() => {
    return this.showArchivedDownloads() ? this.archivedCurrentPage() : this.currentPage();
  });

  currentDisplayTotalPages = computed(() => {
    return this.showArchivedDownloads() ? this.archivedTotalPages() : this.totalPages();
  });

  currentDisplayTotalItems = computed(() => {
    return this.showArchivedDownloads() ? this.archivedTotalItems() : this.totalItems();
  });

  hasNextPage = computed(() => this.currentDisplayPage() < this.currentDisplayTotalPages());
  hasPrevPage = computed(() => this.currentDisplayPage() > 1);
  
  //Services
  private myDownloadsService = inject(MyDownloadsService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private elementRef = inject(ElementRef);
  private profileService = inject(ProfileService);

  Math = Math;

  constructor(
    injector:Injector,
    private _mydownloads:MyDownloadsService,
  ) {
    super(injector)
   }

  canDeactivate(): boolean | Observable<boolean> {
    if (this.allowPromptBypass) {
      this.allowPromptBypass = false;
      return true;
    }

    if (this.pendingNavigationObserver || this.showAddChannelsPrompt) {
      return false;
    }

    return new Observable<boolean>((observer) => {
      this.profileService
        .getProfile()
        .pipe(
          take(1),
          catchError(() => of(null))
        )
        .subscribe((profile) => {
          if (!this.shouldPromptForMissingChannels(profile)) {
            observer.next(true);
            observer.complete();
            return;
          }

          this.pendingNavigationObserver = observer;
          this.showAddChannelsPrompt = true;
        });
    });
  }

  ngOnInit(): void {
    // Load library statistics first
    this.loadLibraryStatistics();

    // Check for search query param first
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        if (params['search']) {
          // Do not backend-filter; clear any search/ui state and select first after load
          this.searchControl.setValue('', { emitEvent: false });
          this.currentSearchTerm.set('');
          this.currentUuids.set([]);
          this.selectFirstAfterLoad.set(true);
          this.highlightedKnowledgeUuid.set(null);
          this.loadMyDownloads(1);
        } else if (params['uuids']) {
          // Handle multiple UUIDs passed as comma-separated string
          // Do not backend-filter; clear any search/ui state and select first after load
          this.currentUuids.set([]);
          this.currentSearchTerm.set('');
          this.searchControl.setValue('', { emitEvent: false });
          this.selectFirstAfterLoad.set(true);
          this.highlightedKnowledgeUuid.set(null);
          this.loadMyDownloads(1);
        } else if (params['uuid']) {
          // Do not backend-filter; clear any search/ui state and select first after load
          this.currentUuids.set([]);
          this.currentSearchTerm.set('');
          this.searchControl.setValue('', { emitEvent: false });
          this.selectFirstAfterLoad.set(true);
          this.highlightedKnowledgeUuid.set(null);
          this.loadMyDownloads(1);
        } else {
          this.loadMyDownloads();
        }
      });

    //loading states
    this._mydownloads.isLoading$
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(loading => this.loading.set(loading));

    // Setup search with debounce
    this.searchControl.valueChanges
      .pipe(
        debounceTime(500), // Wait 500ms after user stops typing
        distinctUntilChanged(), // Only trigger if value actually changed
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(searchTerm => {
        this.currentSearchTerm.set(searchTerm || '');
        this.currentUuids.set([]); // Clear UUIDs when searching by title
        this.currentPage.set(1); // Reset to first page when searching
        this.selectedKnowledge.set(null); // Clear selection when searching
        this.selectedDocument.set(null);
        this.highlightedKnowledgeUuid.set(null);

        // Reset archived state when searching
        if (this.showArchivedDownloads()) {
          this.showArchivedDownloads.set(false);
        }

        this.loadMyDownloads(1, searchTerm || '', []);
      });
   
  }

  ngAfterViewInit(): void {
    // Check scroll state after view initializes
    setTimeout(() => {
      this.checkScrollState();
    }, 100);
  }

  get addChannelsPromptImageUrl(): string {
    return this.lang === 'ar'
      ? MyDownloadsComponent.PROMPT_IMAGE_URL_AR
      : MyDownloadsComponent.PROMPT_IMAGE_URL_EN;
  }

  get addChannelsPromptCopy(): { close: string; later: string; add: string } {
    if (this.lang === 'ar') {
      return { close: 'إغلاق', later: 'لاحقاً', add: 'إضافة الآن' };
    }

    return { close: 'Close', later: 'Maybe later', add: 'Add' };
  }

  loadMyDownloads(page: number = 1, searchTerm: string = '', uuids: string[] = []): void {
    this._mydownloads.getMyDownloads(page, searchTerm || undefined, uuids.length > 0 ? uuids : undefined)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next:(response) =>{
        // Preserve current selection UUIDs before swapping arrays
        const prevSelectedKnowledgeUuid = this.selectedKnowledge()?.uuid || null;
        const prevSelectedDocumentUuid = this.selectedDocument()?.uuid || null;
        this.knowledgeItems.set(response.data);
        this.currentPage.set(response.meta.current_page);
        this.totalPages.set(response.meta.last_page);
        this.totalItems.set(response.meta.total);
        this.perPage.set(response.meta.per_page);

        // Auto-select first item if search term is provided and matches
        if (searchTerm && response.data.length > 0 && !this.selectedKnowledge()) {
          this.selectedKnowledge.set(response.data[0]);
        }
        
        // Auto-select first item if UUIDs are provided
        if (uuids && uuids.length > 0 && response.data.length > 0 && !this.selectedKnowledge()) {
          this.selectedKnowledge.set(response.data[0]);
        }
        // When coming from URL params and not filtering: select first and highlight
        if (this.selectFirstAfterLoad() && response.data.length > 0) {
          const first = response.data[0];
          this.selectedKnowledge.set(first);
          this.highlightedKnowledgeUuid.set(first.uuid);
          this.selectFirstAfterLoad.set(false);
        }
        // Re-bind selection to instances from the newly loaded array
        if (prevSelectedKnowledgeUuid) {
          const updatedSelectedKnowledge = response.data.find(k => k.uuid === prevSelectedKnowledgeUuid) || null;
          if (updatedSelectedKnowledge) {
            this.selectedKnowledge.set(updatedSelectedKnowledge);
            if (prevSelectedDocumentUuid) {
              const updatedSelectedDocument = (updatedSelectedKnowledge.documents || []).find(d => d.uuid === prevSelectedDocumentUuid) || null;
              if (updatedSelectedDocument) {
                this.selectedDocument.set(updatedSelectedDocument);
              }
            }
          } else {
            this.selectedKnowledge.set(null);
            this.selectedDocument.set(null);
          }
        }
        
        // Check scroll state after data loads
        setTimeout(() => {
          this.checkScrollState();
        }, 100);
      },
      error: (error)=>{
        console.error('Error loading downloads:', error);
        this.showError('Error', 'Failed to load downloads. Please try again.');
      }
    })
  }

  selectKnowledge(knowledge:KnowledgeItem):void{
    this.selectedKnowledge.set(knowledge);
    this.selectedDocument.set(null);
    this.selectedColumn.set('document');
  }

  selectDocument(document:Document):void{
    this.selectedDocument.set(document);
    this.selectedColumn.set('details');
  }

  downloadKnowledge(knowledge: KnowledgeItem): void {
    // Add knowledge UUID to downloading items
    this.downloadingItems.update(items => new Set(items).add(knowledge.uuid));

    let downloadProcessed = false;

    this.myDownloadsService.downloadKnowledge(knowledge.uuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          try {
            // Validate blob exists
            if (!blob || !(blob instanceof Blob)) {
              throw new Error('Invalid response: expected Blob');
            }

            this.downloadFile(blob, `${knowledge.title}.zip`);
            downloadProcessed = true; // Mark as processed after download starts

            // Immediately update local data to show downloaded state
            const currentTime = new Date().toISOString();
            this.knowledgeItems.update(items =>
              items.map(item =>
                item.uuid === knowledge.uuid
                  ? { ...item, download_at: currentTime }
                  : item
              )
            );

            // Update archived items if they exist
            if (this.archivedKnowledgeItems().length > 0) {
              this.archivedKnowledgeItems.update(items =>
                items.map(item =>
                  item.uuid === knowledge.uuid
                    ? { ...item, download_at: currentTime }
                    : item
                )
              );
            }

            // Remove knowledge UUID from downloading items
            this.downloadingItems.update(items => {
              const newItems = new Set(items);
              newItems.delete(knowledge.uuid);
              return newItems;
            });

            // Re-bind selectedKnowledge to updated instance immediately if it is currently selected
            if (this.selectedKnowledge()?.uuid === knowledge.uuid) {
              const updatedItem = this.knowledgeItems().find(k => k.uuid === knowledge.uuid) || null;
              if (updatedItem) {
                this.selectedKnowledge.set(updatedItem);
              }
            }

            // Refresh the data to show updated download_at field
            this.reloadCurrentDownloads();
          } catch (error) {
            // Handle errors in the next handler (e.g., invalid blob)
            console.error('Error processing knowledge download:', error);
            // Don't show error if blob was received - the download likely succeeded
            // Only show error if blob is invalid
            if (!blob || !(blob instanceof Blob)) {
              this.showError('Error', 'Failed to download knowledge. Invalid response from server.');
            }
            // Remove knowledge UUID from downloading items
            this.downloadingItems.update(items => {
              const newItems = new Set(items);
              newItems.delete(knowledge.uuid);
              return newItems;
            });
          }
        },
        error: (error) => {
          console.error('Error downloading knowledge:', error);
          // Only show error if download hasn't been processed yet
          if (!downloadProcessed) {
            this.showError('Error', 'Failed to download knowledge. Please try again.');
          }
          // Remove knowledge UUID from downloading items
          this.downloadingItems.update(items => {
            const newItems = new Set(items);
            newItems.delete(knowledge.uuid);
            return newItems;
          });
        }
      });
  }

  downloadDocument(document: Document): void {
    // Add document UUID to downloading items
    this.downloadingItems.update(items => new Set(items).add(document.uuid));

    let downloadProcessed = false;

    this.myDownloadsService.downloadDocument(document.uuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          try {
            // Validate response has a URL
            if (!response || !response.url) {
              throw new Error('Invalid response: missing download URL');
            }

            // Open the URL in a new tab to download the file
            const downloadWindow = window.open(response.url, '_blank');
            
            // Check if popup was blocked (window.open returns null)
            if (!downloadWindow) {
              // Popup was blocked, but download might still work via direct navigation
              // Try alternative method: create a temporary link
              const link = window.document.createElement('a');
              link.href = response.url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              window.document.body.appendChild(link);
              link.click();
              window.document.body.removeChild(link);
            }

            downloadProcessed = true; // Mark as processed after download starts

            // Immediately update local data to show downloaded state
            const currentTime = new Date().toISOString();
            this.knowledgeItems.update(items =>
              items.map(knowledge => ({
                ...knowledge,
                documents: knowledge.documents.map(doc =>
                  doc.uuid === document.uuid
                    ? { ...doc, download_at: currentTime }
                    : doc
                )
              }))
            );

            // Update archived items if they exist
            if (this.archivedKnowledgeItems().length > 0) {
              this.archivedKnowledgeItems.update(items =>
                items.map(knowledge => ({
                  ...knowledge,
                  documents: knowledge.documents.map(doc =>
                    doc.uuid === document.uuid
                      ? { ...doc, download_at: currentTime }
                      : doc
                  )
                }))
              );
            }

            // Remove document UUID from downloading items
            this.downloadingItems.update(items => {
              const newItems = new Set(items);
              newItems.delete(document.uuid);
              return newItems;
            });

            // Re-bind selectedKnowledge and selectedDocument to updated instances immediately if selected
            const currentSelectedKnowledgeUuid = this.selectedKnowledge()?.uuid || null;
            if (currentSelectedKnowledgeUuid) {
              const updatedKnowledge = this.knowledgeItems().find(k => k.uuid === currentSelectedKnowledgeUuid) || null;
              if (updatedKnowledge) {
                this.selectedKnowledge.set(updatedKnowledge);
                if (this.selectedDocument()?.uuid === document.uuid) {
                  const updatedDoc = (updatedKnowledge.documents || []).find(d => d.uuid === document.uuid) || null;
                  if (updatedDoc) {
                    this.selectedDocument.set(updatedDoc);
                  }
                }
              }
            }

            // Refresh the data to show updated download_at field
            this.reloadCurrentDownloads();
          } catch (error) {
            // Handle errors in the next handler (e.g., invalid response structure)
            console.error('Error processing document download:', error);
            // Don't show error if download URL was received - the download likely succeeded
            // Only show error if response structure is invalid
            if (!response || !response.url) {
              this.showError('Error', 'Failed to download document. Invalid response from server.');
            }
            // Remove document UUID from downloading items
            this.downloadingItems.update(items => {
              const newItems = new Set(items);
              newItems.delete(document.uuid);
              return newItems;
            });
          }
        },
        error: (error) => {
          console.error('Error downloading document:', error);
          // Only show error if download hasn't been processed yet
          if (!downloadProcessed) {
            this.showError('Error', 'Failed to download document. Please try again.');
          }
          // Remove document UUID from downloading items
          this.downloadingItems.update(items => {
            const newItems = new Set(items);
            newItems.delete(document.uuid);
            return newItems;
          });
        }
      });
  }

  // Helper methods to check loading state for specific items
  isKnowledgeDownloading(knowledgeUuid: string): boolean {
    return this.downloadingItems().has(knowledgeUuid);
  }

  isDocumentDownloading(documentUuid: string): boolean {
    return this.downloadingItems().has(documentUuid);
  }

  private downloadFile(blob:Blob, filename:string):void{
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url)
  }

  viewKnowledge(knowledge: KnowledgeItem): void {
    const url = `${this.clientBaseUrl}/${this.lang}/knowledge/${knowledge.type}/${knowledge.knowledge_slug}`;
    window.open(url, '_blank');
  }

    // Pagination methods
    onPageChange(page: number): void {
      if (page >= 1 && page <= this.currentDisplayTotalPages() && page !== this.currentDisplayPage()) {
        if (this.showArchivedDownloads()) {
          this.loadArchivedDownloads(page);
        } else {
          this.loadMyDownloads(page, this.currentSearchTerm(), this.currentUuids());
        }
      }
    }


  getPages(): (number | string)[] {
    const totalPages = this.currentDisplayTotalPages();
    const currentPage = this.currentDisplayPage();
    const delta = 2;
    let pages: (number | string)[] = [];

    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);

    if (left > 2) {
      pages.push('...');
    }

    for (let i = left; i <= right; i++) {
      pages.push(i);
    }

    if (right < totalPages - 1) {
      pages.push('...');
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  }
 

  onPageClick(page: number | string): void {
    if (typeof page === 'number') {
      this.onPageChange(page);
    }
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.highlightedKnowledgeUuid.set(null);
  }

  viewAll(): void {
    // Clear UUIDs and search term
    this.currentUuids.set([]);
    this.currentSearchTerm.set('');
    this.searchControl.setValue('', { emitEvent: false });
    this.highlightedKnowledgeUuid.set(null);
    
    // Reset page to 1 and clear selections
    this.currentPage.set(1);
    this.selectedKnowledge.set(null);
    this.selectedDocument.set(null);
    
    // Load all downloads without filters
    this.loadMyDownloads(1, '', []);
    
    // Update URL to remove query parameters
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      queryParamsHandling: 'merge'
    });
  }

  trackByKnowledgeUuid(index: number, item: KnowledgeItem): string {
    return item.uuid;
  }

  trackByDocumentUuid(index: number, item: Document): string {
    return item.uuid;
  }

  trackByPageIndex(index: number, item: number | string): number | string {
    return item;
  }

  getFileIconByExtension(fileExtension: string): string {
    const iconMap: { [key: string]: string } = {
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
    const ext = fileExtension?.toLowerCase() || '';
    return iconMap[ext] || iconMap.default;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Element;
    const componentElement = this.elementRef.nativeElement;
    
    // Check if the click was outside the component
    if (!componentElement.contains(target)) {
      this.resetKnowledgeSelection();
    }
  }

  private resetKnowledgeSelection(): void {
    this.selectedKnowledge.set(null);
    this.selectedDocument.set(null);
  }

  onKnowledgeColumnClick(): void {
    // Reset knowledge selection when clicking anywhere in the knowledge column
    // except on knowledge items (which have stopPropagation)
    this.resetKnowledgeSelection();
  }

  checkScrollState(): void {
    if (!this.knowledgeListElement) return;
    
    const element = this.knowledgeListElement.nativeElement;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    
    // Add buffer to prevent flickering near boundaries
    const buffer = 5;
    
    this.canScrollUp.set(scrollTop > buffer);
    this.canScrollDown.set(scrollTop < scrollHeight - clientHeight - buffer);
  }

  scrollUp(): void {
    if (!this.knowledgeListElement) return;
    
    const element = this.knowledgeListElement.nativeElement;
    element.scrollBy({
      top: -100,
      behavior: 'smooth'
    });
    
    setTimeout(() => this.checkScrollState(), 300);
  }

  scrollDown(): void {
    if (!this.knowledgeListElement) return;
    
    const element = this.knowledgeListElement.nativeElement;
    element.scrollBy({
      top: 100,
      behavior: 'smooth'
    });
    
    setTimeout(() => this.checkScrollState(), 300);
  }

  onKnowledgeListScroll(): void {
    this.checkScrollState();
  }

  dismissAddChannelsPrompt(): void {
    this.showAddChannelsPrompt = false;
    this.resolvePendingNavigation(true);
  }

  onAddChannelsNow(): void {
    this.showAddChannelsPrompt = false;
    this.resolvePendingNavigation(false);
    this.allowPromptBypass = true;

    setTimeout(() => {
      this.router.navigateByUrl(MyDownloadsComponent.NOTIFICATION_SETTINGS_URL);
    });
  }

  // Archive functionality
  archiveKnowledge(knowledge: KnowledgeItem): void {
    // Add knowledge UUID to downloading items to show loading state
    this.downloadingItems.update(items => new Set(items).add(knowledge.uuid));

    this.myDownloadsService.archiveKnowledge(knowledge.uuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showSuccess('Success', 'Knowledge archived successfully');
          // Remove from downloading items
          this.downloadingItems.update(items => {
            const newItems = new Set(items);
            newItems.delete(knowledge.uuid);
            return newItems;
          });

          // Unselect the knowledge if it was selected
          if (this.selectedKnowledge()?.uuid === knowledge.uuid) {
            this.selectedKnowledge.set(null);
            this.selectedDocument.set(null);
          }

          // Reload current downloads and statistics
          this.reloadCurrentDownloads();
          this.loadLibraryStatistics();
        },
        error: (error) => {
          console.error('Error archiving knowledge:', error);
          this.showError('Error', 'Failed to archive knowledge. Please try again.');
          // Remove from downloading items
          this.downloadingItems.update(items => {
            const newItems = new Set(items);
            newItems.delete(knowledge.uuid);
            return newItems;
          });
        }
      });
  }

  // Toggle between regular downloads and archived downloads
  toggleArchivedDownloads(): void {
    const newState = !this.showArchivedDownloads();
    this.showArchivedDownloads.set(newState);

    // Clear selections when toggling
    this.selectedKnowledge.set(null);
    this.selectedDocument.set(null);

    if (newState) {
      this.loadArchivedDownloads(1);
    } else {
      this.loadMyDownloads(1, this.currentSearchTerm(), this.currentUuids());
    }
  }

  // Load archived downloads
  loadArchivedDownloads(page: number = 1): void {
    this.myDownloadsService.getArchivedDownloads(page, this.currentSearchTerm() || undefined, this.currentUuids().length > 0 ? this.currentUuids() : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // Preserve current selection UUIDs before swapping arrays
          const prevSelectedKnowledgeUuid = this.selectedKnowledge()?.uuid || null;
          const prevSelectedDocumentUuid = this.selectedDocument()?.uuid || null;
          this.archivedKnowledgeItems.set(response.data);
          this.archivedCurrentPage.set(response.meta.current_page);
          this.archivedTotalPages.set(response.meta.last_page);
          this.archivedTotalItems.set(response.meta.total);

          // Re-bind selection to instances from the newly loaded archived array
          if (prevSelectedKnowledgeUuid) {
            const updatedSelectedKnowledge = response.data.find(k => k.uuid === prevSelectedKnowledgeUuid) || null;
            if (updatedSelectedKnowledge) {
              this.selectedKnowledge.set(updatedSelectedKnowledge);
              if (prevSelectedDocumentUuid) {
                const updatedSelectedDocument = (updatedSelectedKnowledge.documents || []).find(d => d.uuid === prevSelectedDocumentUuid) || null;
                if (updatedSelectedDocument) {
                  this.selectedDocument.set(updatedSelectedDocument);
                }
              }
            } else {
              this.selectedKnowledge.set(null);
              this.selectedDocument.set(null);
            }
          }

          // Check scroll state after data loads
          setTimeout(() => {
            this.checkScrollState();
          }, 100);
        },
        error: (error) => {
          console.error('Error loading archived downloads:', error);
          this.showError('Error', 'Failed to load archived downloads. Please try again.');
        }
      });
  }

  // Helper method to reload current downloads based on state
  private reloadCurrentDownloads(): void {
    if (this.showArchivedDownloads()) {
      this.loadArchivedDownloads(this.currentDisplayPage());
    } else {
      this.loadMyDownloads(this.currentDisplayPage(), this.currentSearchTerm(), this.currentUuids());
    }
  }

  // Load library statistics
  loadLibraryStatistics(): void {
    this.myDownloadsService.getLibraryStatistics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (statistics) => {
          this.libraryStatistics.set(statistics);
        },
        error: (error) => {
          console.error('Error loading library statistics:', error);
        }
      });
  }

  /**
   * Get subtitle for the page header
   */
  getDownloadsSubtitle(): string {
    const stats = this.libraryStatistics();
    // Fallbacks in case statistics are not yet loaded
    const archivedCount = stats?.archived ?? 0;
    const activeTotalCount = stats?.total ?? this.totalItems();
    const combinedTotal = (activeTotalCount || 0) + (archivedCount || 0);

    if (this.lang === 'ar') {
      return `${combinedTotal} إجمالي التنزيلات`;
    }

    return `${combinedTotal} total downloads`;
  }

  startsWithArabic(text: string | null | undefined): boolean {
    const normalizedText = (text ?? '').trim();

    for (const char of normalizedText) {
      if (MyDownloadsComponent.ARABIC_CHAR_REGEX.test(char)) {
        return true;
      }

      if (MyDownloadsComponent.LETTER_REGEX.test(char)) {
        return false;
      }
    }

    return false;
  }

  getTextDirection(text: string | null | undefined): 'rtl' | 'ltr' {
    return this.startsWithArabic(text) ? 'rtl' : 'ltr';
  }

  /**
   * Whether knowledge (or any of its documents) has been downloaded before
   */
  isKnowledgeDownloaded(knowledge: KnowledgeItem): boolean {
    if (!knowledge) return false;
    if (knowledge.download_at) return true;
    const docs = knowledge.documents || [];
    return docs.some(doc => !!doc.download_at);
  }

  /**
   * Whether a document has been downloaded before
   */
  isDocumentDownloaded(document: Document): boolean {
    return !!document?.download_at;
  }

  private shouldPromptForMissingChannels(profile: any): boolean {
    if (!profile) {
      return false;
    }

    const whatsappNumber = String(profile?.whatsapp_number ?? '').trim();
    const smsNumber = String(profile?.sms_number ?? '').trim();

    return !(whatsappNumber && smsNumber);
  }

  private resolvePendingNavigation(allowNavigation: boolean): void {
    if (!this.pendingNavigationObserver) {
      return;
    }

    this.pendingNavigationObserver.next(allowNavigation);
    this.pendingNavigationObserver.complete();
    this.pendingNavigationObserver = null;
  }

}
