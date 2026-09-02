import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { MyKnowledgeComponent } from './my-knowledge.component';
import { TranslationModule } from 'src/app/modules/i18n';
import { KnowledgeHeaderComponent } from './components/knowledge-header/knowledge-header.component';
import { DashboardNavIconComponent } from 'src/app/reusable-components/dashboard-nav-icon/dashboard-nav-icon.component';
import { GeneralComponent } from './components/general/general.component';
import { ScheduledComponent } from './components/scheduled/scheduled.component';
import { PostedComponent } from './components/posted/posted.component';
import { PackagesComponent } from './components/packages/packages.component';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from 'primeng/dragdrop';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { PackageBuilderContentComponent } from './components/package-builder-content/package-builder-content.component';
import { DialogModule } from 'primeng/dialog';
import { NgbDropdownModule, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule as MetronicSharedModule } from 'src/app/_metronic/shared/shared.module';
import { SharedModule } from 'src/app/shared/shared.module';
import { ScheduleDialogComponent } from './components/packages/schedule-dialog/schedule-dialog.component';
import { DynamicDialogModule } from 'primeng/dynamicdialog';
import { EditorModule } from '@tinymce/tinymce-angular';
import { UnpublishedComponent } from './components/unpublished/unpublished.component';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { TruncateTextPipe } from 'src/app/pipes/truncate-pipe/truncate-text.pipe';
import { KnowledgeFilterChipsComponent } from 'src/app/reusable-components/knowledge-filter-chips/knowledge-filter-chips.component';
import { ProgressBarModule } from 'primeng/progressbar';

const routes: Routes = [
  {
    path: '',
    component: MyKnowledgeComponent,
    children: [
      {
        path: '',
        redirectTo: 'general',
        pathMatch: 'full'
      },
      {
        path: 'general',
        component: GeneralComponent
      },
      {
        path: 'scheduled',
        component: ScheduledComponent
      },
      {
        path: 'unpublished',
        component: UnpublishedComponent
      },
      {
        path: 'posted',
        component: PostedComponent
      },
      {
        path: 'packages',
        component: PackagesComponent
      }
    ]
  },
 
];

@NgModule({
  declarations: [
    MyKnowledgeComponent,
    KnowledgeHeaderComponent,
    GeneralComponent,
    ScheduledComponent,
    UnpublishedComponent,
    PostedComponent,
    PackageBuilderContentComponent,
    PackagesComponent,
    ScheduleDialogComponent,
   
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    TooltipModule,
    TranslationModule,
    KnowledgeFilterChipsComponent,
    DashboardNavIconComponent,
    DropdownModule,
    DialogModule,
    InlineSVGModule,
    FormsModule,
    DragDropModule,
    NgbTooltip,
    ProgressBarModule,
    InputTextModule,
    MetronicSharedModule,
    SharedModule,
    NgbDropdownModule,
    DynamicDialogModule,
    EditorModule,
    TruncateTextPipe
  ]
})
export class MyKnowledgeModule { } 