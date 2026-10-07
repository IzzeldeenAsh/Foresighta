import { Component } from '@angular/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-schedule-dialog',
  templateUrl: './schedule-dialog.component.html'
})
export class ScheduleDialogComponent {
  selectedDate: string = '';
  selectedTime: string = '';
  errorMessage: string = '';
  currentDate: string;
  touched: boolean = false;

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig
  ) {
    this.currentDate = new Date().toISOString().split('T')[0];
  }

  onInputChange() {
    this.touched = true;
    this.isValidDateTime();
  }

  isValidDateTime(): boolean {
    if (!this.touched) {
      this.errorMessage = '';
      return false;
    }

    if (!this.selectedDate || !this.selectedTime) {
      this.errorMessage = 'Please select both date and time.';
      return false;
    }

    const selectedDateTime = new Date(`${this.selectedDate}T${this.selectedTime}`);
    const now = new Date();

    if (selectedDateTime <= now) {
      this.errorMessage = 'Selected date and time must be in the future.';
      return false;
    }

    this.errorMessage = '';
    return true;
  }

  confirm() {
    if (this.isValidDateTime()) {
      const selectedDateTime = new Date(`${this.selectedDate}T${this.selectedTime}`);
      const formattedDateTime = selectedDateTime.toISOString();
      this.ref.close(formattedDateTime);
    }
  }

  cancel() {
    this.ref.close(null);
  }
} 