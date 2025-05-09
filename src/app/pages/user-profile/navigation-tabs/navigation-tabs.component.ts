import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { IKnoldgProfile } from 'src/app/_fake/models/profile.interface';
import { TranslationService } from 'src/app/modules/i18n';

@Component({
  selector: 'app-navigation-tabs',
  templateUrl: './navigation-tabs.component.html',
  styleUrls: ['./navigation-tabs.component.scss']
})
export class NavigationTabsComponent implements OnInit, OnChanges {
  @Input() profile: IKnoldgProfile;
  lang: string = 'en';
  roles: string[] = [];
  filteredTabs:any;
  tabs = [
    { labelen: 'Personal Info', labelar: 'معلوماتي', link: '/app/profile/overview', activeInfo: true, activePrimary: false, roles: ['client', 'insighter', 'company', 'company-insighter'] },
    { labelen: 'My Certificates', labelar: 'شهاداتي', link: '/app/profile/certificates', activeInfo: false, activePrimary: true, roles: ['insighter', 'company', 'company-insighter'] },
    { labelen: 'My Company Info', labelar: 'معلومات شركتي', link: '/app/profile/company', activeInfo: false, activePrimary: true, roles: ['company'] },
    { labelen: 'Company Certificates', labelar: 'شهادات الشركة', link: '/app/profile/company-certificates', activeInfo: false, activePrimary: true, roles: ['company'] },
    { labelen: 'Documents', labelar: 'وثائقي', link: '/app/profile/documents', activeInfo: false, activePrimary: true, roles: ['company'] },
    { labelen: 'Profile Settings', labelar: 'إعدادات الملف الشخصي', link: '/app/profile/settings', activeInfo: false, activePrimary: true, roles: ['client', 'insighter', 'company', 'company-insighter'] },
  ];

  constructor(private translationService: TranslationService) {}

  ngOnInit(): void {
    this.roles = this.profile.roles;
    this.handleLanguage();
    this.filterTabs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.profile) {
      this.roles = this.profile.roles;
      this.filterTabs();
    }
  }

  handleLanguage() {
    this.lang = this.translationService.getSelectedLanguage();
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.lang = lang;
    });
  }

  filterTabs() {
    this.filteredTabs = this.tabs.filter(tab => this.hasRole(tab.roles));
  }

  // Roles
  hasRole(requiredRoles: string[]): boolean {
    return requiredRoles.some(role => this.roles.includes(role));
  }

  ngOnDestroy(): void {
    // Unsubscribe logic if any
  }
}
