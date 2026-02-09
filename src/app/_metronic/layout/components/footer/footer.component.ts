import { Component, Injector, Input } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent extends BaseComponent {
  @Input() appFooterContainerCSSClass: string = '';

  currentDateStr: string = new Date().getFullYear().toString();
  constructor(injector: Injector) {
    super(injector);
  }
  getFooterLink(): string {
    const url= 'https://insightabusiness.com/' + this.lang;
    return url;
  }
}
