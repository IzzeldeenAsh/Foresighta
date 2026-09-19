import { environment } from '../../environments/environment';

/** Navigate directly to Next auth; legacy /auth routes remain for old emails/bookmarks. */
export function redirectToNextSignIn(returnUrl?: string): false {
  const cookie = document.cookie.split('; ').find(value => value.startsWith('preferred_language='));
  let language = cookie?.split('=')[1];
  if (!language) { try { language = localStorage.getItem('language') || 'en'; } catch {} }
  const target = new URL(`/${language === 'ar' ? 'ar' : 'en'}/signin`, environment.mainAppUrl);
  if (returnUrl) target.searchParams.set('returnUrl', returnUrl);
  window.location.replace(target.href);
  return false;
}
