import { Component, Injector, OnInit } from "@angular/core";
import { MessageService } from "primeng/api";
import { IKnoldgProfile } from "src/app/_fake/models/profile.interface";
import {
  Document,
  DocumentsService,
} from "src/app/_fake/services/douments-types/documents-types.service.spec";
import { ProfileService } from "src/app/_fake/services/get-profile/get-profile.service";
import { UpdateProfileService } from "src/app/_fake/services/profile/profile.service";
import { BaseComponent } from "src/app/modules/base.component";

@Component({
  selector: "app-certificates",
  templateUrl: "./certificates.component.html",
  styleUrl: "./certificates.component.scss",
})
export class CertificatesComponent extends BaseComponent implements OnInit {
  profile: IKnoldgProfile;
  lang: string = "en";
  loadingProfile: boolean = false;
  documentTypes: Document[];
  isLoadingDocumentTypes: boolean = false;
  
  // Certificate properties
  displayAddCertDialog: boolean = false;
  displayDeleteDialog: boolean = false;
  selectedDocType: string;
  selectedFile: File | null = null;
  isUploading: boolean = false;
  isDeleting: boolean = false;
  selectedCertificate: any = null;

  constructor(
    private documentsService: DocumentsService,
    injector: Injector,
    private _profilePost: UpdateProfileService,
    private getProfileService: ProfileService,
    public messageService: MessageService
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.loadDocList();
    this.getProfile();
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
    const docListSub = this.documentsService.getDocumentsTypes().subscribe({
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

  // Personal Certificate Form Data
  private createFormData(): FormData {
    const formData = new FormData();
    formData.append("first_name", this.profile.first_name);
    formData.append("last_name", this.profile.last_name);
    if (this.profile.country_id) {
      formData.append("country_id", this.profile.country_id.toString());
    }
    if (this.profile.bio) {
      formData.append("bio", this.profile.bio);
    } else {
      formData.append("bio", this.generateDummyBio());
    }
    if (this.profile.phone) {
      formData.append("phone", this.profile.phone);
    }
    // Append regular industries
    if (this.profile.industries.length > 0) {
      this.profile.industries.forEach((industry: any) => {
        formData.append("industries[]", industry.id);
      });
    }
    if (this.profile.consulting_field.length > 0) {
      this.profile.consulting_field.forEach((field: any) => {
        formData.append("consulting_field[]", field.id);
      });
    }
    // Add company information if user has company role
    if (this.profile.roles.includes("company") && this.profile.company?.legal_name) {
      formData.append("legal_name", this.profile.company.legal_name);
      formData.append("about_us", this.profile.company.about_us);
    }
    if (this.profile.roles.includes("company") && this.profile.company?.website) {
      formData.append("website", this.profile.company.website);
    }
    return formData;
  }

  private generateDummyBio(): string {
    const fullName = `${this.profile.first_name} ${this.profile.last_name}`;
    let bio = `${fullName} is a professional`;
    
    // Add industry information if available
    if (this.profile.industries && this.profile.industries.length > 0) {
      bio += ` with experience in ${this.profile.industries.length > 1 ? 'various industries' : 'the industry'}`;
      
      // Add specific industry names if not too many
      if (this.profile.industries.length <= 3) {
        const industryNames = this.profile.industries.map((ind: any) => ind.name || 'specialized sector').filter(Boolean);
        if (industryNames.length > 0) {
          bio += ` including ${industryNames.join(', ')}`;
        }
      }
    }
    
    // Add consulting information if available
    if (this.profile.consulting_field && this.profile.consulting_field.length > 0) {
      bio += `. Provides consulting services`;
      
      // Add specific consulting fields if not too many
      if (this.profile.consulting_field.length <= 3) {
        const fieldNames = this.profile.consulting_field.map((field: any) => field.name || 'specialized areas').filter(Boolean);
        if (fieldNames.length > 0) {
          bio += ` in ${fieldNames.join(', ')}`;
        }
      }
    }
    
    // Add company information if user has company role
    if (this.profile.roles && this.profile.roles.includes("company") && this.profile.company) {
      bio += `. Associated with ${this.profile.company.legal_name || 'a company'}`;
      if (this.profile.company.website) {
        bio += ` (${this.profile.company.website})`;
      }
    }
    
    bio += '.';
    return bio;
  }

  // Personal Certificate Methods
  showAddCertDialog() {
    this.displayAddCertDialog = true;
    this.selectedDocType = '';
    this.selectedFile = null;
    this.isUploading = false; // Reset loading state when opening dialog
  }

  onFileSelect(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      // Check file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
      if (allowedTypes.includes(file.type)) {
        this.selectedFile = file;
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

  uploadCertificate() {
    if (!this.selectedDocType || !this.selectedFile) {
      return;
    }

    this.isUploading = true;
    const formData = this.createFormData();
    
    // Add the new certificate
    formData.append(`certification[${this.profile.certifications.length}][type]`, this.selectedDocType);
    formData.append(`certification[${this.profile.certifications.length}][file]`, this.selectedFile);

    const uploadSub = this._profilePost.postProfile(formData).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Certificate uploaded successfully'
        });
        this.displayAddCertDialog = false;
        this.getProfileService.clearProfile();
        this.getProfile(); // Refresh the profile to show new certificate
      },
      error: (error: any) => {
        // Handle detailed API errors
        let errorMessage = 'Failed to upload certificate';
        
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        }
        
        // Check for specific validation errors
        if (error.error && error.error.errors) {
          const errorKeys = Object.keys(error.error.errors);
          if (errorKeys.length > 0) {
            const firstError = error.error.errors[errorKeys[0]];
            if (Array.isArray(firstError) && firstError.length > 0) {
              errorMessage = firstError[0];
            }
          }
        }
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage
        });
        
        this.isUploading = false;
      },
      complete: () => {
        this.isUploading = false;
      }
    });

    this.unsubscribe.push(uploadSub);
  }

  confirmDelete(cert: any) {
    this.selectedCertificate = cert;
    this.displayDeleteDialog = true;
  }

  deleteCertificate() {
    if (!this.selectedCertificate) {
      return;
    }

    this.isDeleting = true;
    const deleteSub = this._profilePost.deleteCertificate(this.selectedCertificate.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Certificate deleted successfully'
        });
        this.displayDeleteDialog = false;
        this.getProfileService.clearProfile();
        this.getProfile(); // Refresh the profile to update the certificates list
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete certificate'
        });
      },
      complete: () => {
        this.isDeleting = false;
      }
    });

    this.unsubscribe.push(deleteSub);
  }
  

}
