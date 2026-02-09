# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Start Development Server
```bash
npm start  # Starts dev server on port 4200
```

### Build
```bash
ng build                    # Production build
ng build --watch --configuration development  # Development build with watch
```

### Testing & Linting
```bash
ng test     # Run unit tests with Karma
ng lint     # Run ESLint on TypeScript and HTML files
```

### SSR (Server-Side Rendering)
```bash
ng run demo1:serve-ssr     # Development SSR
ng build && ng run demo1:server  # Build for SSR
npm run serve:ssr          # Serve SSR build
```

## Project Architecture

### Framework & Technology Stack
- **Angular 17** with TypeScript
- **Metronic 8** UI framework (premium Bootstrap-based admin template)
- **PrimeNG** components library for rich UI elements
- **Bootstrap 5.3.2** for responsive design
- **RxJS** for reactive programming
- **Server-Side Rendering (SSR)** enabled via Angular Universal

### Application Structure

#### Core Modules
- **Auth Module** (`src/app/modules/auth/`) - Authentication, login, registration, password reset
- **Admin Dashboard** (`src/app/modules/admin-dashboard/`) - Admin panel with user management, permissions, staff settings
- **Main Application** (`src/app/_metronic/layout/`) - Primary user interface using Metronic layout system

#### Key Architectural Patterns

**Lazy Loading**: All major features are lazy-loaded modules to optimize bundle size and performance.

**Service-Based Architecture**: Business logic centralized in services within `src/app/_fake/services/` directory, including:
- User management and profile services
- Knowledge base operations
- Meeting scheduling and notifications
- Geographic and industry data services
- Authentication and authorization services

**Guard-Based Route Protection**:
- `authGuard` - Protects authenticated routes
- `adminGuard` - Restricts admin-only sections  
- `companyGuard`, `insighterGuard` - Role-based access control
- `pendingChangesGuard` - Prevents navigation with unsaved changes

**Multi-Layout System**: 
- Metronic layout for main application (`/app` routes)
- Admin-specific layout for dashboard (`/admin-dashboard` routes)
- Authentication layout for login/registration (`/auth` routes)

#### Domain-Specific Features

**Knowledge Management Platform**: Core functionality revolves around:
- Knowledge base creation and management (`src/app/pages/add-knowledge/`, `src/app/pages/my-knowledge-base/`)
- Industry and consulting field categorization
- Document upload and file management
- User expertise and consulting services

**Cross-Domain Authentication**: 
- Configured for `*.foresighta.co` domain with cookie sharing
- Cross-domain authentication helper component for subdomain integration
- Environment-specific API endpoints (dev: localhost, prod: api.foresighta.co)

**Role-Based System**:
- Multiple user types: Insighter, Company, Admin
- Role-specific dashboards and navigation
- Permission-based feature access

### Environment Configuration

Development uses mock services (`isMockEnabled: true`) with local API endpoints. Production connects to `https://api.insightabusiness.com/api`.

Cookie configuration supports cross-subdomain authentication with secure settings for production deployment.

### Styling & Theming

Uses SCSS with Metronic's theme system. Main stylesheets:
- `src/theme.scss` - Metronic theme configuration
- `src/styles.scss` - Global application styles
- PrimeNG and Bootstrap CSS automatically included via angular.json

### Component Organization

**Reusable Components** (`src/app/reusable-components/`):
- File uploaders, geography selectors, industry selectors
- Shared tree components for hierarchical data
- Language switching and internationalization components

**Shared Services Pattern**: Business logic separated from components into dedicated service classes, enabling consistent data management and API communication across the application.

## **Badge Design**

✅ **Insighter Badge**

```
badge badge-light-success
```

✅ **Company / Company Insighter Role Badge**

```
badge badge-light-info
```

---

✅ **Main Color Used In the App**

```
text-info or bg-light-info ... -info thing.
```

## **⚠️ Error Handling**

- All errors are displayed using **toaster**

```
We extend KNOLDG-APP/src/app/modules/base.component.ts
Which has   showInfo(summary:string ='Info',detail: string='Info' ) {
    this.toastService.info(detail, summary);
  }

  showWarn(summary:string ='Warning',detail: string='Warning' ) {
    this.toastService.warning(detail, summary);
  }

  showSuccess(summary:string ='Success',detail: string='Success' ) {
    this.toastService.success(detail, summary);
  }

  showError(summary:string ='Error',detail: string='Error' ,life:number=5000) {
    this.toastService.warning(detail, summary, life);
  }

Which also has lang:string that can be 'en' or 'ar' so we know the current locale
```

- **API error response format** 👇

```
{
  "message": "Document language mismatch",
  "errors": {
    "file": [
      "Document language mismatch"
    ]
  }
}
```

- **Error handle method**👇

```
  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          this.showError(
            this.lang === "ar" ? "حدث خطأ" : "An error occurred",
            messages.join(", ")
          );
        }
      }
    } else {
      this.showError(
        this.lang === "ar" ? "حدث خطأ" : "An error occurred",
        this.lang === "ar" ? "حدث خطأ" : "An unexpected error occurred."
      );
    }
  }
} 
```

---

## **🌐 API Setup**

---

### **📩 Default Headers for Requests**

```

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';;
    });
  }
{
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Accept-Language':  this.currentLang,
  'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
}
```

---

## **🎨 Styling Libraries**

✅ PrimeNg

✅ Metronic

✅ Bootstrap

**Preferences:**

- Simple, elegant, and clean design (similar to **Vercel** website).
- No shadows.
- Light gray borders
- We can use metronic icons and themes

---