import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'notificationsLinks',
  standalone: true
})
export class NotificationsLinksPipe implements PipeTransform {

  transform(value: string, parent?: string): string {
    if (parent === 'admin' || parent === 'staff') {
      return '/admin-dashboard/admin/dashboard/main-dashboard/requests';
    }
    
    if (value === 'requests') {
      return '/app/insighter-dashboard/my-requests';
    }

    if (value === 'project_proposal_offer') {
      return '/app/insighter-dashboard/project-offers';
    }
    
    return '/app/insighter-dashboard/my-dashboard';
  }

}
