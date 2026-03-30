import { Component, EventEmitter, Input, Output, OnInit, Injector, ViewChild, ElementRef, SimpleChanges } from '@angular/core';
import { IKnoldgProfile } from 'src/app/_fake/models/profile.interface';
import { MessageService } from 'primeng/api';
import { ProfileService } from 'src/app/_fake/services/profile-picture/profile.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { ProfileService as AccountProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { ProjectProgressCelebrationService } from 'src/app/reusable-components/project-progress-celebration/project-progress-celebration.service';

@Component({
  selector: 'app-profile-header',
  templateUrl: './profile-header.component.html',
  styleUrls: ['./profile-header.component.scss'],
})
export class ProfileHeaderComponent extends BaseComponent implements OnInit {
  @Input() profile: IKnoldgProfile;
  @Output() photoupdated: EventEmitter<void> = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;

  isAvatar: boolean = true;
  selectedImage: any = null;
  profileImage: string;
  isLoading: boolean = false; // Optional: Loading state

  constructor(
    messageService: MessageService,
    private profileService: ProfileService,
    injector: Injector,
    private readonly accountProfileService: AccountProfileService,
    private readonly projectProgressCelebrationService: ProjectProgressCelebrationService
  ) {
    super(injector);
  }

  ngOnInit() {
    this.profileImage = this.getProfileImage();
  }
  ngOnChanges(changes: SimpleChanges) {
    if (changes.profile && !changes.profile.firstChange) {
      this.profileImage = this.getProfileImage();
    }
  }
  getProfileImage(): string {
    if (this.selectedImage) {
      return this.selectedImage;
    } else if (this.profile?.company?.logo) {
      return this.profile.company.logo;
    } else if (this.profile?.profile_photo_url) {
      return this.profile.profile_photo_url;
    } else {
      return 'assets/media/avatars/blank.png';
    }
  }
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.uploadImage(file);
    }
  }
  onCancel(): void {
    // Reset the selected image
    this.selectedImage = null;
    this.profileImage = this.getProfileImage();

    // Reset the file input
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }
  onRemove(): void {
    // Call service to remove the image on the server
    this.profileService.removeProfilePhoto().subscribe(
      (response: any) => {
        this.selectedImage = null;
        this.profileImage = 'assets/media/avatars/blank.png';
        this.photoupdated.emit();

        const message = this.lang === 'ar' 
          ? "تم تحميل صورتك الشخصية بنجاح" 
          : 'Your profile picture has been removed successfully.';
        this.showSuccess('', message);

        // Reset the file input
        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }
      },
      (error: any) => {
        const message = this.lang === 'ar' 
          ? 'حدث خطأ أثناء إزالة صورة ملفك الشخصي.' 
          : 'An error occurred while removing your profile picture.';
        this.showError('', message);
      }
    );
  }
  uploadImage(file: File): void {
    const MIN_WIDTH = 100;  // Set your desired minimum width
    const MIN_HEIGHT = 100; // Set your desired minimum height

    this.isLoading = true; // Optional: Start loading

    const validateImage = (file: File): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event: any) => {
          const img = new Image();
          img.onload = () => {
            if (img.width >= MIN_WIDTH && img.height >= MIN_HEIGHT) {
              resolve(true);
            } else {
              resolve(false);
            }
          };
          img.onerror = () => {
            reject(new Error('Invalid image file.'));
          };
          img.src = event.target.result;
        };

        reader.onerror = () => {
          reject(new Error('Error reading file.'));
        };

        reader.readAsDataURL(file);
      });
    };

    validateImage(file)
      .then((isValid) => {
        if (!isValid) {
          const title = this.lang === 'ar' ? 'جودة ضعيفة' : "Low Resolution";
          const message = this.lang === 'ar' 
            ? `يرجى تحميل صورة بأبعاد لا تقل عن ${MIN_WIDTH}x${MIN_HEIGHT} بكسل.`
            : `Please upload an image with at least ${MIN_WIDTH}x${MIN_HEIGHT} pixels.`;

          this.showError(title, message);

          // **Clear any existing selected image and preview**
          this.selectedImage = null;
          this.profileImage = this.getProfileImage();

          // **Reset the file input to allow re-uploading the same file**
          if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
          }

          this.isLoading = false; // Optional: Stop loading
          return;
        }

        // **Set the image preview since validation passed**
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.selectedImage = e.target.result;
          this.profileImage = this.selectedImage;
        };
        reader.readAsDataURL(file);

        // Proceed with the upload if validation passes
        if (this.profile.roles.includes('company')) {
          this.profileService.updateCompanyLogo(file).subscribe(
            (response: any) => {
              // Handle successful upload
              this.syncProfileAfterPhotoUpdate();
              const title = this.lang === 'ar' ? 'تم تحديث صورة الملف الشخصي' : 'Profile Picture Updated';
              const message = this.lang === 'ar' 
                ? 'تم تحديث صورة ملفك الشخصي بنجاح.' 
                : 'Your profile picture has been updated successfully.';
            
              this.showSuccess(title, message);

              const celebrationSub = this.projectProgressCelebrationService
                .checkMilestone('profile', this.profile?.roles ?? [])
                .subscribe();
              this.unsubscribe.push(celebrationSub);

              this.isLoading = false; // Optional: Stop loading
            },
            (error: any) => {
              console.error('Error updating company logo:', error);
              this.isLoading = false;
            }
          );
        } else {
          this.profileService.updateProfilePhoto(file).subscribe(
            (response: any) => {
              // Handle successful upload
              this.syncProfileAfterPhotoUpdate();
              const title = this.lang === 'ar' ? 'تم تحديث صورة الملف الشخصي' : 'Profile Picture Updated';
              const message = this.lang === 'ar' 
                ? 'تم تحديث صورة ملفك الشخصي بنجاح.' 
                : 'Your profile picture has been updated successfully.';

              this.showSuccess(title, message);

              const celebrationSub = this.projectProgressCelebrationService
                .checkMilestone('profile', this.profile?.roles ?? [])
                .subscribe();
              this.unsubscribe.push(celebrationSub);

              this.isLoading = false; // Optional: Stop loading
            },
            (error: any) => {
              // Handle error
              const title = this.lang === 'ar' ? 'خطأ' : 'Error';
              const message = this.lang === 'ar' 
                ? 'حدث خطأ أثناء تحديث صورة ملفك الشخصي.' 
                : 'An error occurred while updating your profile picture.';

              this.showError(title, message);

              // **Clear the image preview on upload error**
              this.selectedImage = null;
              this.profileImage = this.getProfileImage();
              // **Reset the file input**
              if (this.fileInput) {
                this.fileInput.nativeElement.value = '';
              }

              this.isLoading = false; // Optional: Stop loading
            }
          );
        }
      })
      .catch((err) => {
        // Handle any unexpected errors during validation
        console.error(err);
        const title = this.lang === 'ar' ? 'خطأ' : 'Error';
        const message = this.lang === 'ar' 
          ? 'حدث خطأ أثناء تحديث صورة ملفك الشخصي.' 
          : 'An error occurred while updating your profile picture.';

        this.showError(title, message);

        // **Clear the image preview in case of unexpected errors**
        this.selectedImage = null;
        this.profileImage = this.getProfileImage();

        // **Reset the file input**
        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }

        this.isLoading = false; // Optional: Stop loading
      });
  }

  hasRole(rolesRequired: string[]): boolean {
    return rolesRequired.some((role)=>this.profile.roles.includes(role))
  }

  private syncProfileAfterPhotoUpdate(): void {
    const sub = this.accountProfileService.refreshProfile().subscribe({
      next: () => {
        this.photoupdated.emit();
      },
      error: () => {
        this.photoupdated.emit();
      },
    });

    this.unsubscribe.push(sub);
  }
  
}
