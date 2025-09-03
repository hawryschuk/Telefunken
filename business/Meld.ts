import { Util } from "@hawryschuk-common/util";
import { Card, TelefunkenGame } from "./TelefunkenGame";
import { Player } from "./Player";

export class Meld {
    round!: number;

    constructor(public cards: Card[], public player: Player) {
        this.round = this.player.game.handsPlayed + 1;
    }

    get game() { return this.player.game }

    get valid() { return !this.invalid }

    get invalid() {
        return !this.player.melded && (
            this.game.round === 1 && this.type !== 'pure-trio' && 'first-meld-round-1-pure-trio'
            || this.game.round === 2 && this.type !== 'double-trio-one-pure' && 'first-meld-round-2-double-trio-one-pure'
            || this.game.round === 3 && this.type !== 'set-4' && 'first-meld-round-3-cuatro'
            || this.game.round === 4 && this.type !== 'double-cuatro' && 'first-meld-round-4-double-cuatro'
            || this.game.round === 5 && this.type !== 'sequence-5' && 'first-meld-round-5-sequence-5'
            || this.game.round === 6 && this.type !== 'sequence-4-trio' && 'first-meld-round-6-sequence-4-trio'
            || this.game.round === 7 && this.type !== 'sequence-7' && 'first-meld-round-7-sequence-7'
        )
            || !this.player.melded && this.jokers > 1 && 'excessive-jokers'
            || this.cards.length < 1 && 'minimum-1'
            || !this.game.drew && 'has-not-drawn'
            || !(this.cards.length === 1 || this.cards.length >= 3) && 'must-be-single-or-3+'
            || !this.type && ('unknown-type')
            || ''
    }

    get doubleTrio(): Meld[] {
        return (this.cards.length === 6 && [this.rotated, this.cards]
            .map(cards => [new Meld(cards.slice(0, 3), this.player), new Meld(cards.slice(3), this.player)])
            .find(melds => {
                return melds.map(meld => meld.type).includes('pure-trio')
                    && melds.every(type => /set-3|pure-trio/.test(type.type))
            })) as Meld[]
    }

    get doubleCuatro(): Meld[] {
        return (this.cards.length === 8 && [this.rotated, this.cards]
            .map(cards => [new Meld(cards.slice(0, 4), this.player), new Meld(cards.slice(4), this.player)])
            .find((melds: Meld[]) => melds.every(meld => meld.type === 'set-4'))) as Meld[]
    }

    get sequence4trio(): Meld[] {
        if (this.cards.length === 7)
            for (const cards of Util.permute(this.cards)) {
                const melds = [new Meld(cards.slice(0, 3), this.player), new Meld(cards.slice(3), this.player)];
                if (melds.find(meld => /set-3|trio/.test(meld.type))
                    && melds.find(meld => meld.type === 'sequence-4'))
                    return melds;
            }
        return null as any;
    }

    private get jokers() { return Util.where(this.cards, { value: '*' }).length; }
    private get rotated() { return this.cards.slice(-1).concat(this.cards.slice(0, -1)); }
    private get nonJokers() { return this.cards.filter(c => c.value !== '*'); }

    get type(): string {
        const set = this.nonJokers.every(c => c.value === this.nonJokers[0].value);
        const differentSuits = Util.unique(this.cards.map(c => c.suit)).length === this.cards.length;
        const sameSuit = Util.unique(this.nonJokers.map(c => c.suit)).length === 1;
        const aceAsOne = this.nonJokers
            .map(card => <Card>{ suit: this.nonJokers[0].suit, value: card.value === 'A' ? '1' : card.value })
            .sort((a, b) => TelefunkenGame.CompareCards(a, b))
        const isSequential = (arr: Card[]) => arr
            .reduce(
                (cards, card, index) => {
                    const jokersUsed = Util.where(cards, { value: '*' });
                    const jokersAvailable = Util.without(Util.where(cards, { value: '*' }), jokersUsed);

                    if (jokersAvailable.length && (card.value !== arr[0].value + index))
                        cards.push(jokersAvailable.shift()!);

                    cards.push(card);

                    if (jokersAvailable.length && index === arr.length - 1)
                        cards.push(jokersAvailable.shift()!);

                    return cards;
                }, [] as Card[])
            .sort((a, b) => TelefunkenGame.CompareCards(a, b))
            .every((card, index, arr) => card.value === arr[0].value + index);
        return this.cards.length >= 3 && this.nonJokers.length >= 2 && (
            this.cards.length === 3 && set && !this.jokers && differentSuits && 'pure-trio' // round 1 special
            || this.doubleTrio && 'double-trio-one-pure'                                    // round 2 special                  ( 3 = cuatro) 
            || this.doubleCuatro && 'double-cuatro'                                         // round 4 special: 5555 666J 555   ( 5 = sequence-5 )
            || this.sequence4trio && 'sequence-4-trio'                                      // round 6 special                  ( 7 = sequence-7 )
            || set && `set-${this.cards.length}`                                            // sets
            || sameSuit && [this.nonJokers, aceAsOne].some(cards => isSequential(cards)) && `sequence-${this.cards.length}`      // sequences
        ) || '';
    }

}
