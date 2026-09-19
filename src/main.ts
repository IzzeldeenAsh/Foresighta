import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { environment } from './environments/environment';

if (environment.production) enableProdMode();
if (!(window as any).__authRedirecting) {
  // Old auth links do not need to initialize the dashboard or its Swiper bundle.
  Promise.all([import('./app/app.module'), import('swiper/element/bundle')])
    .then(([{ AppModule }, { register }]) => {
      register();
      return platformBrowserDynamic().bootstrapModule(AppModule);
    })
    .catch((err) => console.error(err));
}
