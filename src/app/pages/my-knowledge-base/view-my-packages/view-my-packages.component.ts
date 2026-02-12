import { Component, Injector, OnInit } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { KnowldegePackegesService } from 'src/app/_fake/services/knowldege-packages/knowldege-packeges.service';
import { KnowledgeService, KnowledgeResponse } from 'src/app/_fake/services/knowledge/knowledge.service';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, switchMap, of } from 'rxjs';
import Swal from 'sweetalert2';
interface PackageResponse {
  data: {
    id: number;
    name: string;
    price: number;
    discount: number;
    final_price: number;
    status: string;
    knowledge_ids?: number[];
  };
}

@Component({
  selector: 'app-view-my-packages',
  templateUrl: './view-my-packages.component.html',
  styleUrls: ['./view-my-packages.component.scss'],
})
export class ViewMyPackagesComponent extends BaseComponent implements OnInit {
  packageDetails: PackageResponse['data'] | null = null;
  knowledgeItems: KnowledgeResponse['data'][] = [];
  isLoading = false;
  activeKnowledgeId: number | null = null;
  knowledgeActions: any[] = []; // Menu actions

  // New properties for knowledge selection
  isAddAreaHovered = false;
  showKnowledgeDialog = false;
  availableKnowledge: KnowledgeResponse['data'][] = [];
  selectedKnowledge: KnowledgeResponse['data'] | null = null;

  constructor(
    injector: Injector,
    private packageService: KnowldegePackegesService,
    private knowledgeService: KnowledgeService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    super(injector);
  }

  ngOnInit() {
    this.loadPackageDetails();
  }

  private loadPackageDetails(): void {
    this.isLoading = true;
    
    this.route.params.pipe(
      switchMap(params => {
        const packageId = params['id'];
        return this.packageService.getPackageById(packageId);
      }),
      switchMap((packageResponse: PackageResponse) => {
        this.packageDetails = packageResponse.data;
        const knowledgeIds = this.packageDetails.knowledge_ids || [];
        
        if (knowledgeIds.length === 0) {
          return of([]); // Return observable with empty array
        }

        const knowledgeRequests = knowledgeIds.map(id => 
          this.knowledgeService.getKnowledgeById(id)
        );
        return forkJoin(knowledgeRequests);
      })
    ).subscribe({
      next: (knowledgeResponses: KnowledgeResponse[]) => {
        this.knowledgeItems = knowledgeResponses.map(response => response.data);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading package details:', error);
        this.isLoading = false;
      }
    });
  }

  toggleKnowledgeCollapse(id: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeKnowledgeId = this.activeKnowledgeId === id ? null : id;
  }

  getKnowledgeTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      video: '/assets/media/icons/duotune/media/med001.svg',
      document: '/assets/media/icons/duotune/files/fil003.svg',
      audio: '/assets/media/icons/duotune/media/med008.svg',
      
      // Add more mappings as needed
    };
    return icons[type.toLowerCase()] || icons['document']; // default to document icon
  }

  setMenuData(item: any): void {
    // Implement your menu data setting logic here
  }

  deletePackage(): void {
    if (!this.packageDetails?.id) return;

    this.isLoading = true;
    this.packageService.deletePackage(this.packageDetails.id).subscribe({
      next: () => {
        this.router.navigate(['/app/insighter-dashboard/my-knowledge/packages']);
      },
      error: (error) => {
        console.error('Error deleting package:', error);
        this.isLoading = false;
      }
    });
  }

  updatePackageStatus(): void {
    if (!this.packageDetails?.id) return;

    const newStatus = this.packageDetails.status === 'published' ? 'unpublished' : 'published';
    
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to ${newStatus === 'published' ? 'publish' : 'unpublish'} this package?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.packageService.updatePackageStatus(this.packageDetails!.id, newStatus).subscribe({
          next: () => {
            if (this.packageDetails) {
              this.packageDetails.status = newStatus;
            }
            this.isLoading = false;
            Swal.fire('Success', `Package has been ${newStatus}.`, 'success');
          },
          error: (error) => {
            console.error('Error updating package status:', error);
            this.isLoading = false;
            Swal.fire('Error', 'Failed to update package status.', 'error');
          }
        });
      }
    });
  }

  hasRejectedKnowledgeRequest(): boolean {
    return this.knowledgeItems.some(
      (item) => item.account_manager_process?.request_status === 'rejected'
    );
  }

  editDiscount(): void {
    if (!this.packageDetails) return;

    Swal.fire({
      title: 'Edit Discount',
      input: 'number',
      inputValue: this.packageDetails.discount,
      inputLabel: 'Enter discount percentage (0-100)',
      showCancelButton: true,
      inputValidator: (value) => {
        const numValue = Number(value);
        if (!value || numValue < 0 || numValue > 100) {
          return 'Please enter a valid discount percentage between 0 and 100';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed && this.packageDetails) {
        const newDiscount = Number(result.value);
        const knowledgeIds = this.knowledgeItems.map(item => item.id);
        
        this.packageService.syncPackageKnowledge(
          this.packageDetails.id,
          knowledgeIds,
          newDiscount
        ).subscribe({
          next: () => {
            this.packageDetails!.discount = newDiscount;
            // Recalculate final price
            this.packageDetails!.final_price = this.packageDetails!.price * (1 - newDiscount / 100);
            Swal.fire('Success', 'Discount updated successfully', 'success');
          },
          error: (error) => {
            console.error('Error updating discount:', error);
            Swal.fire('Error', 'Failed to update discount', 'error');
          }
        });
      }
    });
  }

  removeKnowledge(knowledgeId: number, event: Event): void {
    event.stopPropagation();
    
    if (!this.packageDetails) return;

    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to remove this knowledge from the package?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        // Filter out the removed knowledge
        const updatedKnowledgeIds = this.knowledgeItems
          .filter(item => item.id !== knowledgeId)
          .map(item => item.id);

        this.packageService.syncPackageKnowledge(
          this.packageDetails!.id,
          updatedKnowledgeIds,
          this.packageDetails!.discount
        ).subscribe({
          next: () => {
            // Update local state
            this.knowledgeItems = this.knowledgeItems.filter(item => item.id !== knowledgeId);
            Swal.fire('Success', 'Knowledge removed from package successfully', 'success');
          },
          error: (error) => {
            console.error('Error removing knowledge:', error);
            Swal.fire('Error', 'Failed to remove knowledge from package', 'error');
          }
        });
      }
    });
  }

  openAddKnowledgeDialog(): void {
    this.isLoading = true;
    this.knowledgeService.getListKnowledge().subscribe({
      next: (response) => {
        // Filter out already selected knowledge
        const existingIds = this.knowledgeItems.map(item => item.id);
        this.availableKnowledge = response.data.filter(
          item => !existingIds.includes(item.id)
        );
        this.showKnowledgeDialog = true;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading knowledge list:', error);
        this.isLoading = false;
        Swal.fire('Error', 'Failed to load knowledge list', 'error');
      }
    });
  }

  addKnowledgeToPackage(): void {
    if (!this.selectedKnowledge || !this.packageDetails) return;

    const updatedKnowledgeIds = [
      ...this.knowledgeItems.map(item => item.id),
      this.selectedKnowledge.id
    ];

    this.isLoading = true;
    this.packageService.syncPackageKnowledge(
      this.packageDetails.id,
      updatedKnowledgeIds,
      this.packageDetails.discount
    ).subscribe({
      next: () => {
        // Add the new knowledge to the local list
        this.knowledgeItems.push(this.selectedKnowledge!);
        
        // Reset selection and close dialog
        this.selectedKnowledge = null;
        this.showKnowledgeDialog = false;
        this.isLoading = false;
        
        Swal.fire('Success', 'Knowledge added to package successfully', 'success');
      },
      error: (error) => {
        console.error('Error adding knowledge to package:', error);
        this.isLoading = false;
        Swal.fire('Error', 'Failed to add knowledge to package', 'error');
      }
    });
  }

  editPackageName(event: Event): void {
    event.stopPropagation();
    if (!this.packageDetails) return;

    Swal.fire({
      title: 'Edit Package Name',
      input: 'text',
      inputValue: this.packageDetails.name,
      inputLabel: 'Enter new package name',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Please enter a valid package name';
        }
        return null;
      }
    }).then((result) => {
      if (result.isConfirmed && this.packageDetails) {
        const newName = result.value.trim();
        
        this.isLoading = true;
        this.packageService.updatePackageName(this.packageDetails.id, newName).subscribe({
          next: () => {
            this.packageDetails!.name = newName;
            this.isLoading = false;
            Swal.fire('Success', 'Package name updated successfully', 'success');
          },
          error: (error) => {
            console.error('Error updating package name:', error);
            this.isLoading = false;
            Swal.fire('Error', 'Failed to update package name', 'error');
          }
        });
      }
    });
  }
}
