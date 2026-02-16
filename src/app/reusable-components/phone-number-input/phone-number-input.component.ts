import { Component, Input, Output, EventEmitter, forwardRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface PhoneMaskConfig {
  mask: string;
  pattern: RegExp;
}

@Component({
  selector: 'app-phone-number-input',
  templateUrl: './phone-number-input.component.html',
  styleUrls: ['./phone-number-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneNumberInputComponent),
      multi: true
    }
  ]
})
export class PhoneNumberInputComponent implements ControlValueAccessor, OnInit, OnChanges {
  @Input() countries: any[] = [];
  @Input() placeholder: string = 'Your phone number';
  @Input() searchPlaceholder: string = 'Search countries...';
  @Input() lang: string = 'en';
  @Input() disabled: boolean = false;
  @Input() isRequired: boolean = false;
  @Input() showValidationErrors: boolean = true;
  @Input() countryCodeError: string = '';
  @Input() phoneNumberError: string = '';
  @Input() initialCountryCode: string = '';
  @Input() initialPhoneNumber: string = '';
  @Input() maxWidth: string = '100%';
  @Output() countryCodeChange = new EventEmitter<string>();
  @Output() phoneNumberChange = new EventEmitter<string>();
  @Output() formattedPhoneNumberChange = new EventEmitter<string>();
  @Output() flagError = new EventEmitter<any>();

  value: string = '';
  countryCode: string = '';
  currentMask: string = '000-000-0000';
  currentPlaceholder: string = '123-456-7890';
  
  private readonly phoneMasks: { [key: string]: PhoneMaskConfig } = {
    'default': { mask: '000-000-0000', pattern: /^\d{3}-\d{3}-\d{4}$/ },
    '1': { mask: '000-000-0000', pattern: /^\d{3}-\d{3}-\d{4}$/ }, // US/CA
    '44': { mask: '0000-000000', pattern: /^\d{4}-\d{6}$/ }, // UK
    '966': { mask: '0-0000-0000', pattern: /^\d{1}-\d{4}-\d{4}$/ }, // SA
    '971': { mask: '0-0000-0000', pattern: /^\d{1}-\d{4}-\d{4}$/ }, // AE
    '20': { mask: '00-0000-0000', pattern: /^\d{2}-\d{4}-\d{4}$/ }, // EG
    '962': { mask: '0-0000-0000', pattern: /^\d{1}-\d{4}-\d{4}$/ }, // JO
    '961': { mask: '0-0000-0000', pattern: /^\d{1}-\d{4}-\d{4}$/ }, // LB
    '33': { mask: '00-00-00-00-00', pattern: /^\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/ }, // FR
    '49': { mask: '0000-0000000', pattern: /^\d{4}-\d{7}$/ }, // DE
    '39': { mask: '000-0000000', pattern: /^\d{3}-\d{7}$/ }, // IT
  };

  private readonly placeholderExamples: { [key: string]: string } = {
    'default': '123-456-7890',
    '1': '123-456-7890', // US/CA
    '44': '1234-567890', // UK
    '966': '5-1234-5678', // SA
    '971': '5-1234-5678', // AE
    '20': '12-3456-7890', // EG
    '962': '7-1234-5678', // JO
    '961': '3-1234-5678', // LB
    '33': '12-34-56-78-90', // FR
    '49': '1234-5678901', // DE
    '39': '123-4567890', // IT
  };
  
  private onChange = (value: string) => {};
  private onTouched = () => {};

  constructor() {}

  ngOnInit(): void {
    this.setInitialValues();
    this.updateMask();
    this.updatePlaceholder();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialCountryCode'] || changes['initialPhoneNumber']) {
      this.setInitialValues();
      if (changes['initialCountryCode']) {
        this.updateMask();
        this.updatePlaceholder();
      }
    }
  }

  private setInitialValues(): void {
    if (this.initialCountryCode) {
      this.countryCode = this.initialCountryCode;
    }
    if (this.initialPhoneNumber) {
      this.value = this.initialPhoneNumber;
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onCountryCodeChange(selectedCountryCode: string): void {
    this.countryCode = selectedCountryCode;
    this.updateMask();
    this.updatePlaceholder();
    this.countryCodeChange.emit(selectedCountryCode);
  }

  onPhoneNumberInput(value: string): void {
    // Extract only digits for the clean value
    const cleanValue = value.replace(/\D/g, '');
    this.value = cleanValue;

    // Emit the formatted phone number with country code
    const fullFormattedPhone = `(+${this.countryCode})${value}`;

    // Emit changes
    this.onChange(cleanValue);
    this.phoneNumberChange.emit(cleanValue);
    this.formattedPhoneNumberChange.emit(fullFormattedPhone);
    this.onTouched();
  }

  onKeyPress(event: KeyboardEvent): void {
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].indexOf(event.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (event.keyCode === 65 && event.ctrlKey === true) ||
        (event.keyCode === 67 && event.ctrlKey === true) ||
        (event.keyCode === 86 && event.ctrlKey === true) ||
        (event.keyCode === 88 && event.ctrlKey === true)) {
      return;
    }

    // Ensure that it is a number and stop the keypress
    if ((event.shiftKey || (event.keyCode < 48 || event.keyCode > 57)) && (event.keyCode < 96 || event.keyCode > 105)) {
      event.preventDefault();
    }
  }

  onFlagError(country: any): void {
    this.flagError.emit(country);
  }

  updateMask(): void {
    this.currentMask = this.phoneMasks[this.countryCode]?.mask || this.phoneMasks['default'].mask;
  }

  updatePlaceholder(): void {
    this.currentPlaceholder = this.placeholderExamples[this.countryCode] || this.placeholderExamples['default'];
  }

  isValidPhoneNumber(): boolean {
    const pattern = this.phoneMasks[this.countryCode]?.pattern || this.phoneMasks['default'].pattern;
    const formattedValue = this.formatValueForValidation(this.value);
    return pattern.test(formattedValue);
  }

  private formatValueForValidation(value: string): string {
    const digits = value.replace(/\D/g, '');
    const mask = this.currentMask;
    let formatted = '';
    let digitIndex = 0;
    
    for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
      if (mask[i] === '0') {
        formatted += digits[digitIndex];
        digitIndex++;
      } else {
        formatted += mask[i];
      }
    }
    
    return formatted;
  }
}