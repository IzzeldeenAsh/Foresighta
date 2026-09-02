import { Component, OnInit, signal, computed, inject, Injector, HostListener, OnDestroy, Input } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';
import { BaseComponent } from 'src/app/modules/base.component';
import { Observable, Subject, Subscription, of } from 'rxjs';
import { takeUntil, map, catchError, finalize } from 'rxjs/operators';
import { Router, NavigationEnd } from '@angular/router';
import { ConsultingScheduleService, DayAvailability, AvailabilityException, TimeSlot } from 'src/app/services/consulting-schedule.service';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';

@Component({
  selector: 'app-consulting-schedule',
  templateUrl: './consulting-schedule.component.html',
  styleUrls: ['./consulting-schedule.component.scss'],
  providers: [ConfirmationService]
})
export class ConsultingScheduleComponent extends BaseComponent implements OnInit, OnDestroy {

  /**
   * When true the component is rendered inside the become-Insighter onboarding
   * wizard: the top save toolbar is hidden and the wizard drives save via
   * saveForOnboarding().
   */
  @Input() embedded = false;

  // Signals
  loading = signal(false);
  saving = signal(false);
  availability = signal<DayAvailability[]>([]);
  availabilityObject = signal<{[key: string]: DayAvailability}>({});
  exceptions = signal<AvailabilityException[]>([]);
  formDirty = signal(false);

  // Index of the day currently being edited in the right-hand panel
  selectedDayIndex = signal(0);

  // For cleanup
  private destroy$ = new Subject<void>();
  private formSubscription: Subscription | null = null;
  private pendingNavigationObserver: { next: (value: boolean) => void; complete: () => void } | null = null;
  private suppressConfirmHide = false;

  // Form
  scheduleForm!: FormGroup;
  
  // Days of the week
  weekDays = [
    { key: 'monday', label: 'CONSULTING_SCHEDULE.DAYS.MONDAY' },
    { key: 'tuesday', label: 'CONSULTING_SCHEDULE.DAYS.TUESDAY' },
    { key: 'wednesday', label: 'CONSULTING_SCHEDULE.DAYS.WEDNESDAY' },
    { key: 'thursday', label: 'CONSULTING_SCHEDULE.DAYS.THURSDAY' },
    { key: 'friday', label: 'CONSULTING_SCHEDULE.DAYS.FRIDAY' },
    { key: 'saturday', label: 'CONSULTING_SCHEDULE.DAYS.SATURDAY' },
    { key: 'sunday', label: 'CONSULTING_SCHEDULE.DAYS.SUNDAY' }
  ];

  constructor(
    private fb: FormBuilder,
    private consultingScheduleService: ConsultingScheduleService,
    private profileService: ProfileService,
    private router: Router,
    private confirmationService: ConfirmationService,
    injector: Injector,
  ) {
    super(injector);
    this.initializeForm();
  }

  // RTL support method
  isRtl(): boolean {
    return document.documentElement.getAttribute('dir') === 'rtl';
  }

  // Custom validator for time slots - ensures minutes match and exactly 60 minutes span between start and end times
  private perfectHourValidator(control: AbstractControl): ValidationErrors | null {
    const group = control as FormGroup;
    const startTime = group.get('start_time')?.value;
    const endTime = group.get('end_time')?.value;

    if (!startTime || !endTime) {
      return null; // Let required validators handle empty values
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    // Check if end time minutes match start time minutes
    if (startDate.getMinutes() !== endDate.getMinutes()) {
      return { 'perfectHour': { 
        message: 'Start time and end time minutes must match',
        startMinutes: startDate.getMinutes(),
        endMinutes: endDate.getMinutes()
      }};
    }
    
    // Check if end time is after start time
    if (endDate <= startDate) {
      return { 'invalidTimeRange': { 
        message: 'End time must be after start time'
      }};
    }
    
    // Check if the time span is exactly 60 minutes (1 hour)
    const timeDiffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (timeDiffMinutes !== 60) {
      return { 'perfectHour': {
        message: this.lang === 'ar' ? 'يجب أن تكون المدة الزمنية ساعة واحدة بالضبط' : 'Time span must be exactly 60 minutes (1 hour)',
        timeDiffMinutes: timeDiffMinutes
      }};
    }

    return null;
  }

  // Synchronize end time minutes with start time minutes
  synchronizeEndTimeMinutes(control: FormGroup): void {
    const startTimeControl = control.get('start_time');
    const endTimeControl = control.get('end_time');
    
    if (!startTimeControl || !endTimeControl || !startTimeControl.value) return;
    
    const startDate = new Date(startTimeControl.value);
    let endDate = endTimeControl.value ? new Date(endTimeControl.value) : new Date();
    
    // Set end time minutes to match start time minutes
    endDate.setMinutes(startDate.getMinutes());
    
    // If end time is now before or equal to start time, add one hour
    if (endDate <= startDate) {
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
    }
    
    // Update end time value
    endTimeControl.setValue(endDate);
  }

  // Validator to detect duplicate time slots within the same day
  private duplicateTimeSlotsValidator(control: AbstractControl): ValidationErrors | null {
    const dayGroup = control as FormGroup;
    const timesArray = dayGroup.get('times') as FormArray | null;
    if (!timesArray) return null;

    const keyToIndices: { [key: string]: number[] } = {};

    // Build keys and track indices
    timesArray.controls.forEach((ctrl, index) => {
      const group = ctrl as FormGroup;
      const start = group.get('start_time')?.value;
      const end = group.get('end_time')?.value;

      // Skip incomplete items
      if (!start || !end) {
        // Also clear duplicate error if present
        const existing = group.errors || {};
        if (existing['duplicateTimeSlot']) {
          delete existing['duplicateTimeSlot'];
          group.setErrors(Object.keys(existing).length ? existing : null);
        }
        return;
      }

      const startStr = this.formatTimeString(start);
      const endStr = this.formatTimeString(end);
      const key = `${startStr}_${endStr}`;

      if (!keyToIndices[key]) keyToIndices[key] = [];
      keyToIndices[key].push(index);
    });

    // Clear all duplicate flags initially
    timesArray.controls.forEach(ctrl => {
      const group = ctrl as FormGroup;
      const existing = group.errors || {};
      if (existing['duplicateTimeSlot']) {
        delete existing['duplicateTimeSlot'];
        group.setErrors(Object.keys(existing).length ? existing : null);
      }
    });

    // Mark duplicates (all but first occurrence)
    let hasDuplicates = false;
    Object.keys(keyToIndices).forEach(key => {
      const indices = keyToIndices[key];
      if (indices.length > 1) {
        hasDuplicates = true;
        for (let i = 1; i < indices.length; i++) {
          const duplicateGroup = timesArray.at(indices[i]) as FormGroup;
          const existing = duplicateGroup.errors || {};
          existing['duplicateTimeSlot'] = true;
          duplicateGroup.setErrors(existing);
        }
      }
    });

    return hasDuplicates ? { duplicateTimeSlots: true } : null;
  }

  ngOnInit(): void {
    this.initializeWithDefaultDays();
    this.loadScheduleData();
    // Remove setupFormChangeTracking from here - it will be called after form is built
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    if (this.formSubscription) {
      this.formSubscription.unsubscribe();
    }
  }

  // Track form changes to detect if there are unsaved changes
  private setupFormChangeTracking(): void {
    // Clean up existing subscription if it exists
    if (this.formSubscription) {
      this.formSubscription.unsubscribe();
    }
    
    this.formSubscription = this.scheduleForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.formDirty()) {
          this.formDirty.set(true);
        }
      });
  }

  // Check if can deactivate component (used by Angular's guard)
  canDeactivate(): boolean | Observable<boolean> {
    if (this.formDirty()) {
      // Return an observable that resolves when the user makes a choice
      return new Observable<boolean>(observer => {
        this.pendingNavigationObserver = observer;
        this.confirmationService.confirm({
          header: this.lang === 'ar' ? 'تغييرات غير محفوظة' : 'Unsaved Changes',
          message: this.lang === 'ar' 
            ? 'لديك تغييرات غير محفوظة. هل تريد حفظ التغييرات أم المتابعة بدون حفظ؟' 
            : 'You have unsaved changes. Do you want to save the changes or continue without saving?',
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: this.lang === 'ar' ? 'حفظ والمتابعة' : 'Save and continue',
          rejectLabel: this.lang === 'ar' ? 'تجاهل' : 'Discard',
          accept: () => {
            // Accept = Save then continue navigating
            this.suppressConfirmHide = true;
            this.removeDuplicateExceptions(); // ensure clean state
            this.saveChangesForNavigation().subscribe((ok) => {
              observer.next(ok);
              observer.complete();
              this.pendingNavigationObserver = null;
            });
          },
          reject: () => {
            // Reject = Discard changes and continue navigating
            this.suppressConfirmHide = true;
            observer.next(true);
            observer.complete();
            this.pendingNavigationObserver = null;
          }
        });
      });
    }
    return true; // No unsaved changes, allow navigation
  }
  
  // Handle closing the dialog via (X) to stay on page
  onConfirmDialogHide(): void {
    if (this.suppressConfirmHide) {
      // Reset suppression for subsequent dialogs
      this.suppressConfirmHide = false;
      return;
    }
    if (this.pendingNavigationObserver) {
      this.pendingNavigationObserver.next(false);
      this.pendingNavigationObserver.complete();
      this.pendingNavigationObserver = null;
    }
  }

  // Browser beforeunload event handler for page refresh/close
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.formDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // Limit a meeting rate to the maximum accepted by this form.
  limitRateValue(
    dayIndex: number,
    timeIndex: number,
    controlName: 'rate' | 'rate_physical',
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    let value = parseInt(input.value, 10);
    
    // Check if value exceeds maximum
    if (value > 10000) {
      // Limit to 10000
      value = 10000;
      
      // Update input field value
      input.value = value.toString();
      
      // Update form control value
      const dayGroup = this.availabilityFormArray.at(dayIndex) as FormGroup;
      const timesArray = dayGroup.get('times') as FormArray;
      const timeGroup = timesArray.at(timeIndex) as FormGroup;
      timeGroup.get(controlName)?.setValue(value, { emitEvent: false });
    }
  }



  private initializeForm(): void {
    this.scheduleForm = this.fb.group({
      availability: this.fb.array([]),
      exceptions: this.fb.array([], { validators: this.duplicateExceptionValidator.bind(this) }),
      default_physical_location: ['']
    }, { validators: this.physicalLocationRequiredValidator.bind(this) });
  }

  // True when any active day has a time slot that offers an on-site (physical) place.
  // Drives has_physical_service and the visibility/requirement of the physical location field.
  get hasPhysicalService(): boolean {
    return this.computeHasPhysicalService(this.availabilityFormArray);
  }

  get activeDaysCount(): number {
    if (!this.availabilityFormArray) {
      return 0;
    }

    return this.availabilityFormArray.controls.filter(
      day => day.get('active')?.value
    ).length;
  }

  // The day group currently shown in the editor panel
  get selectedDayGroup(): FormGroup | null {
    const arr = this.availabilityFormArray;
    if (!arr || arr.length === 0) return null;
    return arr.at(this.selectedDayIndex()) as FormGroup;
  }

  selectDay(index: number): void {
    this.selectedDayIndex.set(index);
  }

  isDayActive(index: number): boolean {
    return !!(this.availabilityFormArray?.at(index) as FormGroup)?.get('active')?.value;
  }

  getDaySlotCount(index: number): number {
    const dayGroup = this.availabilityFormArray?.at(index) as FormGroup;
    const times = dayGroup?.get('times') as FormArray;
    return times ? times.length : 0;
  }

  // Short "$50" / "$50–56" summary of the rates offered on a day (empty when off)
  getDayRateSummary(index: number): string {
    const dayGroup = this.availabilityFormArray?.at(index) as FormGroup;
    if (!dayGroup?.get('active')?.value) return '';
    const times = dayGroup.get('times') as FormArray;
    if (!times || times.length === 0) return '';

    const rates: number[] = [];
    times.controls.forEach(ctrl => {
      const slot = ctrl as FormGroup;
      if (slot.get('online')?.value) {
        const r = Number(slot.get('rate')?.value);
        if (Number.isFinite(r) && r > 0) rates.push(r);
      }
      if (slot.get('on_site')?.value) {
        const r = Number(slot.get('rate_physical')?.value);
        if (Number.isFinite(r) && r > 0) rates.push(r);
      }
    });

    if (rates.length === 0) return '';
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    return min === max ? `$${min}` : `$${min}–${max}`;
  }

  private computeHasPhysicalService(availability: FormArray | null | undefined): boolean {
    if (!availability) {
      return false;
    }
    for (let i = 0; i < availability.length; i++) {
      const dayGroup = availability.at(i) as FormGroup;
      if (!dayGroup.get('active')?.value) {
        continue;
      }
      const timesArray = dayGroup.get('times') as FormArray;
      for (let j = 0; j < timesArray.length; j++) {
        const timeGroup = timesArray.at(j) as FormGroup;
        if (timeGroup.get('on_site')?.value) {
          return true;
        }
      }
    }
    return false;
  }

  // Form-level validator: default_physical_location is required when any slot is on-site.
  // Reads the availability array from the passed control so it is safe to run during
  // form construction (before this.scheduleForm is assigned).
  private physicalLocationRequiredValidator(control: AbstractControl): ValidationErrors | null {
    const group = control as FormGroup;
    const availability = group.get('availability') as FormArray | null;
    const location = (group.get('default_physical_location')?.value || '').toString().trim();
    if (this.computeHasPhysicalService(availability) && !location) {
      return { physicalLocationRequired: true };
    }
    return null;
  }

  // Per-slot validator: at least one of Online / On Site must be selected.
  private atLeastOnePlaceValidator(control: AbstractControl): ValidationErrors | null {
    const group = control as FormGroup;
    const online = group.get('online')?.value;
    const onSite = group.get('on_site')?.value;
    if (!online && !onSite) {
      return { placeRequired: true };
    }
    return null;
  }

  // Require the price that corresponds to every selected meeting type.
  private meetingRatesValidator(control: AbstractControl): ValidationErrors | null {
    const group = control as FormGroup;
    const online = group.get('online')?.value;
    const onSite = group.get('on_site')?.value;
    const onlineRate = Number(group.get('rate')?.value);
    const physicalRate = Number(group.get('rate_physical')?.value);
    const errors: ValidationErrors = {};

    if (online && (!Number.isFinite(onlineRate) || onlineRate < 10)) {
      errors['onlineRateMin'] = true;
    }

    if (onSite && (!Number.isFinite(physicalRate) || physicalRate < 10)) {
      errors['physicalRateMin'] = true;
    }

    return Object.keys(errors).length ? errors : null;
  }
  
  // Custom validator to check for duplicate exceptions on the same date and time
  private duplicateExceptionValidator(control: AbstractControl): ValidationErrors | null {
    const exceptions = control as FormArray;
    
    if (!exceptions || exceptions.length === 0) {
      return null; // No validation needed if no exceptions
    }
    
    const duplicates: { [key: string]: number[] } = {};
    const existingExceptionsKeys = new Set<string>();
    
    // First, create keys for all existing exceptions from backend
    const existingExceptions = this.exceptions();
    
    for (const existingException of existingExceptions) {
      const dateStr = typeof existingException.exception_date === 'string' 
        ? existingException.exception_date.split('T')[0]
        : '';
        
      const startTimeStr = existingException.start_time;
      const endTimeStr = existingException.end_time;
      const key = `${dateStr}_${startTimeStr}_${endTimeStr}`;
      existingExceptionsKeys.add(key);
    }
    
    // Check for duplicates within form exceptions and against backend exceptions (for new exceptions only)
    for (let i = 0; i < exceptions.length; i++) {
      const exceptionGroup = exceptions.at(i) as FormGroup;
      
      const exceptionDate = exceptionGroup.get('exception_date')?.value;
      const startTime = exceptionGroup.get('start_time')?.value;
      const endTime = exceptionGroup.get('end_time')?.value;
      const isNew = exceptionGroup.get('isNew')?.value;
      
      // Skip invalid or incomplete entries
      if (!exceptionDate || !startTime || !endTime) {
        continue;
      }
      
      // Create a unique key based on date and times
      // Use local timezone date instead of UTC to avoid timezone issues
      const dateStr = exceptionDate instanceof Date 
        ? `${exceptionDate.getFullYear()}-${String(exceptionDate.getMonth() + 1).padStart(2, '0')}-${String(exceptionDate.getDate()).padStart(2, '0')}`
        : typeof exceptionDate === 'string' 
          ? exceptionDate.split('T')[0]
          : '';
          
      const startTimeStr = startTime instanceof Date
        ? `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`
        : '';
        
      const endTimeStr = endTime instanceof Date
        ? `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`
        : '';
        
      const key = `${dateStr}_${startTimeStr}_${endTimeStr}`;
      
      // Only check new exceptions against backend exceptions
      if (isNew && existingExceptionsKeys.has(key)) {
        // Mark this form exception as duplicate with existing backend data
        const exceptionGroup = exceptions.at(i) as FormGroup;
        exceptionGroup.setErrors({ duplicateException: true });
        return { duplicateExceptions: { [i]: { duplicateException: true } } };
      }
      
      if (!duplicates[key]) {
        duplicates[key] = [];
      }
      
      duplicates[key].push(i);
    }
    
    // Find duplicates within form exceptions
    const errors: { [index: number]: { duplicateException: true } } = {};
    let hasDuplicates = false;
    
    for (const key in duplicates) {
      if (duplicates[key].length > 1) {
        // Mark all duplicates after the first one
        for (let i = 1; i < duplicates[key].length; i++) {
          const index = duplicates[key][i];
          errors[index] = { duplicateException: true };
          
          // Set the error on the form group for this exception
          const exceptionGroup = exceptions.at(index) as FormGroup;
          exceptionGroup.setErrors({ duplicateException: true });
          
          hasDuplicates = true;
        }
      }
    }
    
    return hasDuplicates ? { duplicateExceptions: errors } : null;
  }

  get availabilityFormArray(): FormArray {
    return this.scheduleForm?.get('availability') as FormArray;
  }

  get exceptionsFormArray(): FormArray {
    return this.scheduleForm.get('exceptions') as FormArray;
  }

  private loadScheduleData(): void {
    this.loading.set(true);
    
    this.consultingScheduleService.getScheduleAvailability().subscribe({
      next: (response) => {
        // Check if response.data.availability is an array or an object
        if (Array.isArray(response.data.availability)) {
          this.availability.set(response.data.availability);
        } else {
          // If it's an object, convert it to an array for backward compatibility
          this.availabilityObject.set(response.data.availability);
          const availabilityArray: DayAvailability[] = this.convertAvailabilityObjectToArray(response.data.availability);
          this.availability.set(availabilityArray);
        }
        
        // Debug log to check what we're getting from the API
        console.log('API Response:', response);
        console.log('Availability exceptions:', response.data.availability_exceptions);
        
        this.exceptions.set(response.data.availability_exceptions || []);
        this.scheduleForm.get('default_physical_location')?.setValue(
          response.data.default_physical_location || '',
          { emitEvent: false }
        );
        this.buildForm();
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading schedule:', error);
        // Don't show error message, just use default data
        // this.messageService.add({
        //   severity: 'error',
        //   summary: 'Error',
        //   detail: 'Failed to load schedule data'
        // });
        this.loading.set(false);
      }
    });
  }
  
  /**
   * Converts the availability object format to an array format
   * @param availabilityObj The availability object with days as keys
   * @returns Array of day availability objects
   */
  private convertAvailabilityObjectToArray(availabilityObj: {[key: string]: DayAvailability}): DayAvailability[] {
    if (!availabilityObj) return [];
    
    // Create an array matching the weekDays order
    const result: DayAvailability[] = this.weekDays.map(dayConfig => {
      const dayKey = dayConfig.key;
      const dayData = availabilityObj[dayKey] || { day: dayKey, active: false, times: [] };
      
      return {
        day: dayKey,
        active: dayData.active,
        times: dayData.times || []
      };
    });
    
    return result;
  }

  private buildForm(): void {
    // Clear existing form arrays
    this.availabilityFormArray.clear();
    this.exceptionsFormArray.clear();

    // Build availability form controls
    this.availability().forEach(day => {
      const dayGroup = this.createDayFormGroup(day);
      this.availabilityFormArray.push(dayGroup);
    });

    // Build exceptions form controls
    this.exceptions().forEach(exception => {
      const exceptionGroup = this.createExceptionFormGroup(exception);
      this.exceptionsFormArray.push(exceptionGroup);
    });

    // Default the editor to the first active day (or Monday when all are off)
    const firstActive = this.availabilityFormArray.controls.findIndex(
      day => day.get('active')?.value
    );
    this.selectedDayIndex.set(firstActive >= 0 ? firstActive : 0);

    // Setup form change tracking after form is built and populated
    // Reset the formDirty flag first to prevent false positives
    this.formDirty.set(false);
    this.setupFormChangeTracking();
  }

  private createDayFormGroup(day: DayAvailability): FormGroup {
    const timesArray = this.fb.array(
      day.times.map(time => this.createTimeSlotFormGroup(time))
    );

    // Keep a useful starter slot visible for days that have not been enabled yet.
    // Inactive days are not sent with time slots, so this remains a UI default until enabled.
    if (timesArray.length === 0) {
      timesArray.push(this.createDefaultTimeSlot());
    }

    return this.fb.group({
      day: [day.day],
      active: [day.active],
      times: timesArray
    }, { validators: this.duplicateTimeSlotsValidator.bind(this) });
  }

  private createTimeSlotFormGroup(timeSlot: TimeSlot): FormGroup {
    const place = timeSlot.place || 'online';
    const group = this.fb.group({
      start_time: [this.parseTimeString(timeSlot.start_time), Validators.required],
      end_time: [this.parseTimeString(timeSlot.end_time), Validators.required],
      rate: [timeSlot.rate ?? 10],
      rate_physical: [timeSlot.rate_physical ?? 50],
      online: [place === 'online' || place === 'both'],
      on_site: [place === 'physically' || place === 'both']
    }, {
      validators: [
        this.perfectHourValidator.bind(this),
        this.atLeastOnePlaceValidator.bind(this),
        this.meetingRatesValidator.bind(this)
      ]
    });
    
    // Add subscription to start_time changes to synchronize end_time minutes
    const startTimeControl = group.get('start_time');
    startTimeControl?.valueChanges.subscribe(() => {
      this.synchronizeEndTimeMinutes(group);
    });
    
    return group;
  }

  private createDefaultTimeSlot(): FormGroup {
    return this.createTimeSlotFormGroup({
      start_time: '09:00',
      end_time: '10:00',
      rate: 10,
      rate_physical: 50,
      place: 'online'
    });
  }

  private createExceptionFormGroup(exception: AvailabilityException, isNewException: boolean = false): FormGroup {
    // Parse the exception date - handle both string date and ISO date format
    let parsedDate = null;
    if (exception.exception_date) {
      if (typeof exception.exception_date === 'string') {
        // Handle ISO date format or date string
        parsedDate = new Date(exception.exception_date);
      } else {
        parsedDate = exception.exception_date;
      }
    }

    const group = this.fb.group({
      exception_date: [parsedDate, Validators.required],
      start_time: [this.parseTimeString(exception.start_time), Validators.required],
      end_time: [this.parseTimeString(exception.end_time), Validators.required],
      rate: [0], // Default to 0 as it's hidden in UI
      isNew: [isNewException] // Track if this is a new exception
    }, { validators: this.perfectHourValidator.bind(this) });
    
    // Add subscription to start_time changes to synchronize end_time minutes
    const startTimeControl = group.get('start_time');
    startTimeControl?.valueChanges.subscribe(() => {
      this.synchronizeEndTimeMinutes(group);
    });
    
    return group;
  }

  // Helper method to parse time string to Date object for PrimeNG Calendar
  private parseTimeString(timeString: string): Date | null {
    if (!timeString) return null;
    
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    return date;
  }

  // Helper method to convert Date object to time string (HH:MM format)
  private formatTimeString(date: Date | string): string {
    if (!date) return '';
    
    if (typeof date === 'string') return date;
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Helper method to split time range into hourly slots
  private splitTimeRangeIntoHours(startTime: string, endTime: string): TimeSlot[] {
    const slots: TimeSlot[] = [];
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startDate = new Date();
    startDate.setHours(startHour, startMinute, 0, 0);
    
    const endDate = new Date();
    endDate.setHours(endHour, endMinute, 0, 0);
    
    const current = new Date(startDate);
    
    while (current < endDate) {
      const slotStart = this.formatTimeString(current);
      
      // Move to next hour
      current.setHours(current.getHours() + 1);
      
      // Don't exceed the end time
      const slotEnd = current > endDate ? this.formatTimeString(endDate) : this.formatTimeString(current);
      
      if (slotStart !== slotEnd) {
        slots.push({
          start_time: slotStart,
          end_time: slotEnd,
          rate: 0 // Will be set from the form data
        });
      }
    }
    
    return slots;
  }

  // Day availability methods
  onDayToggle(dayIndex: number): void {
    // Bring the toggled day into the editor
    this.selectedDayIndex.set(dayIndex);

    const dayGroup = this.availabilityFormArray.at(dayIndex) as FormGroup;
    const isActive = dayGroup.get('active')?.value;
    const timesArray = dayGroup.get('times') as FormArray;
    
    // Keep a day's values when it is turned off, so enabling it again restores
    // the schedule the user last configured.
    if (isActive && timesArray.length === 0) {
      timesArray.push(this.createDefaultTimeSlot());
    }
  }

  toggleSelectedDay(): void {
    const dayIndex = this.selectedDayIndex();
    const activeControl = this.availabilityFormArray.at(dayIndex).get('active');

    activeControl?.setValue(!activeControl.value);
    activeControl?.markAsDirty();
    this.onDayToggle(dayIndex);
  }

  toggleSlotPlace(dayIndex: number, timeIndex: number, controlName: 'online' | 'on_site'): void {
    const timeSlot = this.getTimesFormArray(dayIndex).at(timeIndex) as FormGroup;
    const otherControlName = controlName === 'online' ? 'on_site' : 'online';
    const currentValue = timeSlot.get(controlName)?.value;
    const otherValue = timeSlot.get(otherControlName)?.value;

    // Keep at least one place selected per time slot
    if (currentValue && !otherValue) {
      return;
    }

    timeSlot.get(controlName)?.setValue(!currentValue);
    timeSlot.markAsDirty();
    this.scheduleForm.updateValueAndValidity();
  }

  addTimeSlot(dayIndex: number): void {
    const dayGroup = this.availabilityFormArray.at(dayIndex) as FormGroup;
    const timesArray = dayGroup.get('times') as FormArray;
    
    let startTime = '09:00';
    let endTime = '10:00';
    let rate = 10; // Default rate if no previous time slot exists
    let physicalRate = 50;
    let place: TimeSlot['place'] = 'online';
    
    // If there are existing time slots, use the end time of the last one as the start time
    // and also get the last entered rate value
    if (timesArray.length > 0) {
      const lastTimeSlot = timesArray.at(timesArray.length - 1) as FormGroup;
      const lastEndTime = lastTimeSlot.get('end_time')?.value;
      const lastRate = lastTimeSlot.get('rate')?.value;
      const lastPhysicalRate = lastTimeSlot.get('rate_physical')?.value;
      const lastOnline = lastTimeSlot.get('online')?.value;
      const lastOnSite = lastTimeSlot.get('on_site')?.value;

      place = lastOnline && lastOnSite
        ? 'both'
        : lastOnSite
          ? 'physically'
          : 'online';
      
      if (lastEndTime) {
        // Use the last end time as the new start time
        startTime = this.formatTimeString(lastEndTime);
        
        // Calculate the new end time (one hour later)
        const startDate = new Date(lastEndTime);
        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
        endTime = this.formatTimeString(endDate);
      }
      
      // Use the last rate value if available
      if (lastRate !== undefined && lastRate !== null) {
        rate = Math.max(lastRate, 10);
      }

      if (lastPhysicalRate !== undefined && lastPhysicalRate !== null) {
        physicalRate = Math.max(lastPhysicalRate, 10);
      }
    }
    
    const newTimeSlot = this.createTimeSlotFormGroup({
      start_time: startTime,
      end_time: endTime,
      rate,
      rate_physical: physicalRate,
      place
    });
    timesArray.push(newTimeSlot);
  }

  removeTimeSlot(dayIndex: number, timeIndex: number): void {
    const dayGroup = this.availabilityFormArray.at(dayIndex) as FormGroup;
    const timesArray = dayGroup.get('times') as FormArray;

    if (timesArray.length === 1) {
      dayGroup.get('active')?.setValue(false);
      return;
    }

    timesArray.removeAt(timeIndex);
  }

  /**
   * Format rate value to remove unnecessary leading zeros
   * @param dayIndex - Index of the day in the availability array
   * @param timeIndex - Index of the time slot in the times array
   */
  formatRateValue(dayIndex: number, timeIndex: number): void {
    const dayGroup = this.availabilityFormArray.at(dayIndex) as FormGroup;
    const timesArray = dayGroup.get('times') as FormArray;
    const timeSlot = timesArray.at(timeIndex) as FormGroup;
    const rateControl = timeSlot.get('rate');
    
    if (rateControl && rateControl.value !== null && rateControl.value !== undefined) {
      // Parse as float and then format back to string to remove leading zeros
      const parsedValue = parseFloat(rateControl.value);
      
      // Only update if it's a valid number
      if (!isNaN(parsedValue)) {
        // Format the number without unnecessary leading zeros
        rateControl.setValue(parsedValue, { emitEvent: false });
      }
    }
  }

  /**
   * Format rate value on input to immediately remove leading zeros as the user types
   * @param dayIndex - Index of the day in the availability array
   * @param timeIndex - Index of the time slot in the times array
   * @param event - Input event from the rate field
   */
  formatRateValueOnInput(dayIndex: number, timeIndex: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // If the input starts with a '0' followed by a non-decimal digit, remove the leading zero
    if (value.match(/^0[1-9]/)) {
      // Get the form control and update it
      const dayGroup = this.availabilityFormArray.at(dayIndex) as FormGroup;
      const timesArray = dayGroup.get('times') as FormArray;
      const timeSlot = timesArray.at(timeIndex) as FormGroup;
      const rateControl = timeSlot.get('rate');
      
      if (rateControl) {
        // Remove the leading zero and set the value
        const newValue = parseFloat(value);
        rateControl.setValue(newValue, { emitEvent: true });
        
        // This ensures the cursor position is maintained after the update
        setTimeout(() => {
          input.setSelectionRange(input.value.length, input.value.length);
        }, 0);
      }
    }
  }

  getTimesFormArray(dayIndex: number): FormArray {
    const dayGroup = this.availabilityFormArray.at(dayIndex) as FormGroup;
    return dayGroup.get('times') as FormArray;
  }

  // Check if a new exception would conflict with existing backend exceptions
  private checkNewExceptionAgainstBackend(exceptionDate: Date | string, startTime: Date | string, endTime: Date | string): boolean {
    const existingExceptions = this.exceptions();
    
    // Create key for the new exception
    // Use local timezone date instead of UTC to avoid timezone issues
    const dateStr = exceptionDate instanceof Date 
      ? `${exceptionDate.getFullYear()}-${String(exceptionDate.getMonth() + 1).padStart(2, '0')}-${String(exceptionDate.getDate()).padStart(2, '0')}`
      : typeof exceptionDate === 'string' 
        ? exceptionDate.split('T')[0]
        : '';
        
    const startTimeStr = startTime instanceof Date
      ? `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`
      : typeof startTime === 'string' ? startTime : '';
      
    const endTimeStr = endTime instanceof Date
      ? `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`
      : typeof endTime === 'string' ? endTime : '';
      
    const newKey = `${dateStr}_${startTimeStr}_${endTimeStr}`;
    
    // Check against existing backend exceptions
    for (const existingException of existingExceptions) {
      const existingDateStr = typeof existingException.exception_date === 'string' 
        ? existingException.exception_date.split('T')[0]
        : '';
        
      const existingStartTimeStr = existingException.start_time;
      const existingEndTimeStr = existingException.end_time;
      const existingKey = `${existingDateStr}_${existingStartTimeStr}_${existingEndTimeStr}`;
      
      if (newKey === existingKey) {
        return true; // Conflict found
      }
    }
    
    return false; // No conflict
  }

  // Exception methods
  addException(): void {
    const newException = this.createExceptionFormGroup({
      exception_date: '',
      start_time: '09:00',
      end_time: '10:00',
      rate: 0 // Set rate to 0 by default for new exceptions
    }, true); // Mark as new exception
    this.exceptionsFormArray.push(newException);
  }

  removeException(index: number): void {
    this.exceptionsFormArray.removeAt(index);
  }

  // Remove duplicate exceptions from the form, keeping only the first occurrence
  // Priority: Keep existing backend exceptions, remove only new duplicates
  private removeDuplicateExceptions(): void {
    // First, manually run validation to ensure errors are up to date
    this.exceptionsFormArray.updateValueAndValidity();
    
    const duplicates: { [key: string]: number[] } = {};
    const indicesToRemove: number[] = [];
    const existingExceptionsKeys = new Set<string>();
    
    // First, create keys for all existing exceptions from backend
    const existingExceptions = this.exceptions();
    for (const existingException of existingExceptions) {
      const dateStr = typeof existingException.exception_date === 'string' 
        ? existingException.exception_date.split('T')[0]
        : '';
        
      const startTimeStr = existingException.start_time;
      const endTimeStr = existingException.end_time;
      const key = `${dateStr}_${startTimeStr}_${endTimeStr}`;
      existingExceptionsKeys.add(key);
    }
    
    // Find duplicates using the same logic as the validator
    for (let i = 0; i < this.exceptionsFormArray.length; i++) {
      const exceptionGroup = this.exceptionsFormArray.at(i) as FormGroup;
      
      const exceptionDate = exceptionGroup.get('exception_date')?.value;
      const startTime = exceptionGroup.get('start_time')?.value;
      const endTime = exceptionGroup.get('end_time')?.value;
      const isNew = exceptionGroup.get('isNew')?.value;
      
      // Skip invalid or incomplete entries
      if (!exceptionDate || !startTime || !endTime) {
        continue;
      }
      
      // Create a unique key based on date and times (same as validator)
      // Use local timezone date instead of UTC to avoid timezone issues
      const dateStr = exceptionDate instanceof Date 
        ? `${exceptionDate.getFullYear()}-${String(exceptionDate.getMonth() + 1).padStart(2, '0')}-${String(exceptionDate.getDate()).padStart(2, '0')}`
        : typeof exceptionDate === 'string' 
          ? exceptionDate.split('T')[0]
          : '';
          
      const startTimeStr = startTime instanceof Date
        ? `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`
        : '';
        
      const endTimeStr = endTime instanceof Date
        ? `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`
        : '';
        
      const key = `${dateStr}_${startTimeStr}_${endTimeStr}`;
      
      // If this is a NEW exception that duplicates backend data, remove it
      if (isNew && existingExceptionsKeys.has(key)) {
        indicesToRemove.push(i);
        continue;
      }
      
      if (!duplicates[key]) {
        duplicates[key] = [];
      }
      
      duplicates[key].push(i);
    }
    
    // Find indices to remove from form duplicates
    // Priority: Keep existing exceptions over new ones, then keep the first occurrence
    for (const key in duplicates) {
      if (duplicates[key].length > 1) {
        const indices = duplicates[key];
        
        // Separate existing vs new exceptions
        const existingIndices: number[] = [];
        const newIndices: number[] = [];
        
        indices.forEach(index => {
          const exceptionGroup = this.exceptionsFormArray.at(index) as FormGroup;
          const isNew = exceptionGroup.get('isNew')?.value;
          
          if (isNew) {
            newIndices.push(index);
          } else {
            existingIndices.push(index);
          }
        });
        
        // If we have existing exceptions, remove all new ones for this key
        if (existingIndices.length > 0) {
          indicesToRemove.push(...newIndices);
          
          // If there are multiple existing exceptions (shouldn't happen but just in case),
          // keep only the first existing one
          if (existingIndices.length > 1) {
            for (let i = 1; i < existingIndices.length; i++) {
              indicesToRemove.push(existingIndices[i]);
            }
          }
        } else {
          // All are new exceptions, keep the first one, remove the rest
          for (let i = 1; i < newIndices.length; i++) {
            indicesToRemove.push(newIndices[i]);
          }
        }
      }
    }
    
    // Sort in descending order to maintain correct indices during removal
    indicesToRemove.sort((a, b) => b - a);
    
    // Remove the duplicates
    indicesToRemove.forEach(index => {
      this.exceptionsFormArray.removeAt(index);
    });
    
    console.log(`Removed ${indicesToRemove.length} duplicate exceptions`);
  }

  // Save method
  onSave(): void {
    // Remove duplicates before validation and saving
    this.removeDuplicateExceptions();
    
    if (this.scheduleForm.valid) {
      this.saving.set(true);
      
      const formValue = this.scheduleForm.value;
      const processedData = this.processFormData(formValue);
      
      this.consultingScheduleService.updateScheduleAvailability(processedData).subscribe({
        next: (response) => {
          if(this.lang === 'en'){
            this.showSuccess('Success','Schedule updated successfully');
          }else{
            this.showSuccess('Success','تم تحديث الجدول بنجاح');
          }
          
          this.formDirty.set(false); // Reset dirty flag after successful save
          this.refreshProfile();
          this.saving.set(false);
        },
        error: (error) => {
          console.error('Error saving schedule:', error);
          this.handleServerErrors(error);
          this.saving.set(false);
        }
      });
    } else {
      // Keep the button enabled: surface the errors by marking fields touched & dirty
      this.scheduleForm.markAllAsTouched();
      this.markAllAsDirty(this.scheduleForm);
      if(this.lang === 'en'){
        this.showError('Error','Please fill in all required fields');
      }else{
        this.showError('يرجى إدخال جميع الحقول المطلوبة');
      }
    }
  }

  // Recursively mark every control dirty so required-field messages appear on save
  private markAllAsDirty(control: AbstractControl): void {
    control.markAsDirty();
    const anyControl = control as any;
    if (anyControl.controls) {
      const children = anyControl.controls;
      if (Array.isArray(children)) {
        children.forEach((child: AbstractControl) => this.markAllAsDirty(child));
      } else {
        Object.keys(children).forEach(key => this.markAllAsDirty(children[key]));
      }
    }
  }

  // Save used by the onboarding wizard; returns whether the save succeeded so
  // the wizard can advance to the next step. Reuses the navigation-save logic.
  saveForOnboarding(): Observable<boolean> {
    this.removeDuplicateExceptions();
    return this.saveChangesForNavigation();
  }

  // Save used by navigation guard; returns whether navigation should proceed
  private saveChangesForNavigation(): Observable<boolean> {
    if (!this.scheduleForm.valid) {
      this.scheduleForm.markAllAsTouched();
      this.markAllAsDirty(this.scheduleForm);
      if(this.lang === 'en'){
        this.showError('Error','Please fill in all required fields');
      }else{
        this.showError('يرجى إدخال جميع الحقول المطلوبة');
      }
      return of(false);
    }
    
    this.saving.set(true);
    const formValue = this.scheduleForm.value;
    const processedData = this.processFormData(formValue);
    
    return this.consultingScheduleService.updateScheduleAvailability(processedData).pipe(
      map(() => {
        if(this.lang === 'en'){
          this.showSuccess('Success','Schedule updated successfully');
        }else{
          this.showSuccess('Success','تم تحديث الجدول بنجاح');
        }
        this.formDirty.set(false);
        this.refreshProfile();
        return true;
      }),
      catchError((error) => {
        console.error('Error saving schedule:', error);
        this.handleServerErrors(error);
        return of(false);
      }),
      finalize(() => {
        this.saving.set(false);
      })
    );
  }

  private refreshProfile(): void {
    const subscription = this.profileService.refreshProfile().subscribe({
      error: () => undefined,
    });

    this.unsubscribe.push(subscription);
  }

  // Handle server errors
  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          if (error.error.type === "warning") {
            this.showWarn('Error',messages.join(", "));
          } else if (Array.isArray(messages)) {
            this.showError('Error',messages.join(", "));
          } else {
            this.showError('Error',messages);
          }
        }
      }
    } else if (error.error && error.error.message) {
      // Handle single error message
      this.showError('Error',error.error.message);
    } else {
      // Fallback error message
      if(this.lang === 'en'){
        this.showError('Failed to save schedule');
      }else{
        this.showError('فشل تحديث الجدول');
      }
    }
  }

  // Process form data to convert dates to time strings and split into hourly slots
  private processFormData(formValue: any): any {
    const processedData: {
      availability: DayAvailability[],
      availability_exceptions: AvailabilityException[],
      has_physical_service?: boolean,
      default_physical_location?: string | null
    } = {
      availability: [],
      availability_exceptions: []
    };

    // Process availability - convert to array format expected by the API
    if (formValue.availability) {
      formValue.availability.forEach((day: any) => {
        // Create the day entry with its data
        const dayEntry: DayAvailability = {
          day: day.day,
          active: day.active,
          times: [] as TimeSlot[]
        };
        
        // Process times if the day is active and has time slots
        if (day.active && day.times && day.times.length > 0) {
          const processedTimes: TimeSlot[] = [];
          
          day.times.forEach((timeSlot: any) => {
            const startTime = this.formatTimeString(timeSlot.start_time);
            const endTime = this.formatTimeString(timeSlot.end_time);
            const rate = timeSlot.online ? (timeSlot.rate ?? 0) : 0;
            const physicalRate = timeSlot.on_site ? (timeSlot.rate_physical ?? 0) : 0;
            const place = timeSlot.online && timeSlot.on_site
              ? 'both'
              : timeSlot.on_site
                ? 'physically'
                : 'online';

            if (startTime && endTime) {
              // Add the time slot with rate and place
              processedTimes.push({
                start_time: startTime,
                end_time: endTime,
                rate: rate,
                rate_physical: physicalRate.toString(),
                place: place
              });
            }
          });

          dayEntry.times = processedTimes;
        }

        // Add to the availability array
        processedData.availability.push(dayEntry);
      });
    }

    // Derive insighter-level physical service flag + location from the slots' places
    const hasPhysicalService = processedData.availability.some(
      day => day.active && day.times.some(time => time.place === 'physically' || time.place === 'both')
    );
    processedData.has_physical_service = hasPhysicalService;
    processedData.default_physical_location = hasPhysicalService
      ? (formValue.default_physical_location || '').toString().trim()
      : null;

    // Process exceptions (duplicates already removed before calling this method)
    if (formValue.exceptions) {
      processedData.availability_exceptions = formValue.exceptions.map((exception: any) => {
        // Format the date as YYYY-MM-DD with no time component
        let formattedDate;
        if (exception.exception_date instanceof Date) {
          // Format date as YYYY-MM-DD
          const year = exception.exception_date.getFullYear();
          const month = String(exception.exception_date.getMonth() + 1).padStart(2, '0');
          const day = String(exception.exception_date.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
        } else {
          // If it's already a string, make sure it's just the date part
          formattedDate = typeof exception.exception_date === 'string' 
            ? exception.exception_date.split('T')[0] 
            : exception.exception_date;
        }
        
        // Do not include rate or isNew with exception days
        return {
          exception_date: formattedDate,
          start_time: this.formatTimeString(exception.start_time),
          end_time: this.formatTimeString(exception.end_time)
        };
      });
    }

    return processedData;
  }

  private initializeWithDefaultDays(): void {
    // Initialize with default days structure
    const defaultAvailability: DayAvailability[] = [
      { day: 'monday', active: false, times: [] },
      { day: 'tuesday', active: false, times: [] },
      { day: 'wednesday', active: false, times: [] },
      { day: 'thursday', active: false, times: [] },
      { day: 'friday', active: false, times: [] },
      { day: 'saturday', active: false, times: [] },
      { day: 'sunday', active: false, times: [] }
    ];
    
    this.availability.set(defaultAvailability);
    this.exceptions.set([]);
    this.buildForm();
  }
}
