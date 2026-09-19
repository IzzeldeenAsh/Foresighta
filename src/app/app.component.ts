import { routes } from './app-routing.module';
import { Component, OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, Event } from '@angular/router';
import { TranslationService } from './modules/i18n';
import { LoaderService } from './core/services/loader.service';
// language list
import { locale as enLang } from './modules/i18n/vocabs/en';
import { locale as chLang } from './modules/i18n/vocabs/ch';
import { locale as esLang } from './modules/i18n/vocabs/es';
import { locale as jpLang } from './modules/i18n/vocabs/jp';
import { locale as deLang } from './modules/i18n/vocabs/de';
import { locale as frLang } from './modules/i18n/vocabs/fr';
import { ThemeModeService } from './_metronic/partials/layout/theme-mode-switcher/theme-mode.service';

@Component({
  // tslint:disable-next-line:component-selector
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'body[root]',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],

})
export class AppComponent implements OnInit {
  constructor(
    private translationService: TranslationService,
    private modeService: ThemeModeService,
    private router: Router,
    private loaderService: LoaderService,
  ) {
    // register translations
    // this.translationService.setLanguage('ar');

    // Setup router events to show loader
    this.router.events.subscribe((event: Event) => {
      this.navigationInterceptor(event);
    });
  }

  ngOnInit() {
    this.modeService.init();
  }

  // Shows and hides the loading spinner during RouterEvent changes
  private navigationInterceptor(event: Event): void {
    if (event instanceof NavigationStart) {
      this.loaderService.show();
    }
    if (event instanceof NavigationEnd || 
        event instanceof NavigationCancel || 
        event instanceof NavigationError) {
      this.loaderService.hide();
    }
  }
}
