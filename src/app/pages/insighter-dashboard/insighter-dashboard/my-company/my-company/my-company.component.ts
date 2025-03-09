import { Component, Injector, OnInit } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CompanyAccountService } from 'src/app/_fake/services/company-account/company-account.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';

interface Insighter {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  roles: string[];
  profile_photo_url: string | null;
  country: string;
  insighter_status: string;
  verified_as_insighter: boolean;
}

interface PaginationMeta {
  current_page: number;
  from: number;
  last_page: number;
  path: string;
  per_page: number;
  to: number;
  total: number;
}

@Component({
  selector: 'app-my-company',
  templateUrl: './my-company.component.html',
  styleUrls: ['./my-company.component.scss']
})
export class MyCompanyComponent extends BaseComponent implements OnInit {
  // Modal state
  displayAddEmployeeModal = false;
  
  // Account checking state
  isCheckingAccount = false;
  accountExists = false;
  accountExistError: string | null = null;
  accountInfo: any = null;
  apiCheckCompleted = false;
  industries: any[] = [];
  consultingFields: any[] = [];
  isInviting = false;
  
  // Forms
  emailForm: FormGroup;
  employeeForm: FormGroup;
  
  // Insighter table data
  insighters: Insighter[] = [];
  loading: boolean = false;
  totalRecords: number = 0;
  rows: number = 10;
  first: number = 0;
  paginationMeta: PaginationMeta | null = null;
  
  constructor(
    injector: Injector,
    private fb: FormBuilder,
    private companyAccountService: CompanyAccountService,
    private profileService: ProfileService
  ) {
    super(injector);
    
    // Initialize forms
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    
    this.employeeForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    this.profileService.getProfile().subscribe((user)=>{
      this.industries = user.industries;
      this.consultingFields = user.consulting_field;
    });
    
    // Load initial insighter data
    this.loadInsighters(1);
    
    // Listen for email changes to trigger account check
    this.emailForm.get('email')?.valueChanges
      .pipe(
        debounceTime(500), // Wait for 500ms pause in typing
        distinctUntilChanged() // Only emit when value changes
      )
      .subscribe(email => {
        if (this.emailForm.get('email')?.valid && email) {
          this.checkAccountExist(email);
        } else {
          // Reset form states when email is invalid
          this.resetAccountState();
        }
      });
  }
  
  // Load insighters with pagination
  loadInsighters(page: number = 1): void {
    this.loading = true;
    this.companyAccountService.getInsighters(page, this.rows).subscribe({
      next: (response) => {
        this.insighters = response.data;
        this.paginationMeta = response.meta;
        this.totalRecords = response.meta.total;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.showError('Error', 'Failed to load insighters');
        console.error('Error loading insighters:', error);
      }
    });
  }
  
  // Handle page change event
  onPageChange(event: any): void {
    this.first = event.first;
    this.rows = event.rows;
    const page = Math.floor(event.first / event.rows) + 1;
    this.loadInsighters(page);
  }
  
  // Open the add employee modal
  openAddEmployeeModal(): void {
    this.resetForms();
    this.displayAddEmployeeModal = true;
  }
  
  // Close the add employee modal
  closeAddEmployeeModal(): void {
    this.displayAddEmployeeModal = false;
    this.resetForms();
  }
  
  // Reset all forms and state
  resetForms(): void {
    this.emailForm.reset();
    this.employeeForm.reset();
    this.resetAccountState();
  }
  
  // Reset account checking state
  resetAccountState(): void {
    this.accountExists = false;
    this.accountExistError = null;
    this.accountInfo = null;
    this.apiCheckCompleted = false;
  }
  
  // Check if account exists
  checkAccountExist(email: string): void {
    this.isCheckingAccount = true;
    this.accountExistError = null;
    this.apiCheckCompleted = false;
    
    this.companyAccountService.checkAccountExist(email)
      .subscribe({
        next: (response) => {
          this.isCheckingAccount = false;
          this.apiCheckCompleted = true;
          
          if (response.data) {
            // Account exists and is valid for invitation
            this.accountExists = true;
            this.accountExistError = null;
            this.accountInfo = response.data;
            
            // Update employee form with existing data
            this.employeeForm.patchValue({
              email: email,
              firstName: response.data.first_name,
              lastName: response.data.last_name
            });
          } else {
            // Account doesn't exist - show form to create one
            this.accountExists = false;
            this.accountExistError = null;
            this.accountInfo = null;
            
            // Only set email in the employee form
            this.employeeForm.patchValue({
              email: email,
              firstName: '',
              lastName: ''
            });
          }
        },
        error: (error) => {
          this.isCheckingAccount = false;
          this.apiCheckCompleted = true;
          
          if (error.error && error.error.message) {
            // Show error message from API
            this.accountExistError = error.error.message;
            this.accountExists = false;
            this.accountInfo = null;
          } else {
            // Generic error
            this.accountExistError = 'An error occurred while checking the account';
            this.accountExists = false;
            this.accountInfo = null;
          }
        }
      });
  }
  
  // Invite employee (this would be connected to a real API in the future)
  inviteEmployee(): void {
    this.isInviting = true;
    
    // Prepare data for API
    const email = this.accountExists ? this.accountInfo.email : this.employeeForm.get('email')?.value;
    const firstName = this.accountExists ? this.accountInfo.first_name : this.employeeForm.get('firstName')?.value;
    const lastName = this.accountExists ? this.accountInfo.last_name : this.employeeForm.get('lastName')?.value;
    
    // Convert industry and consulting field IDs to strings
    const industryIds = this.industries.map(industry => industry.id.toString());
    const consultingFieldIds = this.consultingFields.map(field => field.id.toString());
    
    // Call the API
    this.companyAccountService.inviteInsighter({
      email: email,
      first_name: firstName,
      last_name: lastName,
      industries: industryIds,
      consulting_field: consultingFieldIds
    }).subscribe({
      next: (response) => {
        this.isInviting = false;
        this.showSuccess('Success', 'Insighter invitation has been sent');
        this.closeAddEmployeeModal();
        
        // Reload insighters maintaining the current page
        const currentPage = this.paginationMeta?.current_page || 1;
        this.loadInsighters(currentPage);
      },
      error: (error) => {
        this.isInviting = false;
        let errorMessage = 'An error occurred while sending the invitation';
        
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.error && error.error.errors && error.error.errors.common) {
          errorMessage = error.error.errors.common[0];
        }
        
        this.showError('Error', errorMessage);
      }
    });
  }
  
  // Get user initials for avatar
  getUserInitials(name: string): string {
    if (!name) return '';
    
    const nameParts = name.split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    } else if (nameParts.length === 1) {
      return nameParts[0][0].toUpperCase();
    }
    
    return '';
  }
  
  // Get status badge class
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'badge-light-success';
      case 'pending':
        return 'badge-light-warning';
      case 'inactive':
        return 'badge-light-danger';
      default:
        return 'badge-light-info';
    }
  }
  
  // Get verification badge class
  getVerificationBadgeClass(verified: boolean): string {
    return verified ? 'badge-light-success' : 'badge-light-warning';
  }
}
