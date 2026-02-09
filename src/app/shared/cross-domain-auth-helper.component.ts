import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cross-domain-auth-helper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="showMessage" style="padding: 20px; text-align: center;">
      <h3>Synchronizing authentication...</h3>
      <p>Please wait while we securely sync your session.</p>
    </div>
  `
})
export class CrossDomainAuthHelperComponent implements OnInit {
  showMessage = true;

  ngOnInit(): void {
    // Listen for messages from the parent window
    window.addEventListener('message', this.handleMessage.bind(this));
    
    // Let any parent window know we're ready to receive a token
    window.parent.postMessage({ type: 'AUTH_RECEIVER_READY' }, '*');
    
    // If we have a token in the URL, extract it
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      this.saveToken(token);
      this.notifySuccess();
    }
  }

  /**
   * Handle incoming messages from parent window
   */
  private handleMessage(event: MessageEvent): void {
    // We should add origin validation in production
    // if (event.origin !== 'https://foresighta.co') return;
    
    const data = event.data;
    if (data && data.type === 'AUTH_TOKEN' && data.token) {
      this.saveToken(data.token);
      this.notifySuccess();
    }
  }

  /**
   * Save the auth token in localStorage
   */
  private saveToken(token: string): void {
    try {
      localStorage.setItem('foresighta-creds', JSON.stringify({ authToken: token }));
      console.log('Token saved successfully');
    } catch (error) {
      console.error('Error saving token to localStorage:', error);
    }
  }

  /**
   * Notify the parent window that authentication was successful
   */
  private notifySuccess(): void {
    this.showMessage = false;
    
    // Notify the parent window if this is in an iframe
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'AUTH_SUCCESS' }, '*');
    }
    
    // If this is the main window (not in iframe), redirect
    else if (window.opener) {
      window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
      window.close();
    }
    // If no parent/opener, redirect to the main app
    else {
      window.location.href = '/app';
    }
  }
} 