import { Component, Input } from '@angular/core';
import { ProjectParty } from 'src/app/_fake/services/project-phase2/project-party.model';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-contract-party-card',
  templateUrl: './contract-party-card.component.html',
  styleUrl: './contract-party-card.component.scss',
})
export class ContractPartyCardComponent {
  @Input({ required: true }) party: ProjectParty;
  @Input() role: 'client' | 'insighter' = 'insighter';
  @Input() lang = 'en';
  @Input() signed: boolean | null = null;
  failedPhotoUrl: string | null = null;

  get profileUrl(): string | null {
    const uuid = this.role === 'insighter' ? this.party?.uuid?.trim() : null;
    const locale = this.lang === 'ar' ? 'ar' : 'en';
    return uuid ? `${environment.mainAppUrl}/${locale}/profile/${encodeURIComponent(uuid)}?entity=insighter` : null;
  }

  get roleLabel(): string {
    return this.role === 'client'
      ? (this.lang === 'ar' ? 'العميل' : 'Client')
      : (this.lang === 'ar' ? 'الخبير' : 'Insighter');
  }

  get displayName(): string {
    return this.party?.name?.trim() || this.roleLabel;
  }

  get initials(): string {
    const words = this.displayName.split(/\s+/);
    return (words[0].charAt(0) + (words.length > 1 ? words[words.length - 1].charAt(0) : '')).toUpperCase();
  }
}
