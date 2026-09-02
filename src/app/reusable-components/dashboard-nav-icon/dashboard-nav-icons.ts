/**
 * Single source of truth for the dashboard navigation icons.
 *
 * The sidebar renders these as an SVG sprite (`app-dashboard-nav-icon-sprite`)
 * and the page headers render them inline (`app-dashboard-nav-icon`), so a
 * sidebar item and the header of the page it links to always show one icon.
 */
export type DashboardNavIconName =
  | 'file'
  | 'list-details'
  | 'message-2'
  | 'users'
  | 'book'
  | 'download'
  | 'bookmark'
  | 'calendar'
  | 'calendar-cog'
  | 'briefcase'
  | 'folders'
  | 'settings'
  | 'shopping-bag'
  | 'chart-line'
  | 'wallet'
  | 'user-edit'
  | 'bell'
  | 'credit-card';

export const DASHBOARD_NAV_ICON_PATHS: Record<DashboardNavIconName, string[]> = {
  file: [
    'M14 3v4a1 1 0 0 0 1 1h4',
    'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2',
  ],
  'list-details': [
    'M13 5h8M13 9h5M13 15h8M13 19h5',
    'M3 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4',
    'M3 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4',
  ],
  'message-2': [
    'M8 9h8M8 13h6',
    'M9 18h-3a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-3l-3 3l-3 -3',
  ],
  users: [
    'M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
    'M16 3.13a4 4 0 0 1 0 7.75',
    'M21 21v-2a4 4 0 0 0 -3 -3.85',
  ],
  book: [
    'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0',
    'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0',
    'M3 6v13M12 6v13M21 6v13',
  ],
  download: ['M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2M7 11l5 5l5 -5M12 4v12'],
  bookmark: ['M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4'],
  calendar: [
    'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12M16 3v4M8 3v4M4 11h16M11 15h1M12 15v3',
  ],
  'calendar-cog': [
    'M12 21h-6a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v5M16 3v4M8 3v4M4 11h16',
    'M17.001 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M19.001 15.5v1.5M19.001 21v1.5M22.032 17.25l-1.299 .75M17.27 20l-1.3 .75M15.97 17.25l1.3 .75M20.733 20l1.3 .75',
  ],
  briefcase: [
    'M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2M12 12v.01M3 13a20 20 0 0 0 18 0',
  ],
  folders: [
    'M9 3h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2M17 16v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2h2',
  ],
  settings: [
    'M19.875 6.27a2.225 2.225 0 0 1 1.125 1.948v7.284c0 .809 -.443 1.555 -1.158 1.948l-6.75 4.27a2.269 2.269 0 0 1 -2.184 0l-6.75 -4.27a2.225 2.225 0 0 1 -1.158 -1.948v-7.285c0 -.809 .443 -1.554 1.158 -1.947l6.75 -3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98h-.033M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  ],
  'shopping-bag': [
    'M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.965 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304M9 11v-5a3 3 0 0 1 6 0v5',
  ],
  'chart-line': ['M4 19h16M4 15l4 -6l4 2l4 -5l4 4'],
  wallet: [
    'M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3M19 16v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12M20 12v4h-4a2 2 0 0 1 0 -4h4',
  ],
  'user-edit': [
    'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0M6 21v-2a4 4 0 0 1 4 -4h3.5M18.42 15.61a2.1 2.1 0 0 1 2.97 2.97l-3.39 3.42h-3v-3l3.42 -3.39',
  ],
  bell: [
    'M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6M9 17v1a3 3 0 0 0 6 0v-1',
  ],
  'credit-card': [
    'M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-8M3 10h18M7 15h.01M11 15h2',
  ],
};

export const DASHBOARD_NAV_ICONS = (
  Object.keys(DASHBOARD_NAV_ICON_PATHS) as DashboardNavIconName[]
).map((name) => ({ name, paths: DASHBOARD_NAV_ICON_PATHS[name] }));
