import { Card, TelefunkenGame } from './TelefunkenGame';
import { Util } from '@hawryschuk-common/util';

export class Player {
    discards: Card[] = [];
    cards: Card[] = [];
    score = 0;
    buys: Card[][] = [];

    constructor(public name: string, public game: TelefunkenGame) { }

    get melded() { return Util.where(this.game.melds, { player: this, round: this.game.handsPlayed + 1 }).length > 0 }

    get buysThisHand() { return this.buys[this.game.handsPlayed]; }

    get index() { return this.game.players.indexOf(this); }
    get nextPlayer() { return this.game.players[(this.index + 1) % 4]; }
    get points() { return this.cards.reduce((score, card) => score + TelefunkenGame.Points(card.value), 0) }
    get canBuy() {
        return this.game.round > 1                                          // 0 buys in round 1 - house rule
            && this.game.discarded
            && this.buysThisHand.length < (this.game.round <= 3 ? 1 : 2)    // house rule - 1 buy max in round2/3, and 2 buys max in round4+
            && !this.melded                                                 // official rule - has not melded
            && !this.game.drew                                              // a card has not been drawn
        // TODO: cannot buy two of the same value   - house rule
        // TODO: total of 12 buys per game          - house rule
    }

    buy() {
        if (!this.canBuy) throw new Error('cannot-buy');
        const card = this.game.discards.pop()!;
        this.buys[this.game.round].push(card);
        this.cards.push(card);
    }
}
