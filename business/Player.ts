import { Game } from './Game';
import { Card } from "./Card";
import { TerminalActivity, Terminal, WebTerminal } from '../../@hawryschuk-terminal-restapi';
import { Meld } from './Meld';
import { Util } from '@hawryschuk/common';

export class VacantTerminal extends Terminal {
    constructor({
        history = [] as TerminalActivity[],
    } = {}) {
        super({ history });
    }
}

export class RobotTerminal extends Terminal {
    get player() { return (this as any)[Symbol.for('player')] }
    constructor({ player } = {} as { player: Player }) {
        super();
        (this as any)[Symbol.for('player')] = player;
        this.subscribe({
            handler: async (last = this.last) => {
                if (last?.type === 'prompt' && !('resolved' in (last.options || {}))) {
                    const { options: { name, message, choices } } = last as any;
                    if (/What is your name\?$/.test(message)) {
                        this.respond('Player');
                    } else if (/Would you like to play again\?$/.test(message)) {
                    } else if (name === 'meld') {
                        this.respond([]);
                    } else if (name === 'buy') {
                        this.respond(false)
                    } else if (name === 'discard') {
                        this.respond(choices[0].value)
                    } else {
                        console.error('dunno how to respond to', last)
                        debugger;
                        this.respond(null);
                    }
                }
            }
        });
    }
}

const TerminalTypes = { Terminal, WebTerminal, RobotTerminal, VacantTerminal };

export class Player {
    name!: string;
    game!: Game;
    cards!: Card[];
    terminal!: Terminal;
    score!: number;
    buys!: { round: number; card: Card }[];

    reset() { Object.assign(this, { score: 0, buys: [], cards: [] }) }

    constructor({
        game, cards = [], name, terminal, score = 0, buys = []
    } = {} as {
        name: string;
        game: Game;
        cards?: Card[];
        terminal?: Terminal;
        score?: number;
        buys?: { round: number; card: Card }[];
    }) {
        Object.assign(this, { name, game, cards, terminal: terminal || new RobotTerminal({ player: this }), score, buys });
    }

    get melded() { return Util.where(this.game.melds, { player: this }).length }
    get buysThisHand() { return Util.where(this.buys, { round: this.game.round }) }
    get isRobot() { return this.terminal instanceof RobotTerminal }
    get type() { return Object.keys(TerminalTypes).find(k => this.terminal.constructor.name == (TerminalTypes as any)[k].name); }
    get index() { return this.game.players.indexOf(this); }
    get nextPlayer() { return this.game.players[(this.index + 1) % 4]; }
    get points() { return this.cards.reduce((score, card) => score + card.points, 0) }
    get canBuy() {
        const card = this.game.discarded;
        return this.game.round > 1                                          // 0 buys in round 1
            && !this.game.bought                                            // discard hasnt been bought
            && this.buysThisHand.length < (this.game.round <= 3 ? 1 : 2)    // 1 buy max in round2/3, and 2 buys max in round4+
            && !this.melded                                                 // has not melded
            && !this.game.drew                                              // a card has not been drawn
        // TODO: cannot buy two of the same value
        // TODO: total of 12 buys per game
    }

    getCard(name: string): Card { return Util.findWhere(this.cards, { name }) as Card }

    buy() {
        if (!this.canBuy) throw new Error('cannot-buy');
        const card = this.game.discarded;
        if (this.canBuy) {
            this.buys.push({ card, round: this.game.round });
            this.cards.push(card);
            this.game.bought = true;
            for (let i = 1; i <= 2 && this.game.deck.length; i++)
                this.cards.push(this.game.deck[0]);
        }
    }
}
