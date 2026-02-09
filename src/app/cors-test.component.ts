import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cors-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <h2>CORS Testing</h2>
      <button (click)="testRequest()">Test API Request</button>
      <div *ngIf="loading">Loading...</div>
      <div *ngIf="error" style="color: red">
        <h3>Error:</h3>
        <pre>{{ error | json }}</pre>
      </div>
      <div *ngIf="result">
        <h3>Success:</h3>
        <pre>{{ result | json }}</pre>
      </div>
    </div>
  `
})
export class CorsTestComponent implements OnInit {
  loading = false;
  error: any = null;
  result: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {}

  testRequest(): void {
    this.loading = true;
    this.error = null;
    this.result = null;

    // Test a specific API endpoint that's causing CORS issues
    const url = 'https://api.insightabusiness.com/api/common/setting/country/list';
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': 'en'
    });

    // Add withCredentials option
    this.http.get(url, { headers, withCredentials: true }).subscribe({
      next: (response) => {
        this.result = response;
        this.loading = false;
        console.log('Success:', response);
      },
      error: (err) => {
        this.error = err;
        this.loading = false;
        console.error('Error:', err);
        
        // Log specific CORS-related details
        if (err.status === 0) {
          console.error('CORS Error: This is likely a CORS issue');
          console.error('Check browser console for more details');
        }
      }
    });
  }
} 