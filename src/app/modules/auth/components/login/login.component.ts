import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { UserModel } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { ScrollAnimsService } from 'src/app/_fake/services/scroll-anims/scroll-anims.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, OnDestroy {
  // KeenThemes mock, change it to:
  defaultAuth: any = {
    email: null,
    password: null,
  };
  loginForm: FormGroup;
  hasError: boolean;
  returnUrl: string;
  isLoading$: Observable<boolean>;
  selectedLang: string = 'en';
  isRTL: boolean = false; // Added for RTL logic
  passwordVisible: boolean = false;
  // private fields
  private unsubscribe: Subscription[] = []; // Read more: => https://brianflove.com/2016/12/11/anguar-2-unsubscribe-observables/

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private scrollAnims: ScrollAnimsService,
    
  ) {
    
    this.isLoading$ = this.authService.isLoading$;
    // redirect to home if already logged in
    // if (this.authService.currentUserValue) {
    //   this.router.navigate(['/']);
    // }
    this.selectedLang = this.translationService.getSelectedLanguage();
    this.isRTL = this.selectedLang === 'ar'; // Set RTL based on the selected language
  }
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.scrollAnims.scrollAnimations();
    }, 100); // Delay to ensure DOM elements are fully loaded
  }

 
  ngOnInit(): void {
    this.initForm();
    // get return url from route parameters or default to '/'
    this.returnUrl =
      this.route.snapshot.queryParams['returnUrl'.toString()] || '/';

      this.translationService.onLanguageChange().subscribe((lang)=>{
        this.selectedLang =lang;
      })
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.loginForm.controls;
  }

  initForm() {
    this.loginForm = this.fb.group({
      email: [
        this.defaultAuth.email,
        Validators.compose([
          Validators.required,
          Validators.email,
          Validators.minLength(3),
          Validators.maxLength(320), // https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address
        ]),
      ],
      password: [
        this.defaultAuth.password,
        Validators.compose([
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(100),
        ]),
      ],
    });
  }


  togglePasswordVisibility(passwordField: HTMLInputElement): void {
    this.passwordVisible = !this.passwordVisible;
    passwordField.type = this.passwordVisible ? 'text' : 'password';
  }
  submit() {
    this.hasError = false;
    const loginSubscr = this.authService
    .login(this.f.email.value, this.f.password.value)
    .pipe(first())
    .subscribe();
   this.unsubscribe.push(loginSubscr);
   
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}
