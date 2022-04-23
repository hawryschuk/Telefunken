import { Terminal, TerminalActivity, BaseService, Table } from '@hawryschuk/terminals';
import { Util } from '@hawryschuk/common';
import { Suit } from "./Suit";
import { Card } from "./Card";
import { Player, RobotTerminal } from "./Player";
import { Meld } from './Meld';

export class Game extends BaseService {
    bought = false;
    drew?: Card;
    discards: Card[] = [];
    handsPlayed = 0;
    currentPlayer!: Player;
    players: Player[];
    perspective: number = 0;
    cards: Card[] = Object
        .values(Suit)
        .reduce((cards, suit) => {                                                                      // 4 suits
            for (const i of [1, 2])                                                                     // 2 decks
                cards = cards.concat(
                    new Array(13).fill(0).map((_, index) => new Card(this, suit, index))                // 13 cards
                )
            return cards;
        }, [] as Card[])
        .concat([1, 2, 3, 4].map(() => new Card(this, null as any, 13)));                               // 4 jokers

    constructor({
        id,
        table = null as any,
        terminals = [],
        history = [],
    } = {} as {
        id?: string;
        table?: Table;
        terminals?: Terminal[];
        history?: TerminalActivity[];
    }) {
        super({ id, table });
        this.players = new Array(4)
            .fill(0)
            .map((_, index) => {
                return new Player({
                    game: this,
                    cards: [],
                    terminal: terminals[index],
                    name: terminals[index] instanceof RobotTerminal && `Robot ${index + 1}` || `Player ${index + 1}`
                });
            });
        this.history = history;
    }

    set Terminals(terminals: Terminal[]) {
        terminals.forEach((t, i) => {
            if (t) {
                this.players[i].terminal = t;
                this.players[i].name = t.input.name;
            }
        });
    }

    async broadcast(message: any) {
        await Promise.all(this.players.map(async player => {
            await player.terminal.send(message);
        }))
    }

    /** transfer a terminal log to this game - reflecting a remote state */
    get history() { return this.myPlayer.terminal.history }
    set history(lines: TerminalActivity[]) {
        lines ||= [];
        this.reset();
        if (lines.length) {
            let cardCounts = this.players.map(() => 11);
            for (const line of lines) {
                const { type, message = '', options } = line;
                const index = lines.indexOf(line);
                if (!this.history.length || message === 'Round 1 begins with a discard of 9 of spades') debugger;

                this.players.forEach(p => p !== this.myPlayer && (p.cards = []));

                const getCardFromPlayerHand = (name: string) => {
                    const card = Util.findWhere(this.currentPlayer.cards, { name }) as Card;
                    if (!card) throw new Error(`cannot find ${name} in player hand (${this.currentPlayer.cards.length})\n${this.currentPlayer.cards.map(c => c.name).sort().join('\n')}`)
                    return card;
                }

                const givePlayerCards = (names: string[], fromDeckOnly = false) => {
                    const allCards = [...(fromDeckOnly ? [] : this.currentPlayer.cards), ...this.deck,];
                    const cards = names.reduce((cards, name) => {
                        const card = allCards.find(card => card.name === name && !cards.includes(card)) as Card;
                        if (!card) throw new Error('card not there: ' + name + ' of ' + names.join(',') + ' from ' + this.currentPlayer.cards.map(c => c.name).sort().join(', '))
                        return [...cards, card]
                    }, [] as Card[]);
                    for (const card of cards)
                        if (!this.currentPlayer.cards.includes(card))
                            this.currentPlayer.cards.push(card);
                    return cards;
                }

                if (message === 'A telefunken game has just begun') {
                    this.reset();
                }

                const roundBegins = /^Round (\d+) begins with a discard of (.+)$/.exec(message) as string[];
                if (roundBegins) {
                    cardCounts = this.players.map(() => 11);
                    this.players.forEach(p => { p.cards = [] });
                    this.discards = [];
                    this.handsPlayed = parseInt(roundBegins[1]) - 1;
                    this.discards.push(this.deck.find(c => c.name === roundBegins[2]) as Card);
                }

                const nameNumberCards = /^(.+) \(#(\d+)\), here are your cards:([^]+)$/.exec(message) as string[];
                if (nameNumberCards) {
                    this.perspective = parseInt(nameNumberCards[2]) - 1;
                    this.currentPlayer = this.myPlayer;
                    cardCounts[this.currentPlayer.index] = 0;
                    for (const name of nameNumberCards[3].match(/(\S+) of (\S+)/g) || []) {
                        givePlayerCards([name], true);
                        cardCounts[this.currentPlayer.index]++;
                    }
                }

                const playerDrewCard = /^(.+) \(#(\d+)\) drew a card$/.exec(message) as string[];
                if (playerDrewCard) {
                    this.currentPlayer = this.players[parseInt(playerDrewCard[2]) - 1];
                    this.currentPlayer.name = playerDrewCard[1];
                    cardCounts[this.currentPlayer.index]++;
                }

                const [, youDrew] = /^You drew the (.+)$/.exec(message) || [];
                if (youDrew) {
                    const [card] = givePlayerCards([youDrew], true);
                    this.drew = card;
                }

                const playerDiscarded = /^.+ \(#(\d+)\) discarded the (.+)$/.exec(message);
                if (playerDiscarded) {
                    const [card] = givePlayerCards([playerDiscarded[2]]);
                    cardCounts[this.currentPlayer.index]--;
                    this.drew = card;
                    this.discards.push(card);
                    Util.removeElements(this.currentPlayer.cards, card);
                    this.currentPlayer = this.currentPlayer.nextPlayer;
                    this.drew = null as any;
                }

                const playerMelded = /^.+ \(#(\d+)\) melded (.+)$/.exec(message);
                if (playerMelded) {
                    const cards: Card[] = givePlayerCards(playerMelded[2].match(/(\S+) of ([a-z]+)/g) || []);
                    cardCounts[this.currentPlayer.index] -= cards.length;
                    this.meld(cards);
                }

                const [, score] = /^Score:\n([^]+)$/.exec(message) || [];
                if (score) {
                    const scores = score.match(/: (\d+)(\n|$)/g) as string[];
                    scores.forEach((score, index) => this.players[index].score = parseInt((/(\d+)/.exec(score) || [])[1]));
                }
            }
            cardCounts.forEach((count, index) => {
                if (this.players[index].cards.length > count) throw new Error(`${this.players[index].name} has too many cards: ${this.players[index].cards.map(c => c.name).join(',')}`)
                while (this.players[index].cards.length < count)
                    this.players[index].cards.push(this.deck[0])
            });
        }
    }

    set names(names: string[]) { this.players.forEach((player, index) => player.name = names[index] || `Player ${index + 1}`) }

    get winners() {
        const lowestScore = Math.min(... this.players.map(p => p.score));
        return Util.where(this.players, { score: lowestScore }) as Player[]
    }

    get losers() {
        return this.players.filter(player => !this.winners.includes(player));
    }

    get myPlayer() { return this.players[this.perspective] }

    get isItMyTurn() { return this.currentPlayer === this.myPlayer }

    get playersInPerspective() {
        const arr = [...this.players, ...this.players].slice(this.perspective % this.players.length, this.perspective + this.players.length);
        if (arr.length !== 4) debugger;
        return arr;
    }

    get round() { return this.handsPlayed + 1 }
    get finished() { return this.handsPlayed === 7; }
    get discarded() { return this.discards[this.discards.length - 1] }
    get deck() { return this.cards.filter(card => !card.player && !card.melded && !card.discarded) }

    reset() {
        this.handsPlayed = 0;
        this.players.forEach(player => player.reset());
        this.deal();
    }

    deal() {
        this.bought = false;
        this.drew = undefined;
        this.discards = [];
        this.melds = [];
        const cards: Card[] = Util.shuffle(this.cards);
        this.currentPlayer = this.players[this.handsPlayed % this.players.length];
        this.players.forEach((player, index) => { player.cards = cards.slice(index * 11, (index + 1) * 11); });
        this.discards.push(this.deck[0]);
    }

    /** @example getCard('8 of spades'), getCard(Suit.SPADES,8), getCard(6,Suit.SPADES) */
    getCard(suit: Suit | string, value?: number | string): Card {
        return Util.findWhere(this.cards,
            / of /.test(suit) && { name: suit }                         // getCard('8 of spades)
            || typeof value === 'string' && { suit, Value: value }      // getCard('8','spades)
            || { suit, value }                                          // getCard(6,'spades')
        ) as Card;
    }

    get status() {
        return this.finished && 'finished'
            || this.currentPlayer.terminal.prompts.buy && 'buy'
            || this.players.some(player => player.terminal.prompts.meld) && 'meld'
            || this.currentPlayer.terminal.prompts.discard && 'discard'
            || this.currentPlayer.canBuy && 'buy-or-draw'
            || !this.drew && 'draw'
            || 'meld-or-discard'
    }

    draw() {
        if (this.drew) throw new Error('already-drew');
        if (!this.deck[0]) throw new Error('deck-empty');
        this.drew = this.deck[0];
        this.currentPlayer.cards.push(this.drew);
    }

    async meld(cards: Card[]) {
        if (!cards.every(c => c.player === this.currentPlayer)) throw new Error('not-your-cards')       // cards owned by current player
        if (cards.length === this.currentPlayer.cards.length) throw new Error('cannot-meld-all-cards')  // prevent melding all cards
        const merger: Meld = (cards.length === 1 &&                                                     // merge-meld
            this.currentPlayer.melded > 0                                                               // player has melded
            && !!this.drew                                                                              // drawn a card
            && this.melds.find(meld => !(new Meld([...meld.cards, ...cards]).invalid))) as Meld;        // valid when merged
        if (merger) {
            merger.cards.push(...cards);
            Util.removeElements(this.currentPlayer.cards, ...cards);
        } else {
            const meld = new Meld(cards);
            if (meld.invalid) throw new Error(meld.invalid);
            this.melds.push(...(meld.doubleCuatro || meld.doubleTrio || meld.sequence4trio || [meld]));
            Util.removeElements(this.currentPlayer.cards, ...cards);
        }
    }

    melds: Meld[] = [];

    /** Auto :: Performs the single step action in the service loop */
    async auto(): Promise<any> {
        const game = this;

        const displayCards = async () => {
            await this.broadcast(`Round ${this.round} begins with a discard of ${this.discarded.name}`)
            for (const player of game.players)
                await player.terminal.send(`${player.name} (#${game.players.indexOf(player) + 1}), here are your cards:\n${player.cards.map(card => `\t${card.name}`).join('\n')}`)
        }

        if (!this.currentPlayer.terminal.history.find(i => i.message === 'A telefunken game has just begun')) {
            await this.broadcast('A telefunken game has just begun');
            await displayCards();
        }

        // would the current player, or any other player, like to buy the discard
        for (const player of [...this.players, ...this.players].slice(this.players.indexOf(this.currentPlayer), this.players.length)) {
            if (player.canBuy && await player.terminal.prompt({
                name: 'buy',
                message: 'Would you like to buy the discard: ' + game.discarded.name,
                type: 'confirm'
            })) {
                // buy the card
                await this.broadcast(`${player.name} (#${player.index + 1}) bought the discard`)
                player.buy();
                break;
            }
        }

        // draw a card
        this.draw();
        await this.broadcast(`${this.currentPlayer.name} (#${this.currentPlayer.index + 1}) drew a card`)
        await this.currentPlayer.terminal.send(`You drew the ${this.currentPlayer.cards.slice(-1)[0].name}`);

        // what would you like to meld
        let meld!: number[];
        do {
            meld = await game.currentPlayer.terminal.prompt({
                name: 'meld',
                message: 'Which cards would you like to meld?',
                type: 'multiselect',
                choices: [...this.currentPlayer.cards]
                    .sort((a, b) => a.value - b.value)
                    .map((card) => ({
                        title: card.name,
                        value: this.currentPlayer.cards.indexOf(card)
                    }))
            });
            if (meld?.length) {
                const cards = meld.map(index => this.currentPlayer.cards[index]);
                await this
                    .meld(cards)    // meld the cards
                    .then(() => this.broadcast(`${this.currentPlayer.name} (#${this.currentPlayer.index + 1}) melded ${cards.map(card => card.name).join(', ')}`))
                    .catch(error => {
                        // console.error({ error })
                        return game.currentPlayer.terminal.send(`error: ${error.message}`);
                    });
            }
        } while (meld?.length);

        // what would you like to discard
        let card = '';
        do {
            card = await game.currentPlayer.terminal.prompt({
                name: 'discard',
                message: 'Which card would you like to discard?',
                type: 'select',
                choices: [...game.currentPlayer.cards].sort((a, b) => a.value - b.value).map(card => ({
                    title: card.name,
                    value: card.name
                }))
            });
            if (card) {
                const round = game.round;
                await game.broadcast(`${game.currentPlayer.name} (#${game.currentPlayer.index + 1}) discarded the ${card}`);
                game.discard(game.currentPlayer.getCard(card));
                if (game.round !== round) {
                    await game.broadcast(`Round ${round} is over`);
                    await game.broadcast(`Score:\n${game.players.map(player => `\t${player.name}: ${player.score}`).join('\n')}`);
                    if (!game.finished) await displayCards();
                }
            } else {
                await Util.pause(250);
            }
        } while (!card);

        if (game.finished) {
            await game.broadcast(`Game over: ${this.winners.map(winner => `${winner.name}`).join(' and ')} wins`)
            return {
                winners: game.winners.map(player => player.name),
                losers: game.losers.map(player => player.name)
            }
        }
    }

    /** used for testing to ensure the restored saved state resembles the saved state */
    get state() {
        return {
            cards: this.myPlayer.cards.map(c => c.name),
            deck: this.deck.length,
            bought: this.bought,
            currentPlayer: this.players.indexOf(this.currentPlayer),
            discarded: this.discarded.name,
            discards: this.discards.map(d => d.name),
            finished: this.finished,
            handsPlayed: this.handsPlayed,
            history: this.history,
            isItMyTurn: this.isItMyTurn,
            losers: this.losers.map(w => w.name),
            melds: this.melds.map(m => m.cards.map(c => c.name)),
            paused: this.paused,
            perspective: this.perspective,
            players: this.players.map(p => ({
                name: p.name,
                buys: p.buys.map(({ round, card: { name } }) => ({ name, round })),
                canBuy: p.canBuy,
                cards: p.cards.length,
                melded: p.melded,
                score: p.score,
            })),
            round: this.round,
            status: this.status,
            winners: this.winners.map(w => w.name),
        }
    }

    get promptedPlayer(): Promise<Player> { return Util.waitUntil(() => this.players.find(p => p.terminal.prompted), { pause: 1 }); }

    discard(card: Card) {
        if (!this.drew) throw new Error('must-draw');
        if (!this.currentPlayer.cards.includes(card)) throw new Error('not-your-card');
        this.discards.push(card);
        this.bought = false;
        this.drew = undefined;
        Util.removeElements(this.currentPlayer.cards, card);
        if (!this.currentPlayer.cards.length || !this.deck.length) {
            for (const player of this.players) player.score += player.points;
            this.handsPlayed++;
            if (!this.finished) this.deal();
        } else {
            this.currentPlayer = this.currentPlayer.nextPlayer;
        }
    }
}

