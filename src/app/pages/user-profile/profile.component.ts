import { MessageService } from "primeng/api";
import { Component, Injector, OnInit } from "@angular/core";
import {
  IClient,
  IForsightaProfile,
} from "src/app/_fake/models/profile.interface";
import { ScrollAnimsService } from "src/app/_fake/services/scroll-anims/scroll-anims.service";
import { AuthService } from "src/app/modules/auth";
import { BaseComponent } from "src/app/modules/base.component";

@Component({
  selector: "app-profile",
  templateUrl: "./profile.component.html",
  styleUrl: "./profile.component.scss",
})
export class ProfileComponent extends BaseComponent implements OnInit {
  profile: IForsightaProfile;
  constructor(
    private auth: AuthService,
    injector: Injector
  ) {
    super(injector);
  }
  ngOnInit(): void {
    this.getProfile();
  }

  getProfile() {
    const getProfileSub = this.auth.getProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
      },
      error: (error) => {},
    });
    this.unsubscribe.push(getProfileSub);
  }

  reloadAPI() {
    this.getProfile();
  }
}
