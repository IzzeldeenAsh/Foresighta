import { Component, Input, Output, EventEmitter, OnInit, OnChanges, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationModule } from 'src/app/modules/i18n';
import countriesLocal from 'src/app/_metronic/shared/countires.json';
import { DropdownModule } from 'primeng/dropdown';

export interface Country {
  id: number;
  region_id: number;
  iso2: string;
  iso3: string;
  nationality: string;
  nationalities: {
    en: string;
    ar: string;
  };
  international_code: string;
  flag: string;
  file_url?: string;
  alpha3?: string; 
  name: string;
  names: {
    en: string;
    ar: string;
  };
  status: string;
  showFlag?: boolean;
}

@Component({
  selector: 'app-country-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslationModule, DropdownModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CountryDropdownComponent),
      multi: true
    }
  ],
  template: `
    <div class="country-dropdown-wrapper" [class.rtl]="lang === 'ar'">
      <p-dropdown
        [options]="countries"
        [(ngModel)]="selectedCountryId"
        [placeholder]="placeholder"
        [filter]="enableSearch"
        [filterPlaceholder]="searchPlaceholder"
        [showClear]="showClear"
        [disabled]="false"
        appendTo="body"
        [style]="{width: '100%'}"
        [styleClass]="isInvalid ? 'is-invalid' : ''"
        optionLabel="displayName"
        optionValue="id"
        (onChange)="onCountryChange($event)"
        (onClear)="onClearCountry()"
      >
        <ng-template pTemplate="selectedItem" let-selectedOption>
          <div class="selected-country d-flex align-items-center" *ngIf="selectedOption">
            <img 
              *ngIf="selectedOption.showFlag"
              [src]="getFlagSrc(selectedOption)"
              (error)="onFlagError(selectedOption)"
              alt="{{ selectedOption.names.en }}"
              class="flag-icon w-20px me-2" 
            />
            <span>{{ getDisplayName(selectedOption) }}</span>
            <span *ngIf="showBothNames" class="text-muted small" [style.margin-left.px]="lang === 'ar' ? 8 : 8" [style.margin-right.px]="0">
              ({{ getSecondaryName(selectedOption) }})
            </span>
          </div>
        </ng-template>
        
        <ng-template pTemplate="item" let-country>
          <div class="dropdown-item-content d-flex align-items-center">
            <img 
              *ngIf="country.showFlag"
              [src]="getFlagSrc(country)"
              (error)="onFlagError(country)"
              alt="{{ country.names.en }}"
              class="flag-icon w-20px me-3" 
            />
            <span>{{ getDisplayName(country) }}</span>
            <span *ngIf="showBothNames" class="text-muted small" [style.margin-left.px]="lang === 'ar' ? 8 : 8" [style.margin-right.px]="0">
              ({{ getSecondaryName(country) }})
            </span>
            <span *ngIf="showCode && country.international_code" class="text-muted ms-auto">
              (+{{ country.international_code }})
            </span>
          </div>
        </ng-template>
      </p-dropdown>
    </div>
  `,
  styles: [`
    .country-dropdown-wrapper {
      position: relative;
    }

    .selected-country {
      display: flex;
      align-items: center;
      width: 100%;
    }

    .dropdown-item-content {
      width: 100%;
    }

    .flag-icon {
      flex-shrink: 0;
    }

    .rtl .selected-country {
      direction: rtl;
    }

    .rtl .flag-icon {
      margin-left: 0.5rem;
      margin-right: 0;
    }

    /* Override PrimeNG dropdown styles for RTL */
    .rtl ::ng-deep .p-dropdown {
      direction: rtl;
    }
  `]
})
export class CountryDropdownComponent implements OnInit, OnChanges, ControlValueAccessor {
  @Input() countries: Country[] = [];
  @Input() placeholder: string = 'Select country...';
  @Input() searchPlaceholder: string = 'Search countries...';
  @Input() enableSearch: boolean = true;
  @Input() showClear: boolean = true;
  @Input() showCode: boolean = false;
  @Input() showBothNames: boolean = false;
  @Input() lang: string = 'en';
  @Input() isInvalid: boolean = false;

  @Output() countrySelected = new EventEmitter<Country>();
  @Output() countryCleared = new EventEmitter<void>();

  selectedCountry: Country | null = null;
  selectedCountryId: number | null = null;
  currentValue: any = null;

  private onChange = (value: any) => {};
  private onTouched = () => {};
  private countryFlagByIso3: Record<string, string> = {};
  private countryFlagByName: Record<string, string> = {};
  private manualFlagOverridesByName: Record<string, string> = {
    'mayotte': 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Coat_of_Arms_of_Mayotte.svg',
  };
  private manualFlagOverridesByIso3: Record<string, string> = {
    'MYT': 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Coat_of_Arms_of_Mayotte.svg',
  };

  private arabicNameOverridesByIso3: Record<string, string> = {
    'TUR': 'تركيا',
    'USA': 'الولايات المتحدة الأمريكية',
    'UMI': 'جزر الولايات المتحدة البعيدة الصغيرة',
    'ARE': 'الإمارات العربية المتحدة',
    'ATG': 'أنتيغوا وبربودا',
  };
  private arabicNameOverridesByEnName: Record<string, string> = {
    'turkey': 'تركيا',
    'united states of america': 'الولايات المتحدة الأمريكية',
    'united states minor outlying islands': 'جزر الولايات المتحدة البعيدة الصغيرة',
    'united arab emirates': 'الإمارات العربية المتحدة',
    'antigua and barbuda': 'أنتيغوا وبربودا',
  };

  constructor() {
    this.buildFlagMaps();
  }

  ngOnInit() {
    this.prepareCountriesData();
  }

  ngOnChanges() {
    if (this.countries && this.countries.length > 0) {
      this.prepareCountriesData();
      
      // Re-evaluate selected country if we have a value but no selected country yet
      if (this.currentValue && !this.selectedCountry) {
        const numericValue = typeof this.currentValue === 'string' ? parseInt(this.currentValue, 10) : this.currentValue;
        this.selectedCountry = this.countries.find(country => country.id === numericValue) || null;
        this.selectedCountryId = this.selectedCountry?.id || null;
      }
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: any): void {
    this.currentValue = value;
    
    if (value) {
      // Ensure value is a number for comparison
      const numericValue = typeof value === 'string' ? parseInt(value, 10) : value;
      
      this.selectedCountry = this.countries.find(country => country.id === numericValue) || null;
      this.selectedCountryId = this.selectedCountry?.id || null;
    } else {
      this.selectedCountry = null;
      this.selectedCountryId = null;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(): void {
    // Handle disabled state if needed
  }

  prepareCountriesData() {
    this.countries.forEach(country => {
      const arName = country.names?.ar || '';
      const enName = (country.names?.en || country.name || '').trim();
      const needsFix = !arName || /[A-Za-z]/.test(arName) || arName.trim() === 'ديك رومي';
      if (needsFix) {
        let fixed = '';
        if (country.iso3 && this.arabicNameOverridesByIso3[country.iso3.toUpperCase()]) {
          fixed = this.arabicNameOverridesByIso3[country.iso3.toUpperCase()];
        } else if (enName) {
          const key = enName.toLowerCase();
          if (this.arabicNameOverridesByEnName[key]) {
            fixed = this.arabicNameOverridesByEnName[key];
          }
        }
        if (fixed) {
          country.names = { ...(country.names || { en: enName, ar: '' }), ar: fixed, en: enName };
        }
      }

      if (country.showFlag === undefined) {
        country.showFlag = true;
      }
      if (!country.file_url) {
        if (country.iso3 && this.manualFlagOverridesByIso3[country.iso3.toUpperCase()]) {
          country.file_url = this.manualFlagOverridesByIso3[country.iso3.toUpperCase()];
        }

        if (country.iso3 && this.countryFlagByIso3[country.iso3.toUpperCase()]) {
          country.file_url = this.countryFlagByIso3[country.iso3.toUpperCase()];
        } else {
          const key = (country.names?.en || country.name || '').trim().toLowerCase();
          if (key && this.manualFlagOverridesByName[key]) {
            country.file_url = this.manualFlagOverridesByName[key];
          } else if (key && this.countryFlagByName[key]) {
            country.file_url = this.countryFlagByName[key];
          }
        }
      }
      if (country.flag) {
        try {
          let normalized = this.slugifyFlagName(country.flag.toString());
          normalized = this.flagExceptionsMap[normalized] || normalized;
          country.flag = normalized;
        } catch {}
      } else {
        country.flag = 'flag';
      }
      (country as any)._flagSrc = this.computeFlagSrc(country);

      (country as any).displayName = this.getDisplayName(country);
    });
  }

  onCountryChange(event: any) {
    const countryId = event.value;
    this.selectedCountry = this.countries.find(country => country.id === countryId) || null;
    this.selectedCountryId = countryId;
    this.onChange(countryId);
    this.countrySelected.emit(this.selectedCountry!);
  }

  onClearCountry() {
    this.selectedCountry = null;
    this.selectedCountryId = null;
    this.onChange(null);
    this.countryCleared.emit();
  }

  getDisplayName(country: Country): string {
    return this.lang === 'ar' ? country.names.ar : country.names.en;
  }

  getSecondaryName(country: Country): string {
    return this.lang === 'ar' ? country.names.en : country.names.ar;
  }

  onFlagError(country: Country) {
    country.flag = 'flag';
    country.file_url = undefined; 
    (country as any)._flagSrc = this.computeFlagSrc(country);
    country.showFlag = true;
  }

  trackByCountryId(_: number, country: Country): number {
    return country.id;
  }

  private computeFlagSrc(country: Country): string {
 
    return `assets/media/flags/${country.flag}.svg`;
  }

  getFlagSrc(country: Country): string {
    return  this.computeFlagSrc(country);
  }

  // --- Helpers ---
  private flagExceptionsMap: Record<string, string> = {
    'saint-lucia': 'st-lucia',
    'saint-vincent-and-the-grenadines': 'st-vincent-and-the-grenadines',
    'saint-kitts-and-nevis': 'saint-kitts-and-nevis',
    'united-states-of-america': 'united-states',
    'united-states': 'united-states',
    'united-kingdom': 'united-kingdom',
    'u-s-minor-outlying-islands': 'united-states',
    'united-states-minor-outlying-islands': 'united-states',
    'wallis-and-futuna': 'flag', 
  };

  private slugifyFlagName(value: string): string {
    const lower = value.trim().toLowerCase();
    const replaced = lower
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const saint = replaced.replace(/^saint-/g, 'st-');
    return saint;
  }

  private buildFlagMaps(): void {
    try {
      const list: Array<{ alpha3?: string; name?: string; file_url?: string }> =
        (countriesLocal as any)?.countriesLocalAPI || [];
      for (const item of list) {
        if (item.file_url) {
          if (item.alpha3) {
            this.countryFlagByIso3[item.alpha3.toUpperCase()] = item.file_url;
          }
          if (item.name) {
            this.countryFlagByName[item.name.trim().toLowerCase()] = item.file_url;
          }
        }
      }
    } catch {}
  }
}