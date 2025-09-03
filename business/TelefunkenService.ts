import { Util } from '@hawryschuk-common/util';
import { BaseService } from '@hawryschuk-terminal-restapi';
import { TelefunkenGame, GamePlay, Card } from './TelefunkenGame';
import { TelefunkenRobot } from './TelefunkenRobot';

export class TelefunkenService extends BaseService {
    static override USERS = [3, 4, 5, 6];
    static override NAME = 'Telefunken';
    static override ROBOT = TelefunkenRobot;

    async start() {
        const game = new TelefunkenGame(this.table.sitting.map(t => t.input.Name));
        while (!game.finished) {
            // send the discard
            await this.broadcast<GamePlay>({ startDiscard: game.discarded });

            // send the cards
            await Promise.all(game.players.map(player => this.send<GamePlay>({ cards: player.cards }, [player.name])));

            // buy the initial discard
            for (let i = 1, player = game.turn; i <= game.players.length && game.discarded; i++, player = game.after(player)) {
                if (await this.prompt(player.name, {
                    name: 'buy',
                    message: `buy initial discard`,
                    type: 'confirm'
                })) {
                    await this.broadcast<GamePlay>({ bought: game.discarded, name: player.name });
                    player.buy();
                }
            }

            // give each player a turn to draw, meld, discard
            const score = game.players.map(p => p.score);
            let turns = 0;
            while (Util.equals(score, game.players.map(p => p.score))) {
                const player = game.turn;
                const before = player.cards.length;

                if (turns++ && await this.prompt(player.name, {
                    name: 'buy',
                    message: `buy discard`,
                    type: 'confirm'
                })) {
                    await this.broadcast<GamePlay>({ bought: game.discarded, name: player.name });
                    player.buy();
                }

                const drawn = game.deck.pop();
                if (drawn) {
                    player.cards.push(drawn);
                    await this.broadcast<GamePlay>({ drew: true, name: player.name });
                    await this.send<GamePlay>({ youDrew: drawn, name: player.name }, [player.name]);
                } else {
                    console.log('the deck popped nothing');
                    debugger;
                }

                if (player.cards.length !== before + 1) debugger;

                // what would you like to meld
                await Util.retry({
                    onError: async (e: any) => { console.error(e); debugger; this.send({ type: 'error', message: e.message }, [player.name]) },
                    block: async () => {
                        const choices = player.cards
                            .map((card, index) => ({ title: `${card.suit}${card.value}`, value: index }))
                            .sort((a, b) => a.title.localeCompare(b.title));
                        const meld = await this.prompt(player.name, {
                            name: 'meld',
                            type: 'multiselect',
                            choices
                        });
                        if (meld.length) {
                            const cards: Card[] = meld.map((index: number) => player.cards[index]);
                            game.meld(cards);
                            await this.broadcast<GamePlay>({ melded: cards, name: player.name });
                        }
                    }
                });

                // what would you like to discard
                await Util.retry({
                    onError: async (e: any) => { console.error(e); debugger; this.send({ type: 'error', message: e.message }, [player.name]) },
                    block: async () => {
                        const discard = await Util.waitUntil(() => this.prompt(player.name, {
                            name: 'discard',
                            type: 'select',
                            choices: player.cards.map(card => ({ title: `${card.suit}${card.value}`, value: card }))
                        }));
                        game.discard(discard);
                        await this.broadcast({ name: player.name, discard });
                    }
                });

                if (player.cards.length !== before) debugger;

                if (player.cards.length === 10) debugger;
            }

            // send the players their updated score
            for (const player of game.players) {
                await this.broadcast<GamePlay>({ scores: player.score, name: player.name });
            }
        }
        return {
            winners: game.winners.map(name => this.table.sitting[game.players.indexOf(name)]),
            losers: game.losers.map(name => this.table.sitting[game.players.indexOf(name)]),
        };
    }
}
