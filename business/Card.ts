import { Game } from './Game';
import { Player } from './Player';
import { Suit } from "./Suit";

export class Card {
    static Values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'Jack', 'Queen', 'King', 'Ace', 'Joker'].map(String);

    constructor(
        public game: Game,
        public suit: Suit,
        public value: number,
    ) { }

    greaterThan(card: Card) {}

    get melded() { return this.game.melds.some(meld => meld.cards.includes(this)) }
    get discarded() { return this.game.discards.includes(this); }
    get player() { return this.game.players.find(player => player.cards.includes(this)) as Player }
    get key() { return `${this.suit}.${this.value}`; }
    get Value() { return Card.Values[this.value] }
    get name() { return `${this.Value} of ${this.suit}` }
    get points() {
        return this.Value === 'Joker' && 50
            || this.Value === 'Ace' && 15
            || this.Value.length > 1 && 10
            || 5
    }
}
