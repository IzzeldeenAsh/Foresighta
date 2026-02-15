import { Component, Injector, OnInit } from "@angular/core";
import { MessageService } from "primeng/api";
import { IKnoldgProfile } from "src/app/_fake/models/profile.interface";
import {
  Document,
  DocumentsService,
} from "src/app/_fake/services/douments-types/documents-types.service";
import { ProfileService } from "src/app/_fake/services/get-profile/get-profile.service";
import { UpdateProfileService } from "src/app/_fake/services/profile/profile.service";
import { BaseComponent } from "src/app/modules/base.component";
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: "app-company-certificates",
  templateUrl: "./company-certificates.component.html",
  styleUrl: "./company-certificates.component.scss",
})
export class CompanyCertificatesComponent extends BaseComponent implements OnInit {
  profile: IKnoldgProfile;
  loadingProfile: boolean = false;
  documentTypes: Document[];
  isLoadingDocumentTypes: boolean = false;
  
  // Company certificate properties
  displayAddCompanyCertDialog: boolean = false;
  displayCompanyDeleteDialog: boolean = false;
  selectedCompanyDocType: string;
  selectedCompanyFile: File | null = null;
  isUploadingCompany: boolean = false;
  isDeletingCompany: boolean = false;
  selectedCompanyCertificate: any = null;

  constructor(
    private documentsService: DocumentsService,
    injector: Injector,
    private _profilePost: UpdateProfileService,
    private getProfileService: ProfileService,
    public messageService: MessageService,
    public translateService: TranslateService 
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.updateLang(); 
    this.loadDocList();
    this.getProfile();
  }
  
  updateLang() {
    this.lang = this.translateService.currentLang || 'en';
    
    const langSub = this.translateService.onLangChange.subscribe((event) => {
      this.lang = event.lang;
    });
    this.unsubscribe.push(langSub);
  }

  getProfile() {
    this.loadingProfile = true;
    const getProfileSub = this.getProfileService.getProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loadingProfile = false;
      },
      error: (error) => {
        this.loadingProfile = false;
      },
    });
    this.unsubscribe.push(getProfileSub);
  }

  loadDocList() {
    const docListSub = this.documentsService.getDocumentsTypes("corporate").subscribe({
      next: (types) => {
        this.documentTypes = types;
        this.isLoadingDocumentTypes = false;
      },
      error: (error) => {
        this.isLoadingDocumentTypes = false;
      },
    });
    this.unsubscribe.push(docListSub);
  }

  getFileIcon(url: string) {
    if (url) {
      const extension = url.split(".").pop()?.toLowerCase();
      const iconPath = `./assets/media/svg/files/${extension}.svg`;
      // Optionally, you can add logic to handle missing icons
      return iconPath;
    }
    return "./assets/media/svg/files/default.svg";
  }

  gerCertName(certId: string) {
    if (!this.documentTypes || this.documentTypes.length === 0) {
      return "Other";
    }
    const doc = this.documentTypes.find((cert) => cert.id === certId);
    return doc ? doc.name : "Other";
  }

  
  // Company Certificate Methods
  showAddCompanyCertDialog() {
    this.displayAddCompanyCertDialog = true;
    this.selectedCompanyDocType = '';
    this.selectedCompanyFile = null;
    this.isUploadingCompany = false;
  }
  
  onCompanyFileSelect(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      // Check file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
      if (allowedTypes.includes(file.type)) {
        this.selectedCompanyFile = file;
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Invalid file type. Please upload PDF, DOC, DOCX, JPG or PNG files only.'
        });
        event.target.value = '';
      }
    }
  }
  
  uploadCompanyCertificate() {
    if (!this.selectedCompanyDocType || !this.selectedCompanyFile) {
      return;
    }

    this.isUploadingCompany = true;

    const uploadSub = this._profilePost.updateCompanyCertification(this.selectedCompanyDocType, this.selectedCompanyFile).subscribe({
      next: (response: any) => {
        this.showSuccess(
          this.lang === 'ar' ? 'نجح' : 'Success',
          this.lang === 'ar' ? 'تم رفع الشهادة بنجاح' : 'Company certificate uploaded successfully'
        );
        this.displayAddCompanyCertDialog = false;
        this.getProfileService.clearProfile();
        this.getProfile(); // Refresh the profile to show new certificate
      },
      error: (error: any) => {
        this.handleServerErrors(error);
        this.isUploadingCompany = false;
      },
      complete: () => {
        this.isUploadingCompany = false;
      }
    });

    this.unsubscribe.push(uploadSub);
  }

  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          if (error.error.type === "warning") {
            this.showWarn('Error',messages.join(", "));
          } else {
            this.showError('Error',messages.join(", "));
          }
        }
      }
    } else {
      this.showError(
        this.lang === "ar" ? "حدث خطأ" : "An error occurred",
        this.lang === "ar" ? "حدث خطأ" : "An unexpected error occurred."
      );
    }
  }
  
  confirmCompanyDelete(cert: any) {
    this.selectedCompanyCertificate = cert;
    this.displayCompanyDeleteDialog = true;
  }
  
  deleteCompanyCertificate() {
    if (!this.selectedCompanyCertificate) {
      return;
    }

    this.isDeletingCompany = true;
    // Use the dedicated company certificate deletion method
    const deleteSub = this._profilePost.deleteCompanyCertificate(this.selectedCompanyCertificate.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Company certificate deleted successfully'
        });
        this.displayCompanyDeleteDialog = false;
        this.getProfileService.clearProfile();
        this.getProfile(); // Refresh the profile to update the certificates list
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete company certificate'
        });
      },
      complete: () => {
        this.isDeletingCompany = false;
      }
    });

    this.unsubscribe.push(deleteSub);
  }
}
