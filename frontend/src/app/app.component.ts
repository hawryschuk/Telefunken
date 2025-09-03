import { Component, OnInit } from '@angular/core';
import { Terminal, ServiceCenterClient, ServiceCenter } from '@hawryschuk-terminal-restapi';
import { ServiceCenterComponent } from '@hawryschuk-terminal-restapi/frontend/src/app/service-center/service-center.component';
import { TelefunkenService } from "../../../business/TelefunkenService";
import { CommonModule } from '@angular/common';
import { Util } from '@hawryschuk-common/util';
import { TelefunkenComponent } from 'src/telefunken/telefunken.component';
import { TelefunkenGame } from '../../../business/TelefunkenGame';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ServiceCenterComponent, TelefunkenComponent],
  providers: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  terminal = new Terminal;
  terminals = [this.terminal];
  serviceCenter = new ServiceCenter().register(TelefunkenService);
  get client() { return ServiceCenterClient.getInstance(this.terminal); }
  get game() { return (window as any).telefunken as TelefunkenGame }

  async ngOnInit() {
    Object.assign(window, { app: this, Util });
    await this.serviceCenter.join(this.terminal);
    await this.terminal.answer({
      name: 'alex',
      service: TelefunkenService.NAME,
      seats: 4,
      menu: [
        'Create Table',
        'Invite Robot',
        'Sit',
        'Invite Robot',
        'Invite Robot',
        'Ready',
      ],
    });
    return;
    await Util.waitUntil(() => this.game);
    while (!this.game.finished) {
      await Util.waitUntil(() => this.game.finished || this.terminal.prompts.buy || this.terminal.prompts.discard || this.terminal.prompts.meld, { pause: 50 });
      if (this.terminal.prompts.buy) await this.terminal.answer({ buy: false });
      if (this.terminal.prompts.meld) await this.terminal.answer({ meld: [[]] });
      if (this.terminal.prompts.discard) await this.terminal.answer({ discard: this.terminal.prompts.discard[0].choices![0].value });
    }
  }
}
