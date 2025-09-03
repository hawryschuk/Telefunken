# Telefunken 
> A contract rummy game, resembling Continental Rummy, where players must complete specific melds (sets and runs) in each of seven rounds—or "deals"—to go out and score zero points 

<a href=sample> Sample GUI </a>

## Cards and Players
- Uses two standard decks plus jokers, totaling 108 cards
- For 3–4 players, that stack is standard; larger games may require three decks 
- Players also start with a limited number of buying chips (usually 7) that allow them to "buy" discards 

## Typical Contracts (Dealing Rules)
- Each deal has a specific contract that must be met before melding:
    - Deal 1: One pure trio (three-of-a-kind, no joker)
    - Deal 2: Two trios
    - Deal 3: One quartet (four-of-a-kind)
    - Deal 4: Two quartets
    - Deal 5: One quintet (five-of-a-kind)
    - Deal 6: Two quintets
    - Deal 7: A trio + a run of 7+ cards 

A pure trio in Deal 1 must consist of three cards of the same rank but different suits, with no jokers allowed.

## Gameplay Flow
- Dealer shuffles and deals (each gets 11 cards, and one card starts the discard pile) 
- The player to the dealer's right starts and turns continue counterclockwise 
- On your turn:
    - Draw from the stock, or (if it's your first turn) take the face-up discard for free.
    - Optionally buy the discard (before your first meld) using a chip; if multiple players want it, priority is given based on turn order
    - Once able to meet the contract, you meld your contract, then you may add to your own or others' melds and extend runs/sets (jokers can be swapped in and out under certain rules) 
- Finally, discard one card to end your turn.
- Play continues until someone discards their last card (having completed their melds). Other players score penalty points based on remaining cards 
- Typically played over seven deals, and the lowest total penalty wins 

### Sequence Diagram 
```plantuml
@startuml
participant Dealer
participant "Current Player" as Player
participant DiscardPile
participant Stock
participant "Table (Melds)" as Table

Dealer -> Player: Deal 11 cards
Player -> DiscardPile: Check top card

alt First turn
    Player -> DiscardPile: Optionally take top card for free
else Later turns
    Player -> DiscardPile: Buy top card? (if chips available)
    note right of Player
        If multiple players want it,
        priority goes in turn order
    end note
end

alt If not taking discard
    Player -> Stock: Draw card
end

Player -> Player: Check if contract met

alt Contract met
    Player -> Table: Lay down required meld(s)
    Player -> Table: Add cards to own or others' melds
    Player -> Table: Replace jokers if allowed
end

Player -> DiscardPile: Discard 1 card
note right of Player
    If player has no cards left → Round ends
end note

@enduml

```

### Model
```plantuml
@startuml
class Game {
    +start()
    +playRound()
    +endRound()
    +calculateScores()
}

class Dealer {
    +shuffle()
    +deal()
}

class Player {
    +name : String
    +hand : Hand
    +chips : int
    +meldContract()
    +buyDiscard()
    +discard()
}

class Hand {
    +cards : Card[*]
}

class Card {
    +rank : Rank
    +suit : Suit
    +isJoker : boolean
}

class Deck {
    +cards : Card[*]
    +shuffle()
    +draw() : Card
}

class DiscardPile {
    +topCard() : Card
    +addCard(Card)
    +takeCard() : Card
}

class Contract {
    +round : int
    +requirements : String
    +isFulfilled(Hand) : boolean
}

class Meld {
    +cards : Card[*]
    +isRun() : boolean
    +isSet() : boolean
}

class Scoreboard {
    +scores : Map<Player,int>
    +update(Player,int)
}

' Relationships
Game "1" --> "1" Dealer
Game "1" --> "2..6" Player
Game "1" --> "1" Deck
Game "1" --> "1" DiscardPile
Game "1" --> "1" Contract
Game "1" --> "1" Scoreboard
Player "1" --> "1" Hand
Hand "0..*" --> "0..*" Card
Player "1" --> "*" Meld
Meld "0..*" --> "0..*" Card

@enduml

```

### State Diagram
```plantuml 
@startuml
[*] --> Dealing

Dealing --> BuyingPhase : Dealer gives 11 cards\nOne card to Discard Pile
BuyingPhase --> Playing : Players draw/buy cards\nCheck contract

Playing --> Melding : Player meets contract\nLays down meld
Melding --> Playing : Continue play\n(add to melds, replace jokers)

Playing --> RoundEnd : Player discards last card
Melding --> RoundEnd : Player goes out during meld

RoundEnd --> Scoring : Count penalty points
Scoring --> [*]
@enduml


```