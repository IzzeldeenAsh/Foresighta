import { Knowledge } from 'src/app/_fake/services/knowledge/knowledge.service';
import { Component, Injector, OnInit, ViewChild } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CountryDropdownComponent, Country as DropdownCountry } from 'src/app/reusable-components/country-dropdown/country-dropdown.component';
import { CountriesService, Country as ServiceCountry } from 'src/app/_fake/services/countries/countries.service';
import { CompanyAccountService, DashboardStatisticsResponse } from 'src/app/_fake/services/company-account/company-account.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { ConfirmationService } from 'primeng/api';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexResponsive,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  ChartComponent
} from 'ng-apexcharts';

interface Insighter {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  uuid: string;
  roles: string[];
  profile_photo_url: string | null;
  country: string;
  insighter_status: string;
  Knowledge_id?: number;
  verified_as_insighter: boolean;
  knowledge_type_statistics?: {
    report?: number;
    data?: number;
    statistic?: number;
    manual?: number;
    course?: number;
  };
  company?: {
    status: string;
  };
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

export type PublishedKnowledgeBarChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  tooltip: ApexTooltip;
  legend: ApexLegend;
  fill: ApexFill;
  stroke: ApexStroke;
  colors: string[];
  responsive: ApexResponsive[];
};

export type PublishedKnowledgeDonutChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  colors: string[];
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  plotOptions: ApexPlotOptions;
  responsive: ApexResponsive[];
  fill: ApexFill;
  stroke: ApexStroke;
};

@Component({
  selector: 'app-my-company',
  templateUrl: './my-company.component.html',
  styleUrls: ['./my-company.component.scss', './grid-view-styles.scss']
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
  isLoading = false;
  
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
  
  // Current user ID and profile info
  currentUserId: number | null = null;
  currentUserCountryId: number | null = null;
  
  // Track expanded rows
  expandedRows: {[key: number]: boolean} = {};
  
  // View mode for toggle between table and grid
  viewMode: 'table' | 'grid' = 'grid';
  
  // Countries data
  availableCountries: DropdownCountry[] = [];
  gridInsighters: Insighter[] = [];

  // Dashboard statistics
  dashboardStats: DashboardStatisticsResponse['data'] | null = null;
  @ViewChild('publishedKnowledgeBarChart') publishedKnowledgeBarChart?: ChartComponent;
  @ViewChild('publishedKnowledgeDonutChart') publishedKnowledgeDonutChart?: ChartComponent;
  publishedKnowledgeBarChartOptions: Partial<PublishedKnowledgeBarChartOptions> = this.createInitialBarChartOptions();
  publishedKnowledgeDonutChartOptions: Partial<PublishedKnowledgeDonutChartOptions> = this.createInitialDonutChartOptions();
  hasPublishedKnowledgeBarData = false;
  hasPublishedKnowledgeDonutData = false;
  knowledgeTypeLegend: Array<{ label: string; color: string }> = [];
  publishedKnowledgeLegend: Array<{ label: string; color: string }> = [];
  private readonly meetingOrdersColor = '#3B9797';

  private readonly flagBasePath = './assets/media/flags/';
  private readonly defaultFlagSlug = 'united-nations';
  private readonly countryFlagAliases: Record<string, string> = {
    'united states': 'united-states',
    'united states of america': 'united-states',
    'usa': 'united-states',
    'u.s.a.': 'united-states',
    'united kingdom': 'united-kingdom',
    'united kingdom of great britain and northern ireland': 'united-kingdom',
    'uk': 'united-kingdom',
    'u.k.': 'united-kingdom',
    'uae': 'united-arab-emirates',
    'u.a.e.': 'united-arab-emirates',
    'united arab emirates': 'united-arab-emirates',
    'south korea': 'south-korea',
    'republic of korea': 'south-korea',
    'korea, republic of': 'south-korea',
    'north korea': 'north-korea',
    'democratic people\'s republic of korea': 'north-korea',
    'korea, democratic people\'s republic of': 'north-korea',
    'russian federation': 'russia',
    'bolivia (plurinational state of)': 'bolivia',
    'cote divoire': 'ivory-coast',
    'cote d\'ivoire': 'ivory-coast',
    'taiwan, province of china': 'taiwan',
    'hong kong sar china': 'hong-kong',
    'macao sar china': 'macao',
    'macao special administrative region of china': 'macao',
    'brunei darussalam': 'brunei',
    'syrian arab republic': 'syria',
    'province of china taiwan': 'taiwan',
    'myanmar (burma)': 'myanmar',
    'viet nam': 'vietnam',
    'moldova, republic of': 'moldova',
    'iran (islamic republic of)': 'iran',
    'tanzania, united republic of': 'tanzania',
    'lao people\'s democratic republic': 'laos',
    'democratic republic of the congo': 'democratic-republic-of-congo',
    'congo, democratic republic of the': 'democratic-republic-of-congo',
    'congo': 'republic-of-the-congo',
    'congo, republic of the': 'republic-of-the-congo',
    'micronesia (federated states of)': 'micronesia',
    'palestine, state of': 'palestine',
    'holy see (vatican city state)': 'vatican',
    'bahamas, the': 'bahamas',
    'gambia, the': 'gambia',
    'cape verde': 'cabo-verde',
    'east timor': 'timor-leste',
    'eswatini': 'swaziland',
    'czechia': 'czech-republic'
  };
  private readonly knowledgeTypeColors: Record<string, string> = {
    statistic: '#0a7abf',
    report: '#3b9ae1',
    manual: '#6bb6ff',
    data: '#1e88e5',
    course: '#42a5f5'
  };
  
  constructor(
    injector: Injector,
    private fb: FormBuilder,
    private companyAccountService: CompanyAccountService,
    private profileService: ProfileService,
    private confirmationService: ConfirmationService,
    private countriesService: CountriesService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    super(injector);
    
    // Initialize forms
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    
    this.employeeForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      country: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.profileService.getProfile().subscribe((user)=>{
      this.industries = user.industries;
      this.consultingFields = user.consulting_field;
      this.currentUserId = user.id;
      this.currentUserCountryId = user.country_id || null;

      // Set default country in employee form
      this.employeeForm.patchValue({
        country: this.currentUserCountryId
      });
    });

    // Load countries first, then load insighters
    this.loadCountries();

    // Load initial insighter data
    this.loadInsighters(1);

    // Load dashboard statistics
    this.loadDashboardStatistics();

    // Check for addEmployee query parameter
    this.route.queryParams.subscribe(params => {
      if (params['addEmployee'] === 'true') {
        // Open add employee modal
        this.openAddEmployeeModal();
        // Remove the query parameter from URL without reloading
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      }
    });

    // Listen for email changes to trigger account check
    this.emailForm.get('email')?.valueChanges
      .pipe(
        debounceTime(500), // Wait for 500ms pause in typing
        distinctUntilChanged() // Only emit when value changes
      )
      .subscribe(email => {
        if (this.emailForm.get('email')?.valid && email) {
          this.isCheckingAccount = true; // Only show loading after debounce
          this.checkAccountExist(email);
        } else {
          // Reset form states when email is invalid
          this.resetAccountState();
        }
      });
  }

  getCompanySubtitle(): string {
    return this.lang === 'ar' ?
      `إدارة فريق الشركة  ` :
      `Manage company team `;
  }

  // Load insighters with pagination
  loadInsighters(page: number = 1): void {
    this.loading = true;
    this.companyAccountService.getInsighters(page, this.rows).subscribe({
      next: (response) => {
        this.insighters = response.data;
        this.gridInsighters = this.insighters;
        this.paginationMeta = response.meta;
        this.totalRecords = response.meta.total;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.gridInsighters = [];
        this.showError('Error', 'Failed to load insighters');
        console.error('Error loading insighters:', error);
      }
    });
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
    
    // Set default country to current user's country
    this.employeeForm.patchValue({
      country: this.currentUserCountryId
    });
    
    this.resetAccountState();
  }
  
  // Reset account checking state
  resetAccountState(): void {
    this.accountExists = false;
    this.accountExistError = null;
    this.accountInfo = null;
    this.apiCheckCompleted = false;
  }

  // Validate forms before invite
  validateFormsBeforeInvite(): boolean {
    let isValid = true;

    // Check if account exists error
    if (this.accountExistError !== null) {
      this.showError('Error', this.accountExistError);
      return false;
    }

    // Check if still checking account
    if (this.isCheckingAccount) {
      this.showError('Error', 'Please wait while we check the account');
      return false;
    }

    // Validate email form
    if (!this.emailForm.valid) {
      this.emailForm.markAllAsTouched();
      if (this.emailForm.get('email')?.hasError('required')) {
        this.showError('Error', 'Email address is required');
      } else if (this.emailForm.get('email')?.hasError('email')) {
        this.showError('Error', 'Please enter a valid email address');
      }
      return false;
    }

    // For existing accounts, check if account info is loaded
    if (this.accountExists && !this.accountInfo) {
      this.showError('Error', 'Account information is not loaded properly');
      return false;
    }

    // For new accounts or existing accounts without country, validate employee form
    if (!this.accountExists || (this.accountExists && !(this.accountInfo as any)?.country_id)) {
      if (this.employeeForm.invalid) {
        this.employeeForm.markAllAsTouched();
        
        if (this.employeeForm.get('firstName')?.hasError('required')) {
          this.showError('Error', 'First name is required');
          return false;
        }
        
        if (this.employeeForm.get('lastName')?.hasError('required')) {
          this.showError('Error', 'Last name is required');
          return false;
        }
        
        if (this.employeeForm.get('email')?.hasError('required')) {
          this.showError('Error', 'Email address is required');
          return false;
        } else if (this.employeeForm.get('email')?.hasError('email')) {
          this.showError('Error', 'Please enter a valid email address');
          return false;
        }
        
        if (this.employeeForm.get('country')?.hasError('required') || !this.employeeForm.get('country')?.value) {
          this.showError('Error', 'Country selection is required');
          return false;
        }
        
        return false;
      }
    }

    return isValid;
  }
  
  // Check if account exists
  checkAccountExist(email: string): void {
    // Loading indicator is now set before this method is called
    this.accountExistError = null;
    this.apiCheckCompleted = false;
    
    this.companyAccountService.checkAccountExist(email)
      .subscribe({
        next: (response) => {
          this.isCheckingAccount = false;
          this.apiCheckCompleted = true;
          
          // Handle the new API response structure
          // Case 1: Empty array means no user found
          if (Array.isArray(response) && response.length === 0) {
            // Account doesn't exist - show form to create one
            this.accountExists = false;
            this.accountExistError = null;
            this.accountInfo = null;
            
            // Set email and default country in the employee form
            this.employeeForm.patchValue({
              email: email,
              firstName: '',
              lastName: '',
              country: this.currentUserCountryId
            });
            
            console.log('No user found - set default country for new account:', this.currentUserCountryId);
          } 
          // Case 2: Object with data property means user found
          else if (response && typeof response === 'object' && response.data) {
            // Account exists and is valid for invitation
            this.accountExists = true;
            this.accountExistError = null;
            this.accountInfo = response.data;
            
            // Check if country_id has a value
            let countryId: number | null = null;
            
            // Type assertion to access country_id property
            const userData = response.data as any;
            
            if (userData.country_id !== null && userData.country_id !== undefined) {
              // Case 2a: country_id has a value - use it
              countryId = userData.country_id;
              console.log('User found with country_id:', countryId);
            } else {
              // Case 2b: country_id has no value - use profile country_id as default
              countryId = this.currentUserCountryId;
              console.log('User found but no country_id - using profile default:', countryId);
            }
            
            // Update employee form with existing data
            this.employeeForm.patchValue({
              email: email,
              firstName: userData.first_name,
              lastName: userData.last_name,
              country: countryId
            });
            
            console.log('Set country for existing account:', countryId);
            console.log('Available countries at this time:', this.availableCountries.length);
            console.log('Form country value after patch:', this.employeeForm.get('country')?.value);
            
            // If countries haven't loaded yet, wait for them and then update the form
            if (this.availableCountries.length === 0) {
              console.log('Countries not loaded yet, waiting...');
              // Wait for countries to be loaded and then update the form
              const checkCountries = () => {
                if (this.availableCountries.length > 0) {
                  console.log('Countries now loaded, updating form...');
                  this.employeeForm.patchValue({ country: countryId });
                } else {
                  setTimeout(checkCountries, 100);
                }
              };
              checkCountries();
            }
          } else {
            // Unexpected response format
            this.accountExists = false;
            this.accountExistError = 'Unexpected response format from server';
            this.accountInfo = null;
            
            // Set default values
            this.employeeForm.patchValue({
              email: email,
              firstName: '',
              lastName: '',
              country: this.currentUserCountryId
            });
            
            console.log('Unexpected response format - set default country:', this.currentUserCountryId);
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
    // Validate forms before proceeding
    if (!this.validateFormsBeforeInvite()) {
      return;
    }
    
    this.isInviting = true;
    
    // Prepare data for API
    const email = this.accountExists ? this.accountInfo.email : this.employeeForm.get('email')?.value;
    const firstName = this.accountExists ? this.accountInfo.first_name : this.employeeForm.get('firstName')?.value;
    const lastName = this.accountExists ? this.accountInfo.last_name : this.employeeForm.get('lastName')?.value;
    
    // For existing accounts: use their country_id if exists, otherwise use form value (which defaults to profile country)
    // For new accounts: use form value (which defaults to profile country)
    let countryId: number | undefined = undefined;
    
    if (this.accountExists) {
      // Type assertion to access country_id property
      const userData = this.accountInfo as any;
      countryId = userData.country_id !== null && userData.country_id !== undefined ? 
        userData.country_id : 
        this.employeeForm.get('country')?.value;
    } else {
      // For new accounts: use form value (which defaults to profile country)
      countryId = this.employeeForm.get('country')?.value;
    }
    
    // Convert industry and consulting field IDs to strings
    const industryIds = this.industries.map(industry => industry.id.toString());
    const consultingFieldIds = this.consultingFields.map(field => field.id.toString());
    
    // Call the API
    this.companyAccountService.inviteInsighter({
      email: email,
      first_name: firstName,
      last_name: lastName,
      country_id: countryId,
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

    const nameParts = name.split(' ').filter(part => part.trim().length > 0);
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }

    return '';
  }

  // Check if name has two parts for displaying initials
  hasValidInitials(name: string): boolean {
    if (!name) return false;
    const nameParts = name.split(' ').filter(part => part.trim().length > 0);
    return nameParts.length >= 2;
  }
  
  // Get status badge class
  getStatusBadgeClass(status: string): string {
    // Check if insighter has 'company' in roles and use company.status if available
    const insighter = this.insighters.find(ins => ins.insighter_status === status);
    
    if (insighter && insighter.roles && insighter.roles.includes('company') && insighter.company && insighter.company.status) {
      switch (insighter.company.status) {
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
    
    // If no company role or company status, use the regular insighter_status
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
  
  // Calculate total knowledge count for an insighter
  getTotalKnowledgeCount(insighter: Insighter): number {
    if (!insighter.knowledge_type_statistics) {
      return 0;
    }
    
    let total = 0;
    const stats = insighter.knowledge_type_statistics;
    
    // Sum all the knowledge types
    if (stats.report) total += stats.report;
    if (stats.data) total += stats.data;
    if (stats.statistic) total += stats.statistic;
    if (stats.manual) total += stats.manual;
    if (stats.course) total += stats.course;

    return total;
  }

  canActivate(insighter: Insighter): boolean {
    const hasCompanyRole = Array.isArray(insighter.roles) && insighter.roles.includes('company');

    if (hasCompanyRole) {
      return !!insighter.company && insighter.company.status === 'inactive';
    }

    return insighter.insighter_status === 'inactive';
  }

  canDeactivate(insighter: Insighter): boolean {
    const hasCompanyRole = Array.isArray(insighter.roles) && insighter.roles.includes('company');

    if (hasCompanyRole) {
      return false;
    }

    return insighter.insighter_status === 'active' && !!insighter.verified_as_insighter;
  }

  canDelete(insighter: Insighter): boolean {
    return !(Array.isArray(insighter.roles) && insighter.roles.includes('company'));
  }

  getInsighterIdentifier(insighter: Insighter & { [key: string]: any }): string {
    return insighter?.uuid || insighter?.uuuid || '';
  }

  getCountryFlag(country?: string | null): string {
    const slug = this.resolveCountrySlug(country);
    return `${this.flagBasePath}${slug}.svg`;
  }

  handleFlagError(event: Event): void {
    const element = event.target as HTMLImageElement | null;
    if (!element) {
      return;
    }

    const fallbackSrc = `${this.flagBasePath}${this.defaultFlagSlug}.svg`;
    if (element.src.endsWith(`${this.defaultFlagSlug}.svg`)) {
      return;
    }

    element.src = fallbackSrc;
  }

  private resolveCountrySlug(country?: string | null): string {
    if (!country) {
      return this.defaultFlagSlug;
    }

    const normalizedName = country.trim().toLowerCase();
    if (!normalizedName) {
      return this.defaultFlagSlug;
    }

    const alias = this.countryFlagAliases[normalizedName];
    if (alias) {
      return alias;
    }

    const slug = normalizedName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['\u2019`]/g, '')
      .replace(/&/g, 'and')
      .replace(/\./g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return slug || this.defaultFlagSlug;
  }

  navigateToInsighterProfile(insighterId: string, verified: boolean): void {
    if(verified){
      window.open(`https://insightabusiness.com/${this.lang}/profile/${insighterId}?entity=insighter`, '_blank');
    }else{
      this.showError('Error', 'This insighter is not verified');
    }
  }
  
  // Activate insighter
  activateInsighter(insighterId: number): void {
    // Find the insighter to check if they have a company role
    const insighter = this.insighters.find(ins => ins.id === insighterId);
    
    const confirmMessage = insighter && insighter.roles && insighter.roles.includes('company') 
      ? 'Are you sure you want to activate this company account?'
      : 'Are you sure you want to activate this Insighter?';
    
    this.confirmationService.confirm({
      message: confirmMessage,
      header: 'Confirm Activation',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.companyAccountService.activateInsighter(insighterId).subscribe({
          next: () => {
            const successMessage = insighter && insighter.roles && insighter.roles.includes('company')
              ? 'Company has been activated'
              : 'Insighter has been activated';
            
            this.showSuccess('Success', successMessage);
            // Reload insighters maintaining the current page
            const currentPage = this.paginationMeta?.current_page || 1;
            this.loadInsighters(currentPage);
          },
          error: (error) => {
            let errorMessage = 'An error occurred while activating';
            
            if (error.error && error.error.message) {
              errorMessage = error.error.message;
            } else if (error.error && error.error.errors && error.error.errors.common) {
              errorMessage = error.error.errors.common[0];
            }
            
            this.showError('Error', errorMessage);
          }
        });
      }
    });
  }
  
  // Deactivate insighter
  deactivateInsighter(insighterId: number): void {
    // Find the insighter to check if they have a company role
    const insighter = this.insighters.find(ins => ins.id === insighterId);
    
    const confirmMessage = insighter && insighter.roles && insighter.roles.includes('company') 
      ? 'Are you sure you want to deactivate this company account?'
      : 'Are you sure you want to deactivate this insighter?';
    
    this.confirmationService.confirm({
      message: confirmMessage,
      header: 'Confirm Deactivation',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.companyAccountService.deactivateInsighter(insighterId).subscribe({
          next: () => {
            const successMessage = insighter && insighter.roles && insighter.roles.includes('company')
              ? 'Company has been deactivated'
              : 'Insighter has been deactivated';
            
            this.showSuccess('Success', successMessage);
            // Reload insighters maintaining the current page
            const currentPage = this.paginationMeta?.current_page || 1;
            this.loadInsighters(currentPage);
          },
          error: (error) => {
            let errorMessage = 'An error occurred while deactivating';
            
            if (error.error && error.error.message) {
              errorMessage = error.error.message;
            } else if (error.error && error.error.errors && error.error.errors.common) {
              errorMessage = error.error.errors.common[0];
            }
            
            this.showError('Error', errorMessage);
          }
        });
      }
    });
  }
  
  // Delete insighter
  deleteInsighter(insighterId: number): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this insighter? This action cannot be undone.',
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.companyAccountService.deleteInsighter(insighterId).subscribe({
          next: () => {
            this.showSuccess('Success', 'Insighter has been deleted');
            // Reload insighters maintaining the current page
            const currentPage = this.paginationMeta?.current_page || 1;
            this.loadInsighters(currentPage);
          },
          error: (error) => {
            let errorMessage = 'An error occurred while deleting the insighter';
            
            if (error.error && error.error.message) {
              errorMessage = error.error.message;
            } else if (error.error && error.error.errors && error.error.errors.common) {
              errorMessage = error.error.errors.common[0];
            }
            
            this.showError('Error', errorMessage);
          }
        });
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
  
  // Load countries data
  loadCountries(): void {
    this.countriesService.getCountries().subscribe({
      next: (countries) => {
        if (countries && Array.isArray(countries) && countries.length > 0) {
          this.availableCountries = countries.map(country => ({ 
            ...country, 
            showFlag: true 
          } as DropdownCountry));
          console.log('Countries loaded successfully:', this.availableCountries.length);
          
          // Force the country dropdown to re-evaluate the selected country
          // This ensures the country dropdown shows the correct country name after countries are loaded
          const currentCountryId = this.employeeForm.get('country')?.value;
          console.log('Countries loaded, current country ID in form:', currentCountryId);
          if (currentCountryId) {
            // Trigger a change detection by temporarily setting the value to null and back
            this.employeeForm.get('country')?.setValue(null);
            setTimeout(() => {
              this.employeeForm.get('country')?.setValue(currentCountryId);
              console.log('Re-set country ID after countries loaded:', currentCountryId);
            }, 0);
          }
        } else {
          console.warn('Countries API returned empty array or null');
          this.availableCountries = [];
          // this.showWarn('Warning', 'No countries available');
        }
      },
      error: (error) => {
        console.error('Error loading countries:', error);
        this.availableCountries = [];
        this.showError('Error', 'Failed to load countries');
      }
    });
  }
  
  // Toggle view mode between table and grid
  toggleViewMode(mode: 'table' | 'grid'): void {
    this.viewMode = mode;
  }

  // Load dashboard statistics
  loadDashboardStatistics(): void {
    this.companyAccountService.getDashboardStatistics().subscribe({
      next: (data) => {
        this.dashboardStats = data;
        this.setupPublishedKnowledgeChart();
      },
      error: (error) => {
        console.error('Error loading dashboard statistics:', error);
        this.showError(
          this.lang === 'ar' ? 'حدث خطأ' : 'Error',
          this.lang === 'ar' ? 'فشل في تحميل الإحصائيات' : 'Failed to load statistics'
        );
      }
    });
  }

  // Setup published knowledge stacked column chart
  setupPublishedKnowledgeChart(): void {
    const stats = this.dashboardStats?.knowledge_published_statistics;

    this.publishedKnowledgeLegend = [];
    this.knowledgeTypeLegend = [];
    this.hasPublishedKnowledgeBarData = false;
    this.hasPublishedKnowledgeDonutData = false;
    this.publishedKnowledgeBarChartOptions = this.createInitialBarChartOptions();
    this.publishedKnowledgeDonutChartOptions = this.createInitialDonutChartOptions();

    if (!stats || !Array.isArray(stats.insighters) || !stats.insighters.length) {
      return;
    }

    const insighters = stats.insighters;
    const knowledgeTypeOrder = ['statistic', 'report', 'manual', 'data', 'course'];
    const discoveredTypes = new Set<string>();

    Object.keys(stats.type || {}).forEach(type => discoveredTypes.add(type));
    insighters.forEach(insighter => {
      Object.keys(insighter.types || {}).forEach(type => discoveredTypes.add(type));
    });

    const orderedTypes: string[] = [];
    knowledgeTypeOrder.forEach(type => {
      if (discoveredTypes.has(type)) {
        orderedTypes.push(type);
        discoveredTypes.delete(type);
      }
    });
    orderedTypes.push(...Array.from(discoveredTypes));

    const availableTypes = orderedTypes.filter(type => {
      const totalFromStats = Number((stats.type as any)?.[type] ?? 0);
      const totalFromInsighters = insighters.reduce((sum, insighter) => {
        const types = insighter.types || {};
        const count = Number((types as any)[type] ?? 0);
        return sum + (Number.isNaN(count) ? 0 : count);
      }, 0);

      return totalFromStats > 0 || totalFromInsighters > 0;
    });

    if (!availableTypes.length) {
      return;
    }

    const labels = insighters.map(ins => ins.insighter_name || 'Unknown');
    const donutLabels: string[] = [];
    const donutSeries: number[] = [];
    const donutColors: string[] = [];

    const barSeries: ApexAxisChartSeries = [];
    const barColors: string[] = [];
    const knowledgeTotalsByIndex: number[] = Array(insighters.length).fill(0);

    availableTypes.forEach(type => {
      const color = this.knowledgeTypeColors[type as keyof typeof this.knowledgeTypeColors] || '#999';
      const formattedLabel = this.getKnowledgeTypeTranslation(type);
      const data = insighters.map((ins, index) => {
        const types = ins.types || {};
        const value = Number((types as any)[type] ?? 0);
        const sanitized = Number.isNaN(value) ? 0 : value;
        knowledgeTotalsByIndex[index] += sanitized;
        return sanitized;
      });

      this.knowledgeTypeLegend.push({
        label: formattedLabel,
        color
      });

      const totalForType = Number((stats.type as any)?.[type] ?? 0);
      if (totalForType > 0) {
        donutLabels.push(formattedLabel);
        donutSeries.push(totalForType);
        donutColors.push(color);
      }

      barSeries.push({
        name: formattedLabel,
        type: 'column',
        group: 'knowledge',
        data,
        color
      });
      barColors.push(color);
    });

    const donutOptions = this.createInitialDonutChartOptions();
    if (donutSeries.length) {
      donutOptions.series = donutSeries;
      donutOptions.labels = donutLabels;
      donutOptions.colors = donutColors;
      donutOptions.tooltip = {
        ...donutOptions.tooltip,
        y: {
          formatter: (value: number, opts?: any) => {
            const label = donutLabels[opts?.dataPointIndex ?? 0] ?? '';
            return `${label ? label + ': ' : ''}${Math.round(value ?? 0)}`;
          }
        }
      };
      this.hasPublishedKnowledgeDonutData = true;
    }
    this.publishedKnowledgeDonutChartOptions = donutOptions;

    const meetingLabel = this.getTranslation('meetingBookings');
    const meetingBookingsMap = new Map<string, number>();
    const meetingBookingStats = this.dashboardStats?.meeting_booking_statistics?.insighters || [];
    meetingBookingStats.forEach(stat => {
      const meetingCount = Number(stat.meeting_booking_total || 0);
      meetingBookingsMap.set(stat.uuid, Number.isNaN(meetingCount) ? 0 : meetingCount);
    });

    const meetingDatasetData = insighters.map(ins => meetingBookingsMap.get(ins.uuid) ?? 0);
    const hasMeetingData = meetingDatasetData.some(value => value > 0);
    let meetingLegendEntry: { label: string; color: string } | null = null;

    if (hasMeetingData || meetingBookingStats.length) {
      barSeries.push({
        name: meetingLabel,
        type: 'column',
        group: 'meeting-bookings',
        data: meetingDatasetData,
        color: this.meetingOrdersColor
      });
      barColors.push(this.meetingOrdersColor);

      meetingLegendEntry = {
        label: meetingLabel,
        color: this.meetingOrdersColor
      };
    }

    const barOptions = this.createInitialBarChartOptions();
    barOptions.series = barSeries;
    barOptions.colors = barColors;
    barOptions.xaxis = {
      ...(barOptions.xaxis ?? {}),
      categories: labels,
      labels: {
        ...(barOptions.xaxis?.labels ?? {}),
        rotate: -35,
        trim: true,
        style: {
          ...(barOptions.xaxis?.labels?.style ?? {}),
          fontSize: '12px',
          fontWeight: 600,
          colors: Array(labels.length).fill('#475569')
        }
      }
    };
    barOptions.yaxis = {
      ...(barOptions.yaxis ?? {}),
      labels: {
        ...(barOptions.yaxis?.labels ?? {}),
        style: {
          ...(barOptions.yaxis?.labels?.style ?? {}),
          fontSize: '11px',
          fontWeight: 500,
          colors: '#64748B'
        }
      }
    };
    const tooltipSeriesMeta = barSeries.map((seriesItem, index) => ({
      index,
      label: seriesItem.name ?? '',
      color: barColors[index] ?? '#999',
      isMeeting: seriesItem.group === 'meeting-bookings'
    }));

    barOptions.tooltip = {
      shared: true,
      intersect: false,
      custom: ({ series, dataPointIndex }: any) => {
        if (dataPointIndex === undefined) {
          return '';
        }

        const insighterLabel = this.escapeHtml(labels[dataPointIndex] ?? '');
        const totalLabel = this.getTranslation('totalPublished');

        const knowledgeRows = tooltipSeriesMeta
          .filter(meta => !meta.isMeeting)
          .map(meta => {
            const rawValue = Number(series?.[meta.index]?.[dataPointIndex] ?? 0);
            const safeLabel = this.escapeHtml(meta.label);
            return `
              <div class="apex-tooltip__row">
                <span class="apex-tooltip__dot" style="background:${meta.color};"></span>
                <span class="apex-tooltip__label">${safeLabel}</span>
                <span class="apex-tooltip__value">${Math.round(rawValue)}</span>
              </div>
            `;
          })
          .join('');

        const totalPublished = knowledgeTotalsByIndex[dataPointIndex] ?? 0;
        const meetingMeta = tooltipSeriesMeta.find(meta => meta.isMeeting);
        const meetingCount = meetingMeta ? Number(series?.[meetingMeta.index]?.[dataPointIndex] ?? 0) : 0;
        const meetingLabel = meetingMeta ? this.escapeHtml(meetingMeta.label) : '';

        return `
          <div class="apex-tooltip apex-tooltip--knowledge">
            <div class="apex-tooltip__header">${insighterLabel}</div>
            <div class="apex-tooltip__rows">
              ${knowledgeRows}
            </div>
            <div class="apex-tooltip__divider"></div>
            <div class="apex-tooltip__summary">
              <div class="apex-tooltip__summary-item">
                <span class="apex-tooltip__summary-label">${this.escapeHtml(totalLabel)}</span>
                <span class="apex-tooltip__summary-value">${Math.round(totalPublished)}</span>
              </div>
              ${
                meetingMeta
                  ? `<div class="apex-tooltip__summary-item">
                      <span class="apex-tooltip__summary-label">${meetingLabel}</span>
                      <span class="apex-tooltip__summary-value">${Math.round(meetingCount)}</span>
                    </div>`
                  : ''
              }
            </div>
          </div>
        `;
      }
    };
    this.publishedKnowledgeBarChartOptions = barOptions;

    this.publishedKnowledgeLegend = [...this.knowledgeTypeLegend];
    if (meetingLegendEntry) {
      this.publishedKnowledgeLegend.push(meetingLegendEntry);
    }

    this.hasPublishedKnowledgeBarData = barSeries.length > 0 && barSeries.some(seriesItem =>
      Array.isArray(seriesItem.data) && seriesItem.data.some(value => {
        if (typeof value === 'number') {
          return value > 0;
        }

        if (value && typeof value === 'object' && 'y' in value) {
          const numeric = Number((value as { y: number }).y ?? 0);
          return !Number.isNaN(numeric) && numeric > 0;
        }

        return false;
      })
    );
  }

  private createInitialBarChartOptions(): Partial<PublishedKnowledgeBarChartOptions> {
    return {
      series: [],
      chart: {
        type: 'bar',
        height: 260,
        stacked: true,
        stackType: 'normal',
        toolbar: {
          show: false
        },
        fontFamily: 'Poppins, sans-serif'
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '45%',
          borderRadius: 0
        }
      },
      dataLabels: {
        enabled: false
      },
      xaxis: {
        categories: [],
        labels: {
          style: {
            fontFamily: 'Poppins, sans-serif'
          }
        }
      },
      yaxis: {
        min: 0,
        labels: {
          style: {
            fontFamily: 'Poppins, sans-serif'
          }
        }
      },
      tooltip: {
        shared: true,
        intersect: false
      },
      legend: {
        show: false
      },
      fill: {
        opacity: 1
      },
      stroke: {
        show: true,
        width: 1,
        colors: ['#ffffff']
      },
      colors: [],
      responsive: [
        {
          breakpoint: 992,
          options: {
            chart: {
              height: 280
            },
            plotOptions: {
              bar: {
                columnWidth: '55%'
              }
            }
          }
        }
      ]
    };
  }

  private createInitialDonutChartOptions(): Partial<PublishedKnowledgeDonutChartOptions> {
    return {
      series: [],
      chart: {
        type: 'donut',
        height: 260,
        fontFamily: 'Poppins, sans-serif',
        toolbar: {
          show: false
        }
      },
      labels: [],
      colors: [],
      legend: {
        show: false
      },
      dataLabels: {
        enabled: false
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: false
            }
          }
        }
      },
      tooltip: {
        y: {
          formatter: (value: number) => `${Math.round(value ?? 0)}`
        }
      },
      fill: {
        opacity: 1
      },
      stroke: {
        width: 0
      },
      responsive: [
        {
          breakpoint: 992,
          options: {
            chart: {
              height: 240
            }
          }
        }
      ]
    };
  }


  formatCurrency(amount: string | number | null | undefined): string {
    if (amount === null || amount === undefined || amount === '') {
      return '$0';
    }

    const numericAmount = typeof amount === 'number'
      ? amount
      : parseFloat(String(amount).replace(/,/g, ''));

    if (Number.isNaN(numericAmount)) {
      return '$0';
    }

    const locale = this.lang === 'ar' ? 'ar-EG' : 'en-US';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(numericAmount);
  }

  get totalPublishedKnowledge(): number {
    return this.dashboardStats?.knowledge_published_statistics?.total ?? 0;
  }

  get totalMeetings(): number {
    return this.dashboardStats?.meeting_booking_statistics?.total ?? 0;
  }

  private parseAmount(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const sanitized = value.replace(/,/g, '');
      const parsed = parseFloat(sanitized);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    return 0;
  }

  private escapeHtml(value: string): string {
    if (!value) {
      return '';
    }

    return value.replace(/[&<>"'`=\/]/g, (char) => {
      const escapeMap: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;',
        '=': '&#61;',
        '/': '&#47;'
      };

      return escapeMap[char] ?? char;
    });
  }

  // Methods for individual insighter statistics in grid cards
  getInsighterPublishedCount(insighter: Insighter): number {
    const publishedStats = (insighter as any).knowledge_published_statistics;
    if (publishedStats && publishedStats.total_published) {
      return publishedStats.total_published;
    }
    return 0;
  }

  getInsighterPublishedAmount(insighter: Insighter): number {
    const publishedStats = (insighter as any).knowledge_published_statistics;
    if (publishedStats && publishedStats.total_amount) {
      return this.parseAmount(publishedStats.total_amount);
    }
    return 0;
  }

  getInsighterMeetingsCount(insighter: Insighter): number {
    const meetingStats = (insighter as any).meeting_booking_statistics;
    if (meetingStats && meetingStats.total) {
      return meetingStats.total;
    }
    return 0;
  }

  getInsighterMeetingsAmount(insighter: Insighter): number {
    // For meetings, we'll use a placeholder since meeting amounts may not be in the current API
    // This would need to be adjusted based on actual API structure for meeting amounts
    const meetingStats = (insighter as any).meeting_booking_statistics;
    if (meetingStats && meetingStats.total_amount) {
      return this.parseAmount(meetingStats.total_amount);
    }
    return 0;
  }

  getInsighterRequestsCount(insighter: Insighter): number {
    const requestStats = (insighter as any).knowledge_request_statistics;
    if (requestStats) {
      const approved = requestStats.approved || 0;
      const declined = requestStats.declined || 0;
      const pending = requestStats.pending || 0;
      return approved + declined + pending;
    }
    return 0;
  }

  getInsighterRequestsAmount(insighter: Insighter): number {
    // For requests, we'll use a placeholder since request amounts may not be in the current API
    // This would need to be adjusted based on actual API structure for request amounts
    const requestStats = (insighter as any).knowledge_request_statistics;
    if (requestStats && requestStats.total_amount) {
      return this.parseAmount(requestStats.total_amount);
    }
    return 0;
  }

  // Get translated label for knowledge type
  getKnowledgeTypeTranslation(type: string): string {
    // Normalize the type by converting to lowercase and replacing hyphens/underscores
    const normalizedType = type.toLowerCase().replace(/[-_]/g, '_');
    
    const translationMap: { [key: string]: string } = {
      'report': 'KNOWLEDGE_TYPES.REPORTS',
      'data': 'KNOWLEDGE_TYPES.DATA',
      'statistic': 'KNOWLEDGE_TYPES.STATISTICS',
      'manual': 'KNOWLEDGE_TYPES.MANUALS',
      'course': 'KNOWLEDGE_TYPES.COURSES',
      'business_courses': 'KNOWLEDGE_TYPES.BUSINESS_COURSES',
      'media': 'KNOWLEDGE_TYPES.MEDIA'
    };

    const translationKey = translationMap[normalizedType];
    if (translationKey) {
      return this.translate.getTranslation(translationKey);
    }

    // Fallback to capitalized type name if no translation found
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  // Localization method for statistics cards and other components
  getTranslation(key: string): string {
    const translations: { [key: string]: { en: string; ar: string } } = {
      // Statistics cards
      'published': { en: 'Published', ar: 'منشورات' },
      'profit': { en: 'Profit', ar: 'الربح' },
      'meetings': { en: 'Sessions', ar: 'الجلسات الاستشارية' },

      // Common
      'loading': { en: 'Loading', ar: 'جاري التحميل' },

      // Main titles
      'title': { en: 'Manage company employees', ar: 'إدارة الفريق' },
      'subtitle': { en: 'View and manage your team members', ar: 'عرض وإدارة أعضاء فريقك' },

      // Actions
      'addEmployee': { en: 'Add Employee', ar: 'إضافة عضو فريق' },
      'activate': { en: 'Activate', ar: 'تفعيل' },
      'deactivate': { en: 'Deactivate', ar: 'إلغاء التفعيل' },
      'delete': { en: 'Delete', ar: 'حذف' },
      'cancel': { en: 'Cancel', ar: 'إلغاء' },
      'invite': { en: 'Invite', ar: 'دعوة' },
      'inviting': { en: 'Inviting...', ar: 'جاري الدعوة...' },

      // Table headers
      'insighter': { en: 'Insighter', ar: 'المستشار' },
      'email': { en: 'Email', ar: 'البريد الإلكتروني' },
      'country': { en: 'Country', ar: 'البلد' },
      'status': { en: 'Status', ar: 'الحالة' },
      'actions': { en: 'Actions', ar: 'الإجراءات' },

      // Status
      'active': { en: 'Active', ar: 'نشط' },
      'inactive': { en: 'Inactive', ar: 'غير نشط' },
      'verified': { en: 'Verified', ar: 'موثق' },
      'pending': { en: 'Pending', ar: 'في الانتظار' },
      'currentUser': { en: 'Current User', ar: 'المستخدم الحالي' },

      // Forms
      'emailAddress': { en: 'Email Address', ar: 'عنوان البريد الإلكتروني' },
      'enterEmail': { en: 'Enter email address', ar: 'الرجاء إدخال عنوان البريد الإلكتروني للموظف' },
      'firstName': { en: 'First Name', ar: 'الاسم الأول' },
      'lastName': { en: 'Last Name', ar: 'الاسم الأخير' },
      'enterFirstName': { en: 'Enter first name', ar: 'أدخل الاسم الأول' },
      'enterLastName': { en: 'Enter last name', ar: 'أدخل الاسم الأخير' },
      'selectCountry': { en: 'Select country', ar: 'اختر البلد' },
      'searchCountries': { en: 'Search countries', ar: 'البحث في البلدان' },

      // Validation
      'emailRequired': { en: 'Email address is required', ar: 'عنوان البريد الإلكتروني مطلوب' },
      'emailInvalid': { en: 'Please enter a valid email address', ar: 'يرجى إدخال عنوان بريد إلكتروني صحيح' },
      'firstNameRequired': { en: 'First name is required', ar: 'الاسم الأول مطلوب' },
      'lastNameRequired': { en: 'Last name is required', ar: 'الاسم الأخير مطلوب' },
      'countryRequired': { en: 'Country selection is required', ar: 'اختيار البلد مطلوب' },

      // Empty states
      'emptyStateMessage': { en: 'Start building your team by adding employees', ar: 'ابدأ في بناء فريقك عن طريق إضافة الموظفين' },
      'noEmployees': { en: 'No employees found', ar: 'لم يتم العثور على موظفين' },
      'checkingAccount': { en: 'Checking account...', ar: 'جاري فحص الحساب...' },

      // Statistics
      'total': { en: 'Total', ar: 'المجموع' },
      'publishedKnowledge': { en: 'Published Knowledge', ar: 'المنشورات' },
      'publishedKnowledgeByInsighter': { en: 'Knowledge by Insighter', ar: "التصنيف حسب الإنسايتر" },
      'knowledgeOrders': { en: 'Knowledge Orders', ar: 'طلبات المعرفة' },
      'meetingBookings': { en: 'Session Bookings', ar: 'حجوزات الجلسات الاستشارية' },
      'meetingOrders': { en: 'Session Orders', ar: 'طلبات الجلسات الاستشارية' },
      'totalMeetings': { en: 'Total Sessions', ar: 'إجمالي الجلسات الاستشارية' },
      'totalPublished': { en: 'Total Published', ar: 'إجمالي المنشورات' },
      'ordersAmount': { en: 'Orders Amount', ar: 'مبلغ الطلبات' },
      'companyNetShare': { en: 'Company Net Share', ar: 'حصة الشركة الصافية' }
    };

    const translation = translations[key];
    if (translation) {
      return translation[this.lang as keyof typeof translation] || translation.en;
    }
    return key;
  }

}
