import { Component, Injector, OnInit } from "@angular/core";
import {
  IKnoldgProfile,
} from "src/app/_fake/models/profile.interface";
import { AuthService } from "src/app/modules/auth";
import { BaseComponent } from "src/app/modules/base.component";
import { ProfileService } from "src/app/_fake/services/get-profile/get-profile.service";

@Component({
  selector: "app-profile",
  templateUrl: "./profile.component.html",
  styleUrl: "./profile.component.scss",
})
export class ProfileComponent extends BaseComponent implements OnInit {
  profile: IKnoldgProfile;
  constructor(
    private auth: AuthService,
    injector: Injector,
    private getProfileService: ProfileService
  ) {
    super(injector);
  }
  ngOnInit(): void {
    this.listenToProfileUpdates();
    this.getProfile();
  }

  private listenToProfileUpdates(): void {
    const profileStateSub = this.getProfileService.profile$.subscribe((profile) => {
      if (profile) {
        this.profile = profile;
      }
    });
    this.unsubscribe.push(profileStateSub);
  }

  getProfile() {
    const getProfileSub = this.getProfileService.getProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
      },
      error: (error) => {},
    });
    this.unsubscribe.push(getProfileSub);
  }

  reloadAPI() {
    const sub = this.getProfileService.refreshProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
      },
      error: () => {
        this.getProfile();
      },
    });
    this.unsubscribe.push(sub);
  }
}
