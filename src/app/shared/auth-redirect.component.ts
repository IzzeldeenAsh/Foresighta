import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { TranslationService } from '../modules/i18n';

@Component({ standalone: true, selector: 'app-auth-redirect', template: '<p role="status">Redirecting… / جارٍ الانتقال…</p>' })
export class AuthRedirectComponent implements OnInit {
  constructor(private router: Router, private translation: TranslationService) {}
  ngOnInit(): void {
    const url = new URL(this.router.url, window.location.origin);
    const page = url.pathname.split('/')[2] || 'login';
    const pages: Record<string, string> = { login: 'signin', 'sign-up': 'signup', 'password-reset': 'reset-password', 'verify-login-email': 'verify-email', 'email-reconfirm': 'verify-email', 'verify-email': 'verify-email', callback: 'callback', logout: 'signout' };
    const lang = this.translation.getSelectedLanguage() === 'ar' ? 'ar' : 'en';
    const token = url.searchParams.get('token');
    if (page === 'callback' && token && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      const domain = environment.appDomain;
      const local = ['localhost', '127.0.0.1'].includes(location.hostname);
      document.cookie = `token=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax${local ? '' : `; Domain=${domain}; Secure`}`;
    }
    url.searchParams.delete('token'); url.searchParams.delete('roles');
    const target = new URL(`/${lang}/${pages[page] || 'signin'}`, environment.mainAppUrl);
    target.search = url.searchParams.toString();
    window.location.replace(target.href);
  }
}
