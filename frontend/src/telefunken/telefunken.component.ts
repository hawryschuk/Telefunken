import { CommonModule } from '@angular/common';
import { Component, computed, input, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { ServiceCenterClient, Terminal, TerminalActivity, WebTerminal } from '@hawryschuk-terminal-restapi';
import { Util } from '@hawryschuk-common/util';
import { BehaviorSubject, interval, of, Subject } from 'rxjs';
import { concatMap, debounce, debounceTime, delay, filter, map, reduce, takeUntil, takeWhile } from 'rxjs/operators';
import { Card, GamePlay, TelefunkenGame } from '../../../business/TelefunkenGame';
import { onTerminalUpdated } from '@hawryschuk-terminal-restapi/frontend/src/app/terminal/onTerminalUpdated';
import { CardComponent } from 'Spades/frontend/src/app/card/card.component';

@Component({
  imports: [CommonModule, CardComponent],
  selector: 'app-telefunken',
  templateUrl: './telefunken.component.html',
  styleUrls: ['./telefunken.component.scss'],
  standalone: true,
})
export class TelefunkenComponent {
  Number = Number;
  TelefunkenGame = TelefunkenGame;
  terminal = input.required<Terminal>();
  error = '';
  prompts!: Terminal['prompts'];
  selected: Card[] = [];

  private updated$ = onTerminalUpdated({
    component: this,
    terminal: this.terminal,
    handler: () => {
      this.prompts = this.terminal().prompts;
      // this.error = this.terminal().history.map(i => i.stdout?.error?.message).pop();
    },
  });

  constructor() { Object.assign(window, { telefunken: this, Util }); }

  get client() { return ServiceCenterClient.getInstance<GamePlay>(this.terminal()); }
  get game() { return this.game$() }; private game$ = computed(() => this.updated$() && this.Game);
  get Game() {
    const { users, messages } = this.client.Service!.Instance!;
    const game = new TelefunkenGame(users, messages, this.client.UserName);
    if ((globalThis as any).doDebug) debugger;
    return game;
  }

  get cards() { return this.game.player!.cards; }
  get melds() { return this.game.melds }
  get players() { return this.game.players; }
  get status() {
    const status = (!Object.keys(this.prompts || {}).length || (Object.keys(this.prompts || {}).length == 1 && this.prompts.menu)) && 'waiting'
      || this.prompts.buy && 'buy'
      || this.prompts.meld && 'meld or discard'
      || this.prompts.discard && 'discard'
      || this.game.finished && 'finished';
    if (!status && this.prompts) debugger;
    return status;
  }

  buy(buy: boolean) { if (this.prompts.buy) this.terminal().answer({ buy }); }

  async meld() {
    debugger;
    this.selected = []; this.error = '';
    try { this.game.meld(this.selected); }
    catch (e: any) { console.log(e); return this.error = e.message; }
    await this.terminal().answer({ meld: [this.selected.map(card => this.game.player!.cards.indexOf(card))] });
  }

  isSelected(card: Card) { return this.selected.includes(card) }

  async discard(card = this.selected[0]) {
    this.error = '';
    this.selected = [];
    if (this.prompts.meld) await this.terminal().answer({ meld: [[]] });
    try { this.game.discard(card); }
    catch (e: any) { console.log(e); return this.error = e.message; }
    await this.terminal().answer({ discard: card });
  }

  async onClick(card: Card) {
    event?.preventDefault();
    event?.stopPropagation();
    console.log('clicked', event, card)
    if (this.prompts.meld || this.prompts.discard) {
      this.selected.includes(card)
        ? Util.removeElements(this.selected, card)
        : this.selected.push(card);
      if (this.prompts.discard) {
        Util.removeElements(this.selected, ...this.selected.filter(i => i !== card));
      }
    }
  }
}
