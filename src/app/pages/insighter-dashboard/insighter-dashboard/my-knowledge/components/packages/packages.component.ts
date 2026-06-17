import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { KnowldegePackegesService, Package } from 'src/app/_fake/services/knowldege-packages/knowldege-packeges.service';
import Swal from 'sweetalert2';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { ScheduleDialogComponent } from './schedule-dialog/schedule-dialog.component';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { KnowledgeService } from 'src/app/_fake/services/knowledge/knowledge.service';
import { switchMap } from 'rxjs';

interface PackageData {
  packageName: string;
  knowledge_ids: number[];
  discount: number;
}

interface KnowledgeResponse {
  data: any[];
  [key: string]: any;
}

@Component({
  selector: 'app-packages',
  templateUrl: './packages.component.html',
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
      transition('void => *', animate('300ms ease-out')),
      transition('* => void', animate('300ms ease-in'))
    ]),
    trigger('columnResize', [
      state('w-100', style({
        width: '100%'
      })),
      state('w-65', style({
        width: '65%'
      })),
      transition('w-100 <=> w-65', animate('300ms ease-in-out'))
    ])
  ]
})
export class PackagesComponent implements OnInit, OnDestroy {
  private packageService: KnowldegePackegesService;
  packages: Package[] = [];
  isLoading$: any;
  ref: DynamicDialogRef | undefined;
  
  // Package builder properties
  showPackageBuilder = false;
  showDialog = false;
  isSmallScreen = false;
  discount: number = 0;
  packageName: string = '';
  packageItems: any[] = [];
  allKnowledges: any[] = [];
  selectedKnowledge: any | null = null;
  loading: boolean = false;
  draggedItem: any | null = null;

  // Getter for published knowledges only
  get publishedKnowledges(): any[] {
    return this.allKnowledges.filter(item => item.status === 'published');
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  constructor(
    packageService: KnowldegePackegesService,
    public dialogService: DialogService,
    private knowledgeService: KnowledgeService
  ) {
    this.packageService = packageService;
    this.isLoading$ = this.packageService.isLoading$;
  }

  ngOnInit(): void {
    this.loadPackages();
    this.checkScreenSize();
    this.loadAllKnowledges();
  }
  
  ngOnDestroy() {
    if (this.ref) {
      this.ref.close();
    }
  }

  private checkScreenSize() {
    this.isSmallScreen = window.innerWidth < 992;
    if (this.isSmallScreen && this.showPackageBuilder) {
      this.showPackageBuilder = false;
      this.showDialog = true;
    }
  }

  loadPackages() {
    this.packageService.getPackages().subscribe({
      next: (response) => {
        this.packages = response.data;
      },
      error: (error) => {
        console.error('Error loading packages:', error);
      }
    });
  }

  togglePackageBuilder() {
    // Reset items before showing package builder to avoid any issues
    if (!this.showPackageBuilder) {
      // About to show the package builder, reset first
      this.resetPackageBuilder();
    }
    
    this.showPackageBuilder = !this.showPackageBuilder;
    
    if (!this.showPackageBuilder) {
      // Hiding the package builder
      this.resetPackageBuilder();
      this.showDialog = false;
    } else if (this.isSmallScreen) {
      this.showPackageBuilder = false;
      this.showDialog = true;
    }
    
    // Log state for debugging
    console.log('Package builder state:', {
      showPackageBuilder: this.showPackageBuilder,
      packageItems: this.packageItems,
      isSmallScreen: this.isSmallScreen,
      showDialog: this.showDialog
    });
  }

  private resetPackageBuilder() {
    console.log('Resetting package builder');
    this.packageName = '';
    this.discount = 0;
    
    // Important: Initialize as empty array (not with any default values)
    this.packageItems = [];
    
    this.selectedKnowledge = null;
    this.draggedItem = null;
  }

  hideDialog() {
    this.showDialog = false;
    this.resetPackageBuilder();
  }

  loadAllKnowledges() {
    this.loading = true;
    this.knowledgeService.getListKnowledge().subscribe({
      next: (response: KnowledgeResponse) => {
        this.allKnowledges = response.data;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading knowledges:', error);
        this.loading = false;
      }
    });
  }

  onKnowledgeSelect(event: any) {
    this.selectedKnowledge = event;
  }

  // Drag and drop methods
  onDragStart(event: DragEvent, item: any) {
    this.draggedItem = item;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text', item.id.toString());
      event.dataTransfer.effectAllowed = 'move';
      // Add a class to show the item being dragged
      const element = event.target as HTMLElement;
      element.classList.add('dragging');
    }
  }

  onDragEnd(event: DragEvent) {
    this.draggedItem = null;
    // Remove dragging class
    const element = event.target as HTMLElement;
    element.classList.remove('dragging');
  }

  onDragOver(event: DragEvent) {
    if (event.preventDefault) {
      event.preventDefault(); // Necessary to allow dropping
    }
    return false;
  }

  onDrop(event: DragEvent) {
    if (event.preventDefault) {
      event.preventDefault();
    }
    if (event.stopPropagation) {
      event.stopPropagation();
    }

    // Only add the item if it's valid and not already in the package
    if (this.draggedItem && 
        this.draggedItem.id && 
        !this.packageItems.some(item => item && item.id === this.draggedItem.id)) {
      
      // Create a clean copy of the dragged item to avoid reference issues
      const knowledgeToCopy = { ...this.draggedItem };
      
      // Set the packages directly instead of appending
      // This prevents any issues with null/undefined items
      const cleanPackageItems = this.packageItems
        .filter(item => item && item.id) // Remove any invalid items
        .concat([knowledgeToCopy]); // Add new item
      
      this.packageItems = cleanPackageItems;
      
      // Log the updated packageItems for debugging
      console.log('Updated package items:', this.packageItems);
    }

    return false;
  }

  // Add knowledge item to package via button click
  addToPackage(knowledge: any) {
    if (knowledge && 
        knowledge.id && 
        !this.packageItems.some(item => item && item.id === knowledge.id)) {
      this.packageItems = [...this.packageItems, knowledge];
    }
  }

  // Check if knowledge is already in package
  isKnowledgeInPackage(knowledge: any): boolean {
    if (!knowledge || !knowledge.id || !this.packageItems || !Array.isArray(this.packageItems)) {
      return false;
    }
    return this.packageItems.some(item => item && item.id === knowledge.id);
  }

  // Get badge class based on status
  getStatusClass(status: string): string {
    switch (status) {
      case 'published':
        return 'badge-light-success';
      case 'draft':
        return 'badge-light-warning';
      case 'scheduled':
        return 'badge-light-primary';
      case 'unpublished':
        return 'badge-light-danger';
      default:
        return 'badge-light-info';
    }
  }

  getStatusDisplayLabel(knowledge: any): string {
    return knowledge?.status_label || (knowledge?.status === 'unpublished' ? 'Draft' : knowledge?.status || '');
  }

  showEmittedPackage(packageData: PackageData) {
    console.log('Received package data:', packageData);
    
    // Ensure the package data is valid and knowledge_ids are not null
    if (packageData && 
        packageData.knowledge_ids && 
        Array.isArray(packageData.knowledge_ids)) {
      
      // Create a cleaned version of the package data
      const cleanedPackageData: PackageData = {
        packageName: packageData.packageName,
        knowledge_ids: packageData.knowledge_ids.filter(id => id !== null && id !== undefined),
        discount: packageData.discount
      };
      
      this.handleAPIPackage(cleanedPackageData);
    } else {
      console.error('Invalid package data received:', packageData);
      Swal.fire({
        title: 'Error',
        text: 'Invalid package data',
        icon: 'error'
      });
    }
  }

  handleAPIPackage(packageData: PackageData) {
    if (!packageData.packageName.trim()) {
      Swal.fire({
        title: 'Error',
        text: 'Package name is required',
        icon: 'error'
      });
      return;
    }

    // Filter out any null or invalid knowledge IDs
    const validKnowledgeIds = packageData.knowledge_ids.filter(id => id !== null && id !== undefined);
    
    if (validKnowledgeIds.length === 0) {
      Swal.fire({
        title: 'Error',
        text: 'Please add at least one knowledge to the package',
        icon: 'error'
      });
      return;
    }

    // Replace with filtered array
    packageData.knowledge_ids = validKnowledgeIds;
    
    console.log('Creating package with data:', packageData);
    
    this.loading = true;
    this.packageService.createPackage(packageData.packageName.trim()).pipe(
      switchMap((response: any) => {
        const libraryPackageId = response.data.library_package_id;
        return this.packageService.syncPackageKnowledge(
          libraryPackageId,
          packageData.knowledge_ids,
          packageData.discount
        );
      })
    ).subscribe({
      next: () => {
        this.loading = false;
        this.showPackageBuilder = false;
        this.showDialog = false;
        this.resetPackageBuilder();
        this.loadPackages();
        Swal.fire('Success', 'Package created successfully', 'success');
      },
      error: (error) => {
        this.loading = false;
        console.error('Error creating package:', error);
        Swal.fire('Error', error.error?.message || 'Failed to create package', 'error');
      }
    });
  }

  onDelete(packageId: number) {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this package!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        this.packageService.deletePackage(packageId).subscribe({
          next: () => {
            this.loadPackages();
            Swal.fire('Deleted!', 'Package has been deleted.', 'success');
          },
          error: (error) => {
            console.error('Error deleting package:', error);
            Swal.fire('Error!', 'Failed to delete package.', 'error');
          }
        });
      }
    });
  }

  updateStatus(packageId: number, status: 'scheduled' | 'published' | 'unpublished') {
    if (status === 'published') {
      const currentDateTime = this.getFormattedDateTime();
      this.packageService.updatePackageStatus(packageId, status, currentDateTime).subscribe({
        next: () => {
          this.loadPackages();
          Swal.fire('Updated!', 'Package status has been updated.', 'success');
        },
        error: (error) => {
          console.error('Error updating package status:', error);
          Swal.fire('Error!', 'Failed to update package status.', 'error');
        }
      });
    } else if (status === 'scheduled') {
      this.ref = this.dialogService.open(ScheduleDialogComponent, {
        header: 'Schedule Package',
        width: '400px',
        data: {}
      });

      this.ref.onClose.subscribe((selectedDateTime: string | null) => {
        if (selectedDateTime) {
          const date = new Date(selectedDateTime);
          const formattedDate = this.formatDateToString(date);
          this.packageService.updatePackageStatus(packageId, status, formattedDate).subscribe({
            next: () => {
              this.loadPackages();
              Swal.fire('Scheduled!', 'Package has been scheduled.', 'success');
            },
            error: (error) => {
              console.error('Error scheduling package:', error);
              Swal.fire('Error!', 'Failed to schedule package.', 'error');
            }
          });
        }
      });
    } else if (status === 'unpublished') {
      this.packageService.updatePackageStatus(packageId, status).subscribe({
        next: () => {
          this.loadPackages();
          Swal.fire('Updated!', 'Package status has been updated.', 'success');
        },
        error: (error) => {
          console.error('Error updating package status:', error);
          Swal.fire('Error!', 'Failed to update package status.', 'error');
        }
      });
    }
  }

  private getFormattedDateTime(): string {
    const now = new Date();
    return this.formatDateToString(now);
  }

  private formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
} 
