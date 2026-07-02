import { Component, Injector, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LayoutType } from '../../../core/configs/config';
import { LayoutInitService } from '../../../core/layout-init.service';
import { LayoutService } from '../../../core/layout.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BaseComponent } from 'src/app/modules/base.component';
import data from 'src/assets/app-settings.json';

interface Industry {
  id: number;
  name: string;
  slug: string;
  children: any[];
}

interface IndustriesResponse {
  data: Industry[];
}

@Component({
  selector: 'app-header-menu',
  templateUrl: './header-menu.component.html',
  styleUrls: ['./header-menu.component.scss'],
})
export class HeaderMenuComponent extends BaseComponent implements OnInit {
  isIndustriesMenuVisible = false;
  industries: Industry[] = [];

  constructor(
    injector: Injector,
    private router: Router,
    private layout: LayoutService,
    private layoutInit: LayoutInitService,
    private http: HttpClient,

  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.fetchIndustries();
  }

  fetchIndustries() {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.lang
    });

    const body = {
      top_industry: 5,
      top_sub_industry: 1
    };

    this.http.post<IndustriesResponse>('https://api.foresighta.co/api/platform/industries/menu', body, { headers })
      .subscribe({
        next: (response) => {
          this.industries = response.data;
        },
        error: (error) => {
          console.error('Error fetching industries:', error);
        }
      });
  }

  getIndustryUrl(industry: Industry): string {
    return `${this.clientBaseUrl}/${this.lang}/industry/${industry.id}/${industry.slug}`;
  }

  calculateMenuItemCssClass(url: string): string {
    return checkIsActive(this.router.url, url) ? 'active' : '';
  }

  setBaseLayoutType(layoutType: LayoutType) {
    this.layoutInit.setBaseLayoutType(layoutType);
  }

  setToolbar(toolbarLayout: 'classic' | 'accounting' | 'extended' | 'reports' | 'saas') {
    const currentConfig = { ...this.layout.layoutConfigSubject.value };
    if (currentConfig && currentConfig.app && currentConfig.app.toolbar) {
      currentConfig.app.toolbar.layout = toolbarLayout;
      this.layout.saveBaseConfig(currentConfig);
    }
  }

  showIndustriesMenu() {
    this.isIndustriesMenuVisible = true;
  }

  hideIndustriesMenu() {
    this.isIndustriesMenuVisible = false;
  }
}

// Helper functions remain unchanged
const getCurrentUrl = (pathname: string): string => {
  return pathname.split(/[?#]/)[0];
};

const checkIsActive = (pathname: string, url: string) => {
  const current = getCurrentUrl(pathname);
  if (!current || !url) {
    return false;
  }

  if (current === url) {
    return true;
  }

  if (current.indexOf(url) > -1) {
    return true;
  }

  return false;
};
