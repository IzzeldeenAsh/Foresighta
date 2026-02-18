import { Component, Injector, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DocumentInfo, AddInsightStepsService, AddKnowledgeDocumentRequest, Chapter, UpdateKnowledgeAbstractsRequest, DocumentParserResponse } from 'src/app/_fake/services/add-insight-steps/add-insight-steps.service';
import { Knowledge, KnowledgeService } from 'src/app/_fake/services/knowledge/knowledge.service';
import { KnowledgeUpdateService } from 'src/app/_fake/services/knowledge/knowledge-update.service';
import { BaseComponent } from 'src/app/modules/base.component';
import Swal from 'sweetalert2';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { DialogModule } from 'primeng/dialog';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

interface ChapterItem {
  title: string;
  id?: number;
  page_number?: number;
}

// Create an extended interface
interface ExtendedDocumentInfo extends DocumentInfo {
  docUrl?: string;
  fileIcon?: string;
}

@Component({
  selector: 'app-knowledge-details',
  templateUrl: './knowledge-details.component.html',
  styleUrl: './knowledge-details.component.scss',

  animations: [
    trigger('fadeInMoveY', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(-20px)' }))
      ])
    ])
  ]
})
export class KnowledgeDetailsComponent extends BaseComponent implements OnInit {
  knowledgeId: string;
  knowledge: Knowledge;
  documents: DocumentInfo[] = [];
  isLoading: boolean = false;
  displayDocumentDialog = false;
  editingDocument: ExtendedDocumentInfo | null = null;
  docForm: FormGroup;
  previewFilesDialog: any[] = [];
  isSaving: boolean = false;
  headerTitle = 'Document Details';
  isUploadAreaHovered = false;

  // Add animation states
  hoveredDocumentId: number | null = null;
  activeDocumentId: number | null = null;
  animationStates: { [key: number]: string } = {};

  // Add new properties for statistic documents
  insightDocForm: FormGroup;
  displayInsightDialog = false;

  // Add new properties for the modal approach
  showDocumentModal = false;
  editingDocumentForModal: DocumentInfo | null = null;
  
  // File upload properties
  uploadProgress: number = 0;
  isUploading: boolean = false;
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

  // Language mismatch dialog properties
  showLanguageMismatchDialog = false;
  languageMismatchTitle = '';
  languageMismatchMessage = '';
  languageMismatchDocuments: string[] = [];
  private languageMismatchResolver: ((value: boolean) => void) | null = null;

  documentsDummy:any = [
    {
      id: 1,
      file_name: 'Market Analysis Study',
      file_extension: 'xlsx',
      file_size: 2048000, // 2 MB
      price: 49.99,
      description: 'A detailed project report covering all aspects of the project, including milestones and outcomes.',
      highlighted: false
    },
    {
      id: 2,
      file_name: 'Industry Trends Study',
      file_extension: 'doc',
      file_size: 102400, // 100 KB
      price: 29.99,
      description: 'The wireframe design for the upcoming application project.',
      highlighted: true
    },
    {
      id: 3,
      file_name: 'Consumer Behavior Study',
      file_extension: 'docx',
      file_size: 512000, // 500 KB
      price: 19.99,
      description: 'Summary and action items from the team meeting held last week.',
      highlighted: false
    },
    {
      id: 4,
      file_name: 'Financial Impact Study',
      file_extension: 'pdf',
      file_size: 307200, // 300 KB
      price: 24.99,
      description: 'A detailed budget breakdown for the financial year 2023.',
      highlighted: false
    },
    {
      id: 5,
      file_name: 'Competitive Analysis Study',
      file_extension: 'pptx',
      file_size: 1048576, // 1 MB
      price: 39.99,
      description: 'Presentation slides for the upcoming stakeholder meeting.',
      highlighted: false
    },
    {
      id: 6,
      file_name: 'Risk Assessment Study',
      file_extension: 'txt',
      file_size: 0, // 0 bytes
      price: 0.00,
      description: null, // No description provided
      highlighted: false
    },
  ];

  viewDocument(doc: DocumentInfo, event: Event): void {
    event.stopPropagation();

    const newTab = window.open('', '_blank');
    this.addInsightStepsService.getDocumentUrl(doc.id).subscribe({
      next: (response) => {
        if (newTab) {
          newTab.location.href = response.data.url;
        } else {
          window.open(response.data.url, '_blank');
        }
      },
      error: (error) => {
        console.error('Error getting document URL:', error);
        if (newTab) newTab.close();
        Swal.fire({
          title: this.lang === 'ar' ? 'خطأ!' : 'Error!',
          text: this.lang === 'ar' ? 'فشل فتح المستند' : 'Failed to open document',
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
    });
  }

  shouldShowDocNameTooltip(fileName: string | null | undefined): boolean {
    return !!fileName && fileName.length > 32;
  }

  constructor(
    injector: Injector,
    private route: ActivatedRoute,
    private knowledgeService: KnowledgeService,
    private addInsightStepsService: AddInsightStepsService,
    private knowledgeUpdateService: KnowledgeUpdateService,
    private fb: FormBuilder
  ) {
    super(injector);
    this.initDocForm();
    this.initInsightDocForm();
  }

  private initDocForm(): void {
    this.docForm = this.fb.group({
      file_name: ['', Validators.required],
      description: [''],
      table_of_content: this.fb.array([]),
      price: [0, [Validators.required, Validators.min(0)]],
      file: [null],
      file_extension: ['']
    });
    this.previewFilesDialog = [];
    this.addFormChapter(); // Add initial chapter
  }

  private initInsightDocForm(): void {
    this.insightDocForm = this.fb.group({
      file_name: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0)]],
      file: [null],
      filePreview: [false],
      fileIcon: [''],
      file_extension: [''],
      fromServer: [false],
      docId: [null],
      file_size: [null],
      docUrl: ['']
    });
  }

  get chapters(): FormArray {
    return this.docForm.get('table_of_content') as FormArray;
  }

  private createChapter(): FormGroup {
    return this.fb.group({
      chapter: this.fb.group({
        title: ['', Validators.required],
        sub_child: this.fb.array([])
      })
    });
  }

  addFormChapter(): void {
    const newChapter = this.createChapter();
    this.chapters.push(newChapter);
  }

  removeFormChapter(index: number): void {
    this.chapters.removeAt(index);
  }

  loadChapters(chaptersData: any[]) {
    this.chapters.clear();
    if (chaptersData?.length) {
      chaptersData.forEach(ch => {
        const chapterGroup = this.createChapter();
        chapterGroup.patchValue({
          chapter: {
            title: ch.chapter?.title || ''
          }
        });
        this.chapters.push(chapterGroup);
      });
    } else {
      this.addFormChapter();
    }
  }

  ngOnInit(): void {
    // Get the ID from the parent route
    this.route.parent?.params.subscribe(params => {
      this.knowledgeId = params['id'];
      if (this.knowledgeId) {
        this.loadKnowledge();
        this.loadDocuments();
      }
    });

    // Initialize animation states for each document
    this.documents.forEach(doc => {
      this.animationStates[doc.id] = 'initial';
    });
  }

  private loadKnowledge(): void {
    this.isLoading = true;
    this.knowledgeService.getKnowledgeById(Number(this.knowledgeId))
      .subscribe({
        next: (response) => {
          this.knowledge = response.data;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading knowledge:', error);
          this.isLoading = false;
        }
      });
  }

  private loadDocuments(): void {
    this.isLoading = true;
    this.knowledgeService.getListDocumentsInfo(Number(this.knowledgeId))
      .subscribe({
        next: (response) => {
          this.documents = response.data.reverse();

          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading documents:', error);
          this.isLoading = false;
        }
      });
  }

  // Enhanced toggle collapse with animation
  toggleCollapse(docId: number, event: Event): void {
    event.stopPropagation();
    
    if (this.activeDocumentId === docId) {
      // If clicking the active document, deactivate it
      this.activeDocumentId = null;
    } else {
      // If clicking a new document, activate it
      this.activeDocumentId = docId;
    }
    this.animationStates[docId] = this.activeDocumentId === docId ? 'expanded' : 'collapsed';
  }

  // Enhanced hover handlers
  onDocumentMouseEnter(docId: number): void {
    this.hoveredDocumentId = docId;
    if (this.activeDocumentId !== docId) {
      this.animationStates[docId] = 'hovered';
    }
  }

  onDocumentMouseLeave(docId: number): void {
    this.hoveredDocumentId = null;
    if (this.activeDocumentId !== docId) {
      this.animationStates[docId] = 'initial';
    }
  }

  // Example file-icon mapping method
  getFileIconByExtension(fileExtension: string): string {
    // Adjust this method to match your current logic / icon paths
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
    const ext = fileExtension.toLowerCase();
    return iconMap[ext] || iconMap.default;
  }

  editDocument(doc: DocumentInfo, event: Event): void {
    event.stopPropagation();
    this.editingDocumentForModal = doc;
    this.showDocumentModal = true;
  }

  saveDocument(): void {
    if (this.docForm.invalid) {
      this.docForm.markAllAsTouched();
      return;
    }

    if (!this.docForm.get('file')?.value && !this.editingDocument) {
      Swal.fire({
        title: this.lang === 'ar' ? 'خطأ!' : 'Error!',
        text: this.lang === 'ar' ? 'يرجى اختيار ملف للرفع' : 'Please select a file to upload',
        icon: 'error',
        confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
        customClass: {
          popup: 'text-center',
          title: 'text-center',
          htmlContainer: 'text-center',
          confirmButton: 'text-center'
        }
      });
      return;
    }

    this.isSaving = true;
    const formValue = this.docForm.value;

    const request: any = {
      file_name: formValue.file_name,
      price: formValue.price.toString(),
      description: formValue.description || '',
      status: 'active'
    };

    if (this.knowledge?.type !== 'statistic') {
      // Add table of content for non-statistic types
      request.table_of_content = this.chapters.controls.map(control => ({
        chapter: {
          title: control.get('chapter.title')?.value?.trim() || ''
        }
      })).filter(ch => ch.chapter.title !== '');
    }

    if (formValue.file) {
      request.file = formValue.file;
    }

    // If we have an editingDocument, it's an update operation
    // Otherwise, it's a new document
    const documentId = this.editingDocument?.id || Number(this.knowledgeId);
    const isUpdate = !!this.editingDocument;

    this.addInsightStepsService.step3AddKnowledgeDocument(
      documentId,
      request,
      isUpdate
    ).subscribe({
      next: () => {
        this.loadDocuments();
        this.closeDialog();
        Swal.fire({
          title: this.lang === 'ar' ? 'نجح!' : 'Success!',
          text: isUpdate 
            ? (this.lang === 'ar' ? 'تم تحديث المستند بنجاح' : 'Document updated successfully')
            : (this.lang === 'ar' ? 'تم إضافة المستند بنجاح' : 'Document added successfully'),
          icon: 'success',
          confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
          customClass: {
            popup: 'text-center',
            title: 'text-center',
            htmlContainer: 'text-center',
            confirmButton: 'text-center'
          }
        });
      },
      error: (error) => {
        console.error('Error saving document:', error);
        Swal.fire({
          title: this.lang === 'ar' ? 'خطأ!' : 'Error!',
          text: isUpdate 
            ? (this.lang === 'ar' ? 'فشل تحديث المستند' : 'Failed to update document')
            : (this.lang === 'ar' ? 'فشل إضافة المستند' : 'Failed to add document'),
          icon: 'error',
          confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
          customClass: {
            popup: 'text-center',
            title: 'text-center',
            htmlContainer: 'text-center',
            confirmButton: 'text-center'
          }
        });
      },
      complete: () => {
        this.isSaving = false;
      }
    });
  }

  closeDialog(): void {
    this.displayDocumentDialog = false;
    this.editingDocument = null;
    this.initDocForm();
  }

  onFilesSelectedDialog(event: any): void {
    const files: FileList = event.target.files;
    if (files.length > 0) {
      const file = files[0];
      const fileExtension = this.getFileExtension(file.name);
      
      this.docForm.patchValue({ 
        file,
        file_extension: fileExtension
      });
      
      this.previewFilesDialog = [{
        file,
        name: file.name,
        size: file.size,
        preview: null,
        type: this.getFileTypeByExtension(file.name),
        icon: this.getFileIconByExtension(fileExtension)
      }];
    }
  }

  removeFileDialog(preview: any): void {
    this.previewFilesDialog = [];
    this.docForm.patchValue({ file: null });
  }

  private getFileTypeByExtension(fileName: string): string {
    const extension = (fileName.split('.').pop() || '').toLowerCase();
    const typeMap: { [key: string]: string } = {
      pdf: 'pdf',
      doc: 'word',
      docx: 'word',
      xls: 'excel',
      xlsx: 'excel',
      ppt: 'powerpoint',
      pptx: 'powerpoint',
      txt: 'text',
      zip: 'archive',
      rar: 'archive',
      csv: 'excel',
      rtf: 'document',
    };
    return typeMap[extension] || 'document';
  }

  private getFileExtension(filename: string): string {
    if (!filename) return '';
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1].toUpperCase() : '';
  }

  deleteDocument(doc: DocumentInfo, event: Event): void {
    event.stopPropagation();
    
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
        this.addInsightStepsService.deleteKnowledgeDocument(doc.id)
          .subscribe({
            next: () => {
              this.loadDocuments(); // Refresh the documents list
              
              // Notify the parent component to update total_price
              this.knowledgeUpdateService.notifyKnowledgeUpdate();
              
              Swal.fire({
                title: this.lang === 'ar' ? 'تم الحذف!' : 'Deleted!',
                text: this.lang === 'ar' ? 'تم حذف المستند.' : 'Document has been deleted.',
                icon: 'success',
                confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
                customClass: {
                  popup: 'text-center',
                  title: 'text-center',
                  htmlContainer: 'text-center',
                  confirmButton: 'text-center'
                }
              });
            },
            error: (error) => {
              console.error('Error deleting document:', error);
              Swal.fire({
                title: this.lang === 'ar' ? 'خطأ!' : 'Error!',
                text: this.lang === 'ar' ? 'فشل حذف المستند.' : 'Failed to delete document.',
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
          });
      }
    });
  }

  unpublishDocument(doc: DocumentInfo, event: Event): void {
    event.stopPropagation();
    
    Swal.fire({
      title: this.lang === 'ar' ? 'إلغاء نشر المستند' : 'Unpublish Document',
      text: this.lang === 'ar' ? 'هل أنت متأكد أنك تريد إلغاء نشر هذا المستند؟' : "Are you sure you want to unpublish this document?",
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
        const request = {
          status: 'draft',
          published_at: new Date().toISOString()
        };

        this.addInsightStepsService.publishKnowledge(doc.id, request)
          .subscribe({
            next: () => {
              this.loadDocuments(); // Refresh the documents list
              Swal.fire({
                title: this.lang === 'ar' ? 'تم إلغاء النشر!' : 'Unpublished!',
                text: this.lang === 'ar' ? 'تم إلغاء نشر المستند.' : 'Document has been unpublished.',
                icon: 'success',
                confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
                customClass: {
                  popup: 'text-center',
                  title: 'text-center',
                  htmlContainer: 'text-center',
                  confirmButton: 'text-center'
                }
              });
            },
            error: (error) => {
              console.error('Error unpublishing document:', error);
              Swal.fire({
                title: this.lang === 'ar' ? 'خطأ!' : 'Error!',
                text: this.lang === 'ar' ? 'فشل إلغاء نشر المستند.' : 'Failed to unpublish document.',
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
          });
      }
    });
  }

  openPreview(preview: any): void {
    if (preview.fromServer && preview.preview) {
      // Open server URL in new tab
      window.open(preview.preview, '_blank');
    } else if (preview.docId) {
      // If we don't have the URL yet, fetch it
      this.addInsightStepsService.getDocumentUrl(preview.docId).subscribe({
        next: (response) => {
          window.open(response.data.url, '_blank');
        },
        error: (error) => {
          console.error('Error getting document URL:', error);
          Swal.fire({
            title: this.lang === 'ar' ? 'خطأ!' : 'Error!',
            text: this.lang === 'ar' ? 'فشل فتح المستند' : 'Failed to open document',
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
      });
    } else if (preview.file) {
      // Handle local file preview (for newly uploaded files)
      const objectUrl = URL.createObjectURL(preview.file);
      window.open(objectUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    }
  }

  saveInsightDocument(): void {
    if (this.insightDocForm.invalid) {
      this.insightDocForm.markAllAsTouched();
      return;
    }

    if (!this.insightDocForm.get('file')?.value && !this.editingDocument) {
      Swal.fire({
        title: this.lang === 'ar' ? 'خطأ!' : 'Error!',
        text: this.lang === 'ar' ? 'يرجى اختيار ملف للرفع' : 'Please select a file to upload',
        icon: 'error',
        confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
        customClass: {
          popup: 'text-center',
          title: 'text-center',
          htmlContainer: 'text-center',
          confirmButton: 'text-center'
        }
      });
      return;
    }

    this.isSaving = true;
    const formValue = this.insightDocForm.value;

    const request: any = {
      file_name: formValue.file_name,
      price: formValue.price.toString(),
      status: 'active'
    };

    if (formValue.file) {
      request.file = formValue.file;
    }

    // If we have an editingDocument, it's an update operation
    // Otherwise, it's a new document
    const documentId = this.editingDocument?.id || Number(this.knowledgeId);
    const isUpdate = !!this.editingDocument;

    this.addInsightStepsService.step3AddKnowledgeDocument(
      documentId,
      request,
      isUpdate
    ).subscribe({
      next: () => {
        this.loadDocuments();
        this.closeInsightDialog();
        this.knowledgeUpdateService.notifyKnowledgeUpdate(); // Notify parent about the update
        Swal.fire({
          title: this.lang === 'ar' ? 'نجح!' : 'Success!',
          text: isUpdate 
            ? (this.lang === 'ar' ? 'تم تحديث المستند بنجاح' : 'Document updated successfully')
            : (this.lang === 'ar' ? 'تم إضافة المستند بنجاح' : 'Document added successfully'),
          icon: 'success',
          confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
          customClass: {
            popup: 'text-center',
            title: 'text-center',
            htmlContainer: 'text-center',
            confirmButton: 'text-center'
          }
        });
      },
      error: (error) => {
        console.error('Error saving document:', error);
        Swal.fire({
          title: this.lang === 'ar' ? 'خطأ!' : 'Error!',
          text: isUpdate 
            ? (this.lang === 'ar' ? 'فشل تحديث المستند' : 'Failed to update document')
            : (this.lang === 'ar' ? 'فشل إضافة المستند' : 'Failed to add document'),
          icon: 'error',
          confirmButtonText: this.lang === 'ar' ? 'حسناً' : 'OK',
          customClass: {
            popup: 'text-center',
            title: 'text-center',
            htmlContainer: 'text-center',
            confirmButton: 'text-center'
          }
        });
      },
      complete: () => {
        this.isSaving = false;
      }
    });
  }

  closeInsightDialog(): void {
    this.displayInsightDialog = false;
    this.editingDocument = null;
    this.initInsightDocForm();
  }

  onInsightFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (files.length > 0) {
      const file = files[0];
      const extension = this.getFileExtension(file.name);
      
      this.insightDocForm.patchValue({
        file: file,
        filePreview: true,
        fileIcon: this.getFileIconByExtension(extension),
        file_extension: extension,
        fromServer: false,
        docId: null,
        file_size: file.size
      });
    }
  }

  openNewDocumentDialog(): void {
    this.editingDocument = null;
    
    // First initialize the form
    if (this.knowledge?.type === 'statistic') {
      this.initInsightDocForm();
      this.headerTitle = this.lang === 'en' ? 'Add New Document' : 'إضافة مستند جديد';
      
      // Then show dialog after a slight delay to ensure form is ready
      setTimeout(() => {
        this.displayInsightDialog = true;
      }, 0);
    } else {
      this.initDocForm();
      
      if (this.knowledge?.type === 'data') {
        this.headerTitle = this.lang === 'en' ? 'Add New Node' : 'إضافة عقدة جديدة';
      } else {
        this.headerTitle = this.lang === 'en' ? 'Add New Chapter' : 'إضافة فصل جديد';
      }
      
      // Then show dialog after a slight delay to ensure form is ready
      setTimeout(() => {
        this.displayDocumentDialog = true;
      }, 0);
    }
  }

  shouldShowTableOfContents(doc: DocumentInfo): boolean {
    return  !!doc?.table_of_content?.length;
  }

  isInsightType(): boolean {
    return this.knowledge?.type === 'statistic';
  }

  editorInit = {
    height: 300,
    menubar: false,
    plugins: [
      'advlist autolink lists link image charmap print preview anchor',
      'searchreplace visualblocks code fullscreen',
      'insertdatetime media table paste code help wordcount'
    ],
    toolbar: 'undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',
    branding: false,
    elementpath: false,
    setup: (editor: any) => {
      editor.on('init', () => {
        setTimeout(() => {
          editor.focus();
        }, 500);
      });
    }
  };

  formatFileSize(size: number): string {
    if (size < 1024) {
      return size + ' bytes';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(2) + ' KB';
    } else {
      return (size / (1024 * 1024)).toFixed(2) + ' MB';
    }
  }

  onLanguageMismatchConfirm(): void {
    this.showLanguageMismatchDialog = false;
    if (this.languageMismatchResolver) {
      this.languageMismatchResolver(true); // User clicked "Ignore"
      this.languageMismatchResolver = null;
    }
  }

  onLanguageMismatchCancel(): void {
    this.showLanguageMismatchDialog = false;
    if (this.languageMismatchResolver) {
      this.languageMismatchResolver(false); // User clicked "Edit"
      this.languageMismatchResolver = null;
    }
  }

  // Modal methods
  openDocumentModal(): void {
    // Instead of opening modal directly, trigger file input first
    this.triggerFileInputForModal();
  }

  /**
   * Public method to handle the tryAnotherFileRequest event from document-modal
   */
  handleTryAnotherFile(): void {
    // This public method can be accessed from the template
    this.triggerFileInputForModal();
  }

  private triggerFileInputForModal(): void {
    // Create a temporary file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt';
    fileInput.style.display = 'none';
    
    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        // File selected, now open modal with pre-loaded file
        this.openDocumentModalWithFile(file);
      }
      // Clean up
      document.body.removeChild(fileInput);
    };
    
    // Add to DOM and trigger click
    document.body.appendChild(fileInput);
    fileInput.click();
  }

  private openDocumentModalWithFile(file: File): void {
    this.editingDocumentForModal = null;
    this.showDocumentModal = true;
    
    // Pass the selected file to modal (we'll need to add this functionality)
    setTimeout(() => {
      // Use setTimeout to ensure modal is rendered
      this.preSelectedFile = file;
    }, 100);
  }

  preSelectedFile: File | null = null;

  onDocumentSaved(): void {
    // Refresh the documents list when a document is saved
    this.loadDocuments();
    
    // Notify parent component to update total_price
    this.knowledgeUpdateService.notifyKnowledgeUpdate();
    
    // Clear the pre-selected file
    this.preSelectedFile = null;
  }

  onModalVisibilityChanged(visible: boolean): void {
    this.showDocumentModal = visible;
    if (!visible) {
      // Clear the pre-selected file when modal is closed
      this.preSelectedFile = null;
    }
  }
}
