import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { ClipboardModule } from 'ngx-clipboard';
import { TranslateModule } from '@ngx-translate/core';
import { Chart } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthService } from './modules/auth/services/auth.service';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { AuthInterceptor } from './modules/auth/interceptor-auth.interceptor';
import { MessageService, PrimeNGConfig } from 'primeng/api';
import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { RippleModule } from 'primeng/ripple';
import Aura from '@primeng/themes/aura';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { ProjectProgressCelebrationComponent } from './reusable-components/project-progress-celebration/project-progress-celebration.component';

function appInitializer(authService: AuthService) {
  return () => {
    return new Promise((resolve) => {
      // Check if we're on auth routes - if so, don't call getUserByToken
      // as it might cause redirects during email verification flow
      const currentPath = window.location.pathname;
      if (currentPath.includes('/auth/')) {
        console.log('On auth route, skipping getUserByToken in app initializer');
        resolve(true);
        return;
      }
      
      //@ts-ignore
      authService.getUserByToken().subscribe().add(resolve);
      //tets
    });
  };
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    TranslateModule.forRoot(),
    HttpClientModule,
    ClipboardModule,
    CoreModule,
    SharedModule,
    ProjectProgressCelebrationComponent,
    NgbModule,
    InlineSVGModule.forRoot(),
    SweetAlert2Module.forRoot(),
    AppRoutingModule,
    RippleModule
  ],
  providers: [
    MessageService,
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializer,
      multi: true,
      deps: [AuthService],
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: 'XSRF_COOKIE_NAME',
      useValue: 'XSRF-TOKEN'
    },
    {
      provide: 'XSRF_HEADER_NAME',
      useValue: 'X-XSRF-TOKEN'
    },
    provideClientHydration()
  ],
  bootstrap: [AppComponent],
})
export class AppModule { 
  constructor(private primengConfig: PrimeNGConfig) {
    this.primengConfig.ripple = true;

    // تسجيل البلغ-إن
    Chart.register(annotationPlugin);
  }
}
