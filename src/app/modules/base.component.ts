// base.component.ts
import { OnDestroy, AfterViewInit, Directive, Injector } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { ScrollAnimsService } from '../_fake/services/scroll-anims/scroll-anims.service';
import { MessageService } from 'primeng/api';
import { TranslationService } from 'src/app/modules/i18n';
import { ToastService } from '../_fake/services/toast-service/toast.service';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

@Directive()
export abstract class BaseComponent implements OnDestroy, AfterViewInit {
  protected scrollAnims: ScrollAnimsService;
  public messageService: MessageService;
  protected translate: TranslationService;
  public toastService: ToastService;
   unsubscribe$ = new Subject<void>();
  protected unsubscribe: Subscription[] = [];
  lang: string='en';
  clientBaseUrl = 'https://insightabusiness.com';
  

  constructor(protected injector: Injector) {
    this.scrollAnims = this.injector.get(ScrollAnimsService);
    this.messageService = this.injector.get(MessageService);
    this.translate = this.injector.get(TranslationService);
    this.lang = this.translate.getSelectedLanguage();
    this.toastService = this.injector.get(ToastService);
    const langSubscription = this.translate.onLanguageChange().subscribe((lang: string) => {
      this.lang = lang || 'en';
    });
    this.unsubscribe.push(langSubscription);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.scrollAnims.scrollAnimations();
    }, 100);
  }

  showInfo(summary:string ='Info',detail: string='Info' ) {
    this.toastService.info(detail, summary);
  }

  showWarn(summary:string ='Warning',detail: string='Warning' ) {
    this.toastService.warning(detail, summary);
  }

  showSuccess(summary:string ='Success',detail: string='Success' ) {
    this.toastService.success(detail, summary);
  }

  showError(summary:string ='Error',detail: string='Error' ,life:number=5000) {
    this.toastService.error(detail, summary, life);
  }

  isFirstWordArabic(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }
    
    // Trim whitespace and get the first word
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return false;
    }
    
    // Extract the first word (split by whitespace and take the first element)
    const firstWord = trimmedText.split(/\s+/)[0];
    if (firstWord.length === 0) {
      return false;
    }
    
    // Check if the first character is in the Arabic Unicode range (U+0600 to U+06FF)
    const firstChar = firstWord[0];
    const charCode = firstChar.charCodeAt(0);
    
    // Arabic Unicode range: U+0600 to U+06FF
    return charCode >= 0x0600 && charCode <= 0x06FF;
  }

  ngOnDestroy(): void {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
