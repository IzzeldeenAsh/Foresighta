import { Injectable } from '@angular/core';

export interface CookieOptions {
  domain?: string;
  path?: string;
  maxAge?: number;
  expires?: Date;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

@Injectable({
  providedIn: 'root'
})
export class CookieService {
  private readonly DEFAULT_DOMAIN = '.insightabusiness.com';
  private readonly DEFAULT_PATH = '/';
  private readonly DEFAULT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

  /**
   * Sets a cookie with consistent configuration across the app
   */
  setCookie(name: string, value: string, options: Partial<CookieOptions> = {}): void {
    // Clear any existing cookies with the same name first
    this.clearCookie(name);

    const isLocalhost = this.isLocalhost();

    const cookieOptions: CookieOptions = {
      path: options.path || this.DEFAULT_PATH,
      maxAge: options.maxAge || this.DEFAULT_MAX_AGE,
      sameSite: isLocalhost ? 'Lax' : 'None',
      secure: !isLocalhost,
      domain: isLocalhost ? undefined : (options.domain || this.DEFAULT_DOMAIN),
      ...options
    };

    const cookieParts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

    if (cookieOptions.domain) {
      cookieParts.push(`Domain=${cookieOptions.domain}`);
    }

    if (cookieOptions.path) {
      cookieParts.push(`Path=${cookieOptions.path}`);
    }

    if (cookieOptions.maxAge !== undefined) {
      cookieParts.push(`Max-Age=${cookieOptions.maxAge}`);
    }

    if (cookieOptions.expires) {
      cookieParts.push(`Expires=${cookieOptions.expires.toUTCString()}`);
    }

    if (cookieOptions.sameSite) {
      cookieParts.push(`SameSite=${cookieOptions.sameSite}`);
    }

    if (cookieOptions.secure) {
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
   * Clears a cookie by name - removes all possible variations
   */
  clearCookie(name: string): void {
    const isLocalhost = this.isLocalhost();

    // Clear cookie variations to handle duplicates
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

  /**
   * Sets the preferred language cookie with proper cleanup
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
   * Sets auth-related cookies
   */
  setAuthCookie(name: string, value: string, maxAge?: number): void {
    this.setCookie(name, value, {
      maxAge: maxAge || (60 * 60 * 24 * 7) // 7 days default for auth
    });
  }

  private isLocalhost(): boolean {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }
}