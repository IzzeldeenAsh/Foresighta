import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ViewMyKnowledgeComponent } from './view-my-knowledge/view-my-knowledge.component';
import { KnowledgeAnalyticsComponent } from './view-my-knowledge/knowledge-analytics/knowledge-analytics.component';
import { KnowledgeDetailsComponent } from './view-my-knowledge/knowledge-details/knowledge-details.component';
import { ViewMyPackagesComponent } from './view-my-packages/view-my-packages.component';

const routes: Routes = [
  {
    path: 'view-my-knowledge/:id',
    component: ViewMyKnowledgeComponent,
    data: {
      breadcrumb: [
        { label: 'My library', link: '/app/insighter-dashboard/my-knowledge/general' },
        { label: 'View Knowledge', link: '' }
      ]
    },
    children: [
      { path: '', redirectTo: 'details', pathMatch: 'full' },
      { path: 'details', component: KnowledgeDetailsComponent },
      { path: 'analytics', component: KnowledgeAnalyticsComponent }
    ]
  },
  {
    path:'view-my-packages/:id',
    component:ViewMyPackagesComponent,
    data: {
      breadcrumb: [
        { label: 'My library', link: '/app/insighter-dashboard/my-knowledge/general' },
        { label: 'View Knowledge', link: '' }
      ]
    },
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MyKnowledgeBaseRoutingModule { }
