import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './components/login/login.component';
import { RegistrationComponent } from './components/registration/registration.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { LogoutComponent } from './components/logout/logout.component';
import { AuthComponent } from './auth.component';
import { TranslationModule } from '../i18n/translation.module';
import { LanguageSwitchModule } from 'src/app/reusable-components/language-switch/language-switch.module';
import { VerficationCardComponent } from './components/verfication-card/verfication-card.component';
import { MessageService } from 'primeng/api';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressBarModule } from 'primeng/progressbar';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { WaitComponent } from './components/wait/wait.component';
import { MessagesModule } from 'primeng/messages';
import { TreeSelectModule } from 'primeng/treeselect';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SignUpComponent } from './components/sign-up/sign-up.component';
import { ToastModule } from 'primeng/toast';
@NgModule({
  declarations: [
    LoginComponent,
    RegistrationComponent,
    ForgotPasswordComponent,
    VerficationCardComponent,
    LogoutComponent,
    SignUpComponent,
    WaitComponent,
    AuthComponent,
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    TranslationModule,
    TreeSelectModule,
    MessagesModule,
    SweetAlert2Module.forChild(),
    ProgressBarModule,
    InputTextModule,
    PasswordModule,
    ToastModule,
    LanguageSwitchModule,
    FormsModule,
    ReactiveFormsModule,
    MultiSelectModule,
    DropdownModule,
    HttpClientModule,
  ],
  providers:[MessageService]
})
export class AuthModule {}
