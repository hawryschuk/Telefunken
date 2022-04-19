import { expect } from 'chai';
import { Game } from "./Game";
import { Terminal } from "../../@hawryschuk-terminal-restapi/Terminal";
import { Util } from '@hawryschuk/common';
import { Player } from './Player';
import { Card } from './Card';
import { Meld } from './Meld';

describe('Spades Game', () => {
    /** Run tests in sequence playing out a full game (each subsequent test is dependent on the preceding one) */
    const game = new Game({ terminals: new Array(4).fill(0).map(() => new Terminal) });
    game.run();

    /** Take cards that havent been melded, but from the deck, discard pile, or other players hands, in order to be arranged in a players hand */
    const fetchCards = (names: string[]) => names.reduce((cards, name) => {
        return [...cards, game.cards.find(c => !c.melded && c.name === name && !cards.includes(c)) as Card]
    }, [] as Card[]);

    /** ARRANGE a player to have specific cards for the purpose of testing */
    const giveToPlayer = (cards: Card[], player = game.currentPlayer) => {
        for (const card of cards) {
            if (card.player) Util.removeElements(card.player.cards, card);
            if (card.discarded) Util.removeElements(game.discards, card);
        }
        player.cards.push(...cards);
    }

    /** ACT on an invalid meld in order ASSERT the error message */
    const invalidMeld = async (player = game.currentPlayer) => {
        const regex = /error: (.+)/;
        const line = player.terminal.history.length;
        await player.terminal.answer({ meld: [[0], []], discard: player.cards[0].name });
        const error = await Util.waitUntil(() => player
            .terminal
            .history.slice(line)
            .map(item => (regex.exec(item.message!) || [])[1])
            .filter(Boolean)
            .pop()
        );
        return error;
    }

    /** Have the player meld the cards and record what happened: melded, merged, error */
    const meld = async ({ melded, merged, player = game.currentPlayer, cards = [], expectedError, discard = true, } = {} as { player?: Player; cards: Card[]; expectedError?: string; discard: boolean; melded?: number; merged?: number }) => {
        cards.length && giveToPlayer(cards);
        await Util.waitUntil(() => player.terminal.prompts.meld);
        const { melded: meldedBefore, cards: { length: cardsBefroe } } = player;
        if (expectedError) {
            const line = player.terminal.history.length;
            await player.terminal.answer({ meld: [[0]] });
            await Util.waitUntil(() => player.terminal.prompts.meld);
            const error = player
                .terminal
                .history.slice(line)
                .map(item => (/error: (.+)/.exec(item.message!) || [])[1])
                .filter(Boolean)
                .shift();
            expect(error).to.equal(expectedError);
            expect(player.cards.length).to.equal(cardsBefroe);
            expect(player.melded).to.equal(meldedBefore);
        }
        if (cards.length)
            await player.terminal.answer({ meld: [cards.map(card => player.cards.indexOf(card))] });
        if (discard)
            await player.terminal.answer({ meld: [[]] });
        const results = () => ({
            melded: player.melded - meldedBefore,
            merged: player.melded === meldedBefore ? cardsBefroe - player.cards.length : 0,
        });
        if (cards.length)
            await Util.waitUntil(() => discard
                ? player.terminal.prompts.discard
                : Object.values(results()).some(Boolean)
            );
        if (discard) {
            await player.terminal.answer({ discard: player.cards[0].name })
            await Util.waitUntil(() => game.currentPlayer !== player);
        }
        if (typeof melded === 'number') expect(results().melded).to.equal(melded)
        if (typeof merged === 'number') expect(results().merged).to.equal(merged)
        return results();
    }

    it('Contains four players', () => { expect(game.players.length).to.equal(4) });

    it('knows the current player', () => { expect(game.currentPlayer === game.players[0]).to.be.ok })

    it('knows the next player', () => { expect(game.currentPlayer.nextPlayer === game.players[1]) })

    it('has 2 decks of cards with each deck having 2..10JQKA + 2 Jokers', () => { expect(game.cards.length).to.equal(54 * 2) });

    it('has dealt 11 cards to each player', async () => {
        await Util.waitUntil(() => game.currentPlayer.cards.length === 12);
        expect(game.currentPlayer.cards.length).to.equal(12)
        expect(game.currentPlayer.nextPlayer.cards.length).to.equal(11)
    });

    it('has a discard', () => {
        expect(game.discarded).to.be.ok;
    })

    it('has a deck of (108 cards - 11 cards per person - 1 discard - 1 drawn)', () => {
        expect(game.deck.length).to.equal((54 * 2) - (4 * 11) - 1 - 1);
    })

    it('does not prompt each player if they want to buy discard in the first round', async () => {
        expect(game.status).to.not.equal('buy');
        expect(game.players.every(player => !player.canBuy))
    });

    it('prompts the player to meld something', async () => {
        await game.currentPlayer.terminal.answer({ meld: [[]] });
    })

    it('prompts the player for a card to discard', async () => {
        await game.currentPlayer.terminal.answer({ discard: game.currentPlayer.cards[0].name });
    });

    it('becomes the next players turn after the current player discarded', () => {
        expect(game.currentPlayer === game.players[1])
    });

    it('ensures the first meld of round 1 is a pure-trio', async () => {
        await meld({
            expectedError: 'first-meld-round-1-pure-trio',
            cards: fetchCards(['3 of clubs', '3 of hearts', '3 of diamonds']),
            discard: false,
            melded: 1,
        });
    });

    it('allows melding single cards to merge with existing melds', async () => {
        await meld({
            cards: fetchCards(['Joker of null']),
            discard: false,
            merged: 1
        });
    });

    it('will not allow melding every card', async () => {
        expect(await game.meld(game.currentPlayer.cards).catch(e => e.message)).to.equal('cannot-meld-all-cards');
    });

    it('allows the player to meld sets of 3+', async () => {
        const player = game.currentPlayer;
        {
            const cards = fetchCards(['4 of clubs', '4 of hearts', 'Joker of null']);
            expect(new Meld(cards).type).to.equal('set-3')
            await meld({ cards, discard: false, melded: 1 })
        }

        {
            const cards = fetchCards(['5 of clubs', '5 of hearts', '5 of hearts']);
            expect(new Meld(cards).type).to.equal('set-3')
            await meld({ cards, discard: false, melded: 1 })
        }

    })

    it('allows the player to meld sequences of 3+', async () => {
        const player = game.currentPlayer;
        {
            const cards = fetchCards(['6 of clubs', '7 of clubs', '8 of clubs']);
            expect(new Meld(cards).type).to.equal('sequence-3')
            await meld({ cards, discard: false, melded: 1 })
        }
        {
            const cards = fetchCards(['6 of diamonds', '7 of diamonds', 'Joker of null']);
            expect(new Meld(cards).type).to.equal('sequence-3');
            await meld({ cards, discard: false, melded: 1 })
        }
        {
            const cards = fetchCards(['Ace of spades', 'Joker of null', '3 of spades']);// a23
            expect(new Meld(cards).type).to.equal('sequence-3');
            await meld({ cards, discard: false, melded: 1 })
        }
        {
            const cards = fetchCards(['Ace of diamonds', '2 of diamonds', '3 of diamonds']);
            expect(new Meld(cards).type).to.equal('sequence-3');
            await meld({ cards, discard: false, melded: 1 })
        }
    });

    it('when there are no cards in the deck, it goes to the next round', async () => {
        do {
            const prompted = await Util.waitUntil(() => game.currentPlayer.terminal.prompted, { pause: 1 });
            if (game.round === 1 && prompted.name === 'meld') {
                await game.currentPlayer.terminal.answer({
                    meld: [[]],
                    discard: game.currentPlayer.cards[0].name
                });
            }
        } while (game.round === 1)
    });

    it('allows players to buy in the second round, one time only', async () => {
        const player = game.currentPlayer;
        const cards = game.currentPlayer.cards.length;
        await game.currentPlayer.terminal.answer({ buy: true });                                // Player 2 buys
        await Util.waitUntil(() => game.currentPlayer.cards.length === cards + 4);  // buy + 2 + draw
        await game.currentPlayer.terminal.answer({ meld: [[]], discard: game.currentPlayer.cards[0].name });
    });

    it('allows the currentplayer to not buy and the next player to buy', async () => {
        await game.promptedPlayer;
        const cards = [game.currentPlayer.cards.length, game.currentPlayer.nextPlayer.cards.length];
        await game.currentPlayer.terminal.answer({ buy: false });                               // Player 3 does not buy
        await game.currentPlayer.nextPlayer.terminal.answer({ buy: true });                     // Player 4 buys Player 2's discard which Player 3 rejected
        await Util.waitUntil(() => game.currentPlayer.cards.length === cards[0] + 1);             // draw
        await Util.waitUntil(() => game.currentPlayer.nextPlayer.cards.length === cards[1] + 3);  // buy + 2        
    });

    it('does not allow the player to buy twice', async () => {
        expect(game.players[3].canBuy).to.not.be.ok;
    });


    it('ensures the first meld of round 2 is a double-trio-one-pure', async () => {
        const expectedError = 'first-meld-round-2-double-trio-one-pure';
        game.players.filter(p => !p.buysThisHand.length).forEach(p => p.terminal.answer({ buy: true }))
        for (const cards of [
            fetchCards(['3 of clubs', '3 of hearts', '3 of diamonds', '4 of clubs', '4 of diamonds', '4 of spades']),
            fetchCards(['5 of clubs', '5 of hearts', '6 of clubs', '6 of diamonds', '6 of spades', 'Joker of null'])
        ]) {
            await meld({ cards, expectedError, discard: true, melded: 2 })
        }
    });

    it('does not allow buying after melding', async () => {
        expect(!game.players[2].buys.length && game.players[2].melded && !game.players[2].canBuy).to.be.ok;
    })

    it('ensures the first meld of round 3 is a set-4', async () => {
        while (await game.promptedPlayer.then(() => game.round) !== 3) {
            await game.currentPlayer.terminal.answer({
                meld: [[]], discard: game.currentPlayer.cards[0].name
            });
        }
        for (const player of game.players) player.terminal.answer({ buy: true })
        await meld({ cards: [], expectedError: 'first-meld-round-3-cuatro', discard: true });
        await meld({
            cards: fetchCards(['7 of clubs', '7 of hearts', '7 of diamonds', '7 of diamonds']),
            discard: true,
            melded: 1,
        })
    });

    it('ensures the first meld of round 4 is a double-cuatro', async () => {
        while ((await game.promptedPlayer).game.round !== 4) {
            await game.currentPlayer.terminal.answer({
                meld: [[]], discard: game.currentPlayer.cards[0].name
            });
        }
        game.players.forEach(player => player.terminal.answer({ buy: [true, true] }))
        await meld({
            expectedError: 'first-meld-round-4-double-cuatro',
            cards: fetchCards(['5 of clubs', '5 of hearts', '5 of diamonds', '5 of diamonds', '4 of hearts', '4 of clubs', '4 of spades', '4 of spades']),
            discard: true,
            melded: 2,
        })
    });

    it('ensures the first meld of round 5 is a sequence-5', async () => {
        while (await game.promptedPlayer.then(() => game.round) !== 5) {
            await game.currentPlayer.terminal.answer({
                meld: [[]], discard: game.currentPlayer.cards[0].name
            });
        }
        game.players.forEach(player => player.terminal.answer({ buy: [true, true] }))
        await meld({
            expectedError: 'first-meld-round-5-sequence-5',
            cards: fetchCards(['3 of clubs', '4 of clubs', '5 of clubs', '6 of clubs', '7 of clubs']),
            discard: true,
            melded: 1,
        })
    });

    it('ensures the first meld of round 6 is a sequence-4-trio', async () => {
        while (await game.promptedPlayer.then(() => game.round) !== 6) {
            await game.currentPlayer.terminal.answer({
                meld: [[]], discard: game.currentPlayer.cards[0].name
            });
        }
        game.players.forEach(player => player.terminal.answer({ buy: [true, true] }))
        await meld({
            expectedError: 'first-meld-round-6-sequence-4-trio',
            cards: fetchCards(['3 of clubs', '4 of clubs', '5 of clubs', '6 of clubs', '8 of diamonds', '8 of diamonds', '8 of clubs']),
            discard: true,
            melded: 2,
        })
    })

    it('ensures the first meld of round 7 is a sequence-7', async () => {
        while (await game.promptedPlayer.then(() => game.round) !== 7) {
            await game.currentPlayer.terminal.answer({
                meld: [[]], discard: game.currentPlayer.cards[0].name
            });
        }
        game.players.forEach(player => player.terminal.answer({ buy: [true, true] }))
        await meld({
            expectedError: 'first-meld-round-7-sequence-7',
            cards: fetchCards(['3 of clubs', '4 of clubs', '5 of clubs', '6 of clubs', '7 of clubs', '8 of clubs', '9 of clubs']),
            discard: true,
            melded: 1
        })
    });

    it('finished the game and announces the winner after the 7th round', async () => {
        do {
            const player = game.currentPlayer;
            const final = player.cards.length == 1 || game.deck.length <= 0;
            await game.currentPlayer.terminal.answer({ meld: [[]], discard: player.cards[0].name });
            if (final) await Util.waitUntil(() => game.finished)
            else await Util.waitUntil(() => game.currentPlayer !== player);
        } while (!game.finished);
        expect(game.finished).to.be.ok;
        await Util.pause(1000);
    });

    after(() => {
        game.players.forEach(p => p.terminal.respond(null))
        delete game.running;
    })
});
