import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { HorizontalComponent } from './horizontal/horizontal.component';
import { VerticalComponent } from './vertical/vertical.component';
import { WizardsRoutingModule } from './wizards-routing.module';
import { WizardsComponent } from './wizards.component';
import { Step1Component } from './steps/step1/step1.component';
import { Step2Component } from './steps/step2/step2.component';
import { Step3Component } from './steps/step3/step3.component';
import { Step4Component } from './steps/step4/step4.component';
import { Step5Component } from './steps/step5/step5.component';
import { SharedModule } from "../../_metronic/shared/shared.module";
import { ProgressBarModule } from 'primeng/progressbar';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { MessagesModule } from 'primeng/messages';
import { NodeService } from 'src/app/_fake/services/nodeService/nodeservice';
import { TranslationModule } from 'src/app/modules/i18n';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { TreeSelectModule } from 'primeng/treeselect';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { SharedTreeSelectorComponent } from 'src/app/reusable-components/shared-tree-selector/shared-tree-selector.component';
import { TruncateTextPipe } from 'src/app/pipes/truncate-pipe/truncate-text.pipe';
import { CountryDropdownComponent } from 'src/app/reusable-components/country-dropdown/country-dropdown.component';
import { PhoneNumberInputModule } from 'src/app/reusable-components/phone-number-input/phone-number-input.module';
import { AccountSettingsSharedModule } from 'src/app/pages/insighter-dashboard/insighter-dashboard/account-settings/account-settings-shared.module';
@NgModule({
  declarations: [
    HorizontalComponent,
    VerticalComponent,
    WizardsComponent,
    Step1Component,
    Step2Component,
    Step3Component,
    Step4Component,
    Step5Component,
  ],
  imports: [
    CommonModule,
    WizardsRoutingModule,
    TranslationModule,
    ReactiveFormsModule,
    FormsModule,
    ProgressBarModule,
    ProgressSpinnerModule,
    ToastModule,
    DialogModule,
    TreeSelectModule,
    TooltipModule,
    SharedTreeSelectorComponent,
    CountryDropdownComponent,
    DropdownModule,
    MessageModule,
    TruncateTextPipe,
    MultiSelectModule,
    MessagesModule,
    NgbTooltipModule,
    PhoneNumberInputModule,
    SharedModule,
    AccountSettingsSharedModule
  ],
  providers:[NodeService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]  // Add this line
})
export class WizardsModule {}
