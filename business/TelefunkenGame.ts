import { Util } from '@hawryschuk-common/util';
import { Player } from "./Player";
import { Meld } from './Meld';

export type Suit = typeof TelefunkenGame.CARD_SUITS[number];
export type CardValue = typeof TelefunkenGame.CARD_VALUES[number];
export type Card = { suit: Suit; value: CardValue; }

export type GamePlay = {
    name?: string;

    startDiscard?: Card;
    cards?: Card[];
    bought?: Card;
    drew?: boolean;
    youDrew?: Card;
    melded?: Card[];
    discard?: Card;
    scores?: number;
}

export class TelefunkenGame {
    static CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '*'] as const;
    static CARD_SUITS = ['H', 'D', 'C', 'S'] as const;
    static get Deck(): Card[] {
        const deck = [...Util.permutations({ suit: <any>this.CARD_SUITS, value: <any>this.CARD_VALUES })];
        const jokers = Util.where(deck, { value: '*' }).slice(0, 2);
        return Util.shuffle(Util.without(deck, jokers));
    }

    static CompareCards(a: Card, b: Card) { return this.Points(a.value) - this.Points(b.value) }

    static Points(value: CardValue) {
        return value === '*' && 50
            || value === 'A' && 15
            || (TelefunkenGame.CARD_VALUES.indexOf(value) >= TelefunkenGame.CARD_VALUES.indexOf('10')
                ? 10
                : 5)
    }

    activity: GamePlay[] = [];
    players: Player[];
    player?: Player;
    turn!: Player;
    deck!: Card[];
    discards: Card[] = [];
    melds: Meld[] = [];
    handsPlayed = 0;
    drew?: Card;

    get discarded() { return this.discards.at(-1)!; }
    set discarded(card: Card) { this.discards.push(card) }

    constructor(players: string[], activity: GamePlay[] = [], player?: string) {
        this.players = players.map(name => new Player(name, this));
        this.player = Util.findWhere(this.players, { name: player! })!;
        this.turn = this.players[0];
        this.createDeck();
        this.deal();
        for (const line of activity) this.push(line);
    }

    createDeck() { this.deck = new Array(Math.ceil(this.players.length / 2)).fill(undefined).reduce((cards) => [...cards, ...TelefunkenGame.Deck], [] as Card[]); }

    get finished() { return this.handsPlayed === 7; }

    after(player: Player) { return this.players[(1 + this.players.indexOf(player)) % this.players.length]; }

    get next() { return this.after(this.turn); }

    push(line: GamePlay) {
        this.activity.push(line);


        const GiveCard = ({ suit, value }: Card, destination: Card[], exceptions: Card[] = []) => {
            const location = [this.deck, ...Util.without(this.players, [this.player])
                .map(p => p.cards)]
                .find(p => p.find(card => !exceptions.includes(card) && card.suit === suit && card.value === value));
            if (!location) { debugger; throw new Error('card-dooes-not=exist'); }
            const card = Util.findWhere(location, { suit, value })!;
            if (!card) debugger;
            Util.removeElements(location, card);
            location.push(destination.pop()!);
            destination.push(card);
            return card;
        }

        const { name, startDiscard, cards, bought, drew, youDrew, melded, discard, scores } = line;
        const { turn } = this;
        const player = Util.findWhere(this.players, { name });

        if ((drew || youDrew || melded || discard) && turn.name !== name) { debugger; throw new Error('incorrect-turn'); }

        if (startDiscard) {
            if (this.discards.length !== 1) { debugger; throw new Error('should-have-initial-discard-on-deal'); }
            this.deck.push(this.discards.pop()!);
            this.discarded = GiveCard(startDiscard, this.deck);
            Util.removeElements(this.deck, this.discarded);
        }

        if (cards) {
            const total = this.players.reduce((t, p) => t + p.cards.length, 0) + this.deck.length + this.discards.length;

            if (!(this.players.every(p => p.cards.length === 11))) { debugger; throw new Error('invalid-deal-1'); }
            if (this.discards.length !== 1) { debugger; throw new Error('invalid-deal-2'); }
            this.createDeck();
            this.discards = [Util.findWhere(this.deck, this.discarded)!];
            Util.removeElements(this.deck, this.discarded);
            for (const player of this.players) player.cards = [];
            for (const card of cards) this.player!.cards.push(Util.findWhere(this.deck, card)!);
            Util.removeElements(this.deck, ...this.player!.cards);
            for (const player of Util.without(this.players, [this.player!])) player.cards = this.deck.splice(0, 11);

            const after = this.players.reduce((t, p) => t + p.cards.length, 0) + this.deck.length + this.discards.length;
            if (after !== total) debugger;

        }

        if (bought) {
            if (!Util.matches(this.discarded, bought)) { debugger; throw new Error('not-the-discard'); }
            this.turn.buy();
        }

        if (drew && this.turn !== this.player) {
            this.turn.cards.push(this.deck.pop()!);
        }

        if (youDrew) {
            const card = GiveCard(youDrew, this.deck);
            this.turn.cards.push(card);
            Util.removeElements(this.deck, card);
        }

        if (melded) {
            const cards: Card[] = [];
            for (const card of melded) {
                cards.push(this.turn === this.player
                    ? Util.findWhere(this.turn.cards, card)!
                    : GiveCard(card, this.turn.cards, cards)
                );
            }
            this.meld(cards);
        }

        if (discard) {
            if (this.player && turn.name !== this.player!.name) GiveCard(discard, turn.cards);
            this.discard(discard);
        }

        if (scores! >= 0) {
            player!.score = scores!;
        }
    }

    meld(cards: Card[]) {
        if (!cards.every(c => Util.findWhere(this.turn.cards, c))) {
            debugger; throw new Error('not-your-cards')
        }

        // cards owned by current player
        if (cards.length === this.turn.cards.length) {
            debugger; throw new Error('cannot-meld-all-cards')           // prevent melding all cards
        }

        const merger: Meld = (cards.length === 1 &&                                                             // merge-meld
            this.turn.melded                                                                                    // player has melded
            && !!this.drew                                                                                      // drawn a card
            && this.melds.find(meld => !(new Meld([...meld.cards, ...cards], this.turn).invalid))) as Meld;     // valid when merged
        if (merger) {
            merger.cards.push(...cards);
            Util.removeElements(this.turn.cards, ...cards);
        } else {
            const meld = new Meld(cards, this.turn);
            if (meld.invalid) { throw new Error(meld.invalid); }
            this.melds.push(...(meld.doubleCuatro || meld.doubleTrio || meld.sequence4trio || [meld]));
            Util.removeElements(this.turn.cards, ...cards);
        }
    }

    get book() {
        const index = Math.max(...this.players.map(p => p.discards.length - 1));
        return this.players.map(p => p.discards[index]);
    }

    discard({ value, suit }: Card) {
        const card = Util.findWhere(this.turn.cards, { value, suit })!;
        this.discards.push(card);
        this.turn.discards.push(card);
        Util.removeElements(this.turn.cards, card);
        this.turn = this.next;
        this.drew = undefined;
        if (this.players.some(p => !p.cards.length)) {
            this.handsPlayed++;
            for (const player of this.players) {
                player.score += player.points;
            }
            this.deal();
        }
    }

    deal() {
        this.drew = undefined;
        this.melds = [];
        this.createDeck();
        this.discards = [this.deck.pop()!];
        this.turn = this.players[this.handsPlayed % 4];
        for (const player of this.players) {
            player.discards = [];
            player.cards = this.deck.splice(0, 11);
        }
    }

    get round() { return this.handsPlayed + 1 }

    get winners() {
        const lowestScore = Math.min(... this.players.map(p => p.score));
        return Util.where(this.players, { score: lowestScore });
    }

    get losers() { return this.players.filter(player => !this.winners.includes(player)); }

}

