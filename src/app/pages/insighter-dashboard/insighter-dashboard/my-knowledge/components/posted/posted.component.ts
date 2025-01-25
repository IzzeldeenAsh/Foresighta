import { Component, OnInit, HostListener, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { KnowledgeService, Knowledge } from 'src/app/_fake/services/knowledge/knowledge.service';
import { KnowldegePackegesService } from 'src/app/_fake/services/knowldege-packages/knowldege-packeges.service';
import { DialogService } from 'primeng/dynamicdialog';
import { trigger, state, style, animate, transition } from '@angular/animations';
import Swal from 'sweetalert2';
import { switchMap } from 'rxjs';
import { BaseComponent } from 'src/app/modules/base.component';

interface PackageData {
  packageName: string;
  knowledge_ids: number[];
  discount: number;
}

@Component({
  selector: 'app-posted',
  templateUrl: './posted.component.html',
  styleUrls: ['./posted.component.scss'],
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
export class PostedComponent extends BaseComponent implements OnInit {
  knowledges: Knowledge[] = [];
  packages: Knowledge[] = [];
  showPackageBuilder = false;
  showDialog = false;
  isSmallScreen = false;
  discount: number = 0;
  packageName: string = '';
  draggedItem: Knowledge | null = null;
  allKnowledges: Knowledge[] = [];
  selectedKnowledge: Knowledge | null = null;
  loading: boolean = false;
  currentPage: number = 1;
  totalPages: number = 1;
  totalItems: number = 0;

  constructor(
    injector: Injector,
    private knowledgeService: KnowledgeService,
    private router: Router,
    private knowldegePackegesService: KnowldegePackegesService,
    private dialogService: DialogService
  ) {
    super(injector);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.loadPage(1);
    this.loadAllKnowledges();
    this.checkScreenSize();
  }

  checkScreenSize() {
    this.isSmallScreen = window.innerWidth < 992;
    if (this.isSmallScreen && this.showPackageBuilder) {
      this.showDialog = true;
      this.showPackageBuilder = false;
    }
  }

  loadAllKnowledges() {
    this.knowledgeService.getListKnowledge().subscribe(
      (knowledges) => {
        this.allKnowledges = knowledges.data.filter(k => k.status === 'published');
      }
    );
  }

  loadPage(page: number): void {
    this.knowledgeService.getPaginatedKnowledges(page, 'published').subscribe(
      (response) => {
        this.knowledges = response.data;
        this.currentPage = response.meta.current_page;
        this.totalPages = response.meta.last_page;
        this.totalItems = response.meta.total;
      }
    );
  }

  getPages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  deleteKnowledge(knowledge: Knowledge): void {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.knowledgeService.deleteKnowledge(knowledge.id).subscribe(
          () => {
            this.packages = this.packages.filter(pkg => pkg.id !== knowledge.id);
            this.knowledges = this.knowledges.filter(k => k.id !== knowledge.id);
            this.totalItems--;
            this.showSuccess('Knowledge has been deleted.', 'success');
          },
          (error) => {
            console.error('Error deleting knowledge:', error);
            const errorMessage = error.error?.message || error.error?.errors?.common?.[0] || 'There was an error deleting the knowledge.';
            Swal.fire('Error!', errorMessage, 'error');
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
      title: 'Are you sure?',
      text: "You are about to unpublish this knowledge. It will no longer be visible to users.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, unpublish it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.knowledgeService.setKnowledgeStatus(knowledgeId, 'unpublished', new Date().toISOString()).subscribe(
          () => {
            this.loadPage(this.currentPage);
            Swal.fire(
              'Unpublished!',
              'The knowledge has been unpublished.',
              'success'
            );
          }
        );
      }
    });
  }

  togglePackageBuilder() {
    if (this.isSmallScreen) {
      this.showDialog = !this.showDialog;
      if (!this.showDialog) {
        this.resetPackageBuilder();
      }
    } else {
      this.showPackageBuilder = !this.showPackageBuilder;
      if (!this.showPackageBuilder) {
        this.resetPackageBuilder();
      }
    }
  }

  onDragStart(event: DragEvent, knowledge: Knowledge) {
    if (event.dataTransfer) {
      this.draggedItem = knowledge;
      event.dataTransfer.setData('text', JSON.stringify(knowledge));
    }
  }

  onDragEnd(event: DragEvent) {
    this.draggedItem = null;
  }

  onKnowledgeSelect(event: any) {
    if (event && !this.packages.some(pkg => pkg.id === event.id)) {
      this.packages = [...this.packages, event];
      this.selectedKnowledge = null;
    }
  }

  showEmittedPackage(packageData: PackageData) {
    this.savePackage(packageData);
  }

  savePackage(packageData: PackageData) {
    if (!packageData.packageName.trim()) {
      Swal.fire({
        title: 'Error',
        text: 'Package name is required',
        icon: 'error'
      });
      this.loading = false;
      return;
    }

    if (packageData.knowledge_ids.length === 0) {
      Swal.fire({
        title: 'Error',
        text: 'Please add at least one knowledge to the package',
        icon: 'error'
      });
      this.loading = false;
      return;
    }

    this.loading = true;
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
          title: 'Success',
          text: 'Package saved successfully',
          icon: 'success'
        }).then(() => {
          this.togglePackageBuilder();
        });
      },
      (error) => {
        console.error('Error saving package:', error);
        Swal.fire({
          title: 'Error',
          text: error.error?.message || 'Failed to save package',
          icon: 'error'
        });
      }
    ).add(() => {
      this.loading = false;
    });
  }

  private resetPackageBuilder() {
    this.packages = [];
    this.packageName = '';
    this.discount = 0;
  }

  hideDialog() {
    this.showDialog = false;
    this.resetPackageBuilder();
  }
}