import { Component, OnInit, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({ selector: 'app-cross-domain-auth-helper', standalone: true,
  template: '<p role="status">Synchronizing session… / جارٍ مزامنة الجلسة…</p>' })
export class CrossDomainAuthHelperComponent implements OnInit, OnDestroy {
  private readonly origin = new URL(environment.mainAppUrl).origin;
  private readonly receive = (event: MessageEvent) => {
    if (event.origin !== this.origin || (event.source !== window.parent && event.source !== window.opener)) return;
    const token = event.data?.type === 'AUTH_TOKEN' ? event.data.token : null;
    if (typeof token !== 'string' || token.length > 12000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return;
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    document.cookie = `token=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax${local ? '' : `; Domain=${environment.appDomain}; Secure`}`;
    (event.source as Window).postMessage({ type: 'AUTH_SUCCESS' }, this.origin);
  };
  ngOnInit(): void {
    // Tokens in URLs are no longer accepted by this message receiver.
    const url = new URL(location.href);
    if (url.searchParams.has('token')) { url.searchParams.delete('token'); history.replaceState(null, '', url.pathname + url.search); }
    window.addEventListener('message', this.receive);
    if (window.parent !== window) window.parent.postMessage({ type: 'AUTH_RECEIVER_READY' }, this.origin);
  }
  ngOnDestroy(): void { window.removeEventListener('message', this.receive); }
}
