import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { OtpModalComponent } from '../reusable-components/otp-modal/otp-modal.component';
import { CustomYearPickerComponent } from '../reusable-components/custom-year-picker/custom-year-picker.component';

@NgModule({
  declarations: [
    EmptyStateComponent,
    OtpModalComponent,
    CustomYearPickerComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    DialogModule,
    DropdownModule,
    CheckboxModule,
    ButtonModule
  ],
  exports: [
    EmptyStateComponent,
    OtpModalComponent,
    CustomYearPickerComponent
  ]
})
export class SharedModule { }
