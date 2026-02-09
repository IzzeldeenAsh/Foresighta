import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ProductionCookieService {
  private readonly DEFAULT_DOMAIN = '.insightabusiness.com';
  private readonly DEFAULT_PATH = '/';
  private readonly DEFAULT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

  /**
   * Check if running on localhost
   */
  private isLocalhost(): boolean {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' ||
           hostname.startsWith('localhost:') ||
           hostname.startsWith('127.0.0.1:');
  }

  /**
   * Sets a cookie with .insightabusiness.com domain for cross-domain sharing
   */
  setCookie(name: string, value: string, options: {
    maxAge?: number;
    path?: string;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  } = {}): void {
    const isLocalhost = this.isLocalhost();

    const cookieParts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

    // Set domain only for production (not localhost)
    if (!isLocalhost) {
      cookieParts.push(`Domain=${this.DEFAULT_DOMAIN}`);
    }

    cookieParts.push(`Path=${options.path || this.DEFAULT_PATH}`);
    
    const maxAge = options.maxAge !== undefined ? options.maxAge : this.DEFAULT_MAX_AGE;
    cookieParts.push(`Max-Age=${maxAge}`);

    // SameSite and Secure settings
    const sameSite = options.sameSite !== undefined 
      ? options.sameSite 
      : (isLocalhost ? 'Lax' : 'None');
    cookieParts.push(`SameSite=${sameSite}`);

    if (!isLocalhost || options.secure) {
      cookieParts.push('Secure');
    }

    document.cookie = cookieParts.join('; ');
  }

  /**
   * Gets a cookie value by name
   */
  getCookie(name: string): string | null {
    const match = document.cookie.match(
      new RegExp('(^|; )' + name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1') + '=([^;]*)')
    );
    return match ? decodeURIComponent(match[2]) : null;
  }

  /**
   * Sets the authentication token cookie
   */
  setAuthToken(token: string, maxAge?: number): void {
    this.setCookie('token', token, {
      maxAge: maxAge || (60 * 60 * 24 * 7), // 7 days default
      sameSite: this.isLocalhost() ? 'Lax' : 'None',
      secure: !this.isLocalhost()
    });
  }

  /**
   * Gets the authentication token from cookie
   */
  getAuthToken(): string | null {
    return this.getCookie('token');
  }

  /**
   * Sets the preferred language cookie
   */
  setPreferredLanguage(language: string): void {
    this.setCookie('preferred_language', language, {
      maxAge: this.DEFAULT_MAX_AGE
    });
  }

  /**
   * Gets the preferred language from cookie
   */
  getPreferredLanguage(): string | null {
    return this.getCookie('preferred_language');
  }

  /**
   * Clears a cookie by name
   */
  clearCookie(name: string): void {
    const isLocalhost = this.isLocalhost();
    
    const clearVariations = [
      // Local variation
      `${name}=; Path=/; Max-Age=-1`,
      // Production domain variation
      `${name}=; Domain=${this.DEFAULT_DOMAIN}; Path=/; Max-Age=-1; Secure; SameSite=None`,
      // Fallback without domain
      `${name}=; Path=/; Max-Age=-1; ${isLocalhost ? 'SameSite=Lax' : 'Secure; SameSite=None'}`
    ];

    clearVariations.forEach(variation => {
      document.cookie = variation;
    });
  }
}