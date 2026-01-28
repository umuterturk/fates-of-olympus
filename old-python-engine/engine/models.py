"""
Data models for the game engine.

All models use frozen dataclasses for immutability.
State transitions create new objects rather than mutating existing ones.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence, Mapping, TYPE_CHECKING

from engine.types import (
    CardId,
    InstanceId,
    PlayerId,
    LocationIndex,
    TurnNumber,
    Energy,
    Power,
    AbilityType,
    GamePhase,
    GameResult,
)

if TYPE_CHECKING:
    from engine.effects import Effect


# =============================================================================
# Card Definitions
# =============================================================================


@dataclass(frozen=True, slots=True)
class CardDef:
    """
    Immutable definition of a card type.

    This defines the "template" for a card. Multiple instances can exist
    in a game, each referencing this definition.
    """

    id: CardId
    """Unique identifier for this card type."""

    name: str
    """Display name of the card."""

    cost: Energy
    """Energy cost to play this card."""

    base_power: Power
    """Base power value of the card."""

    text: str
    """Description text explaining the card's ability."""

    ability_type: AbilityType
    """Type of ability this card has."""

    effects: tuple[Effect, ...] = field(default_factory=tuple)
    """Effects triggered by this card's ability."""

    tags: frozenset[str] = field(default_factory=lambda: frozenset[str]())
    """Tags for categorization and targeting."""


# =============================================================================
# Card Instances
# =============================================================================


@dataclass(frozen=True, slots=True)
class CardInstance:
    """
    A specific instance of a card in a game.

    Each card in a player's deck/hand/board is a unique instance
    with its own InstanceId.
    """

    instance_id: InstanceId
    """Unique ID for this specific card instance."""

    card_def: CardDef
    """Reference to the card's definition."""

    owner: PlayerId
    """The player who owns this card."""

    permanent_power_modifier: Power = Power(0)
    """Permanent power modifier (from ON_REVEAL effects)."""

    ongoing_power_modifier: Power = Power(0)
    """Temporary power modifier (from ONGOING effects, reset each turn)."""

    revealed: bool = False
    """Whether this card has been revealed."""

    def effective_power(self) -> Power:
        """Calculate the total power of this card."""
        return Power(
            self.card_def.base_power + self.permanent_power_modifier + self.ongoing_power_modifier
        )

    def with_ongoing_power_modifier(self, modifier: Power) -> CardInstance:
        """Return a new instance with updated ongoing power modifier."""
        return CardInstance(
            instance_id=self.instance_id,
            card_def=self.card_def,
            owner=self.owner,
            permanent_power_modifier=self.permanent_power_modifier,
            ongoing_power_modifier=modifier,
            revealed=self.revealed,
        )

    def with_revealed(self, revealed: bool) -> CardInstance:
        """Return a new instance with updated revealed status."""
        return CardInstance(
            instance_id=self.instance_id,
            card_def=self.card_def,
            owner=self.owner,
            permanent_power_modifier=self.permanent_power_modifier,
            ongoing_power_modifier=self.ongoing_power_modifier,
            revealed=revealed,
        )

    def add_permanent_power(self, amount: Power) -> CardInstance:
        """Return a new instance with added permanent power (ON_REVEAL effects)."""
        return CardInstance(
            instance_id=self.instance_id,
            card_def=self.card_def,
            owner=self.owner,
            permanent_power_modifier=Power(self.permanent_power_modifier + amount),
            ongoing_power_modifier=self.ongoing_power_modifier,
            revealed=self.revealed,
        )

    def add_ongoing_power(self, amount: Power) -> CardInstance:
        """Return a new instance with added ongoing power (ONGOING effects)."""
        return CardInstance(
            instance_id=self.instance_id,
            card_def=self.card_def,
            owner=self.owner,
            permanent_power_modifier=self.permanent_power_modifier,
            ongoing_power_modifier=Power(self.ongoing_power_modifier + amount),
            revealed=self.revealed,
        )


# =============================================================================
# Player State
# =============================================================================


@dataclass(frozen=True, slots=True)
class PlayerState:
    """
    Immutable state of a single player.
    """

    player_id: PlayerId
    """The player's identifier."""

    deck: tuple[CardInstance, ...]
    """Cards remaining in the deck (top of deck is index 0)."""

    hand: tuple[CardInstance, ...]
    """Cards in the player's hand."""

    energy: Energy
    """Current available energy."""

    max_energy: Energy
    """Maximum energy this turn."""

    def with_deck(self, deck: Sequence[CardInstance]) -> PlayerState:
        """Return a new state with updated deck."""
        return PlayerState(
            player_id=self.player_id,
            deck=tuple(deck),
            hand=self.hand,
            energy=self.energy,
            max_energy=self.max_energy,
        )

    def with_hand(self, hand: Sequence[CardInstance]) -> PlayerState:
        """Return a new state with updated hand."""
        return PlayerState(
            player_id=self.player_id,
            deck=self.deck,
            hand=tuple(hand),
            energy=self.energy,
            max_energy=self.max_energy,
        )

    def with_energy(self, energy: Energy, max_energy: Energy | None = None) -> PlayerState:
        """Return a new state with updated energy."""
        return PlayerState(
            player_id=self.player_id,
            deck=self.deck,
            hand=self.hand,
            energy=energy,
            max_energy=max_energy if max_energy is not None else self.max_energy,
        )

    def draw_card(self) -> tuple[PlayerState, CardInstance | None]:
        """
        Draw a card from the deck.

        Returns:
            Tuple of (new_state, drawn_card or None if deck empty)
        """
        if not self.deck:
            return self, None

        drawn = self.deck[0]
        new_deck = self.deck[1:]
        new_hand = (*self.hand, drawn)

        new_state = PlayerState(
            player_id=self.player_id,
            deck=new_deck,
            hand=new_hand,
            energy=self.energy,
            max_energy=self.max_energy,
        )
        return new_state, drawn

    def remove_from_hand(self, instance_id: InstanceId) -> tuple[PlayerState, CardInstance | None]:
        """
        Remove a card from hand by instance ID.

        Returns:
            Tuple of (new_state, removed_card or None if not found)
        """
        for i, card in enumerate(self.hand):
            if card.instance_id == instance_id:
                new_hand = self.hand[:i] + self.hand[i + 1 :]
                new_state = PlayerState(
                    player_id=self.player_id,
                    deck=self.deck,
                    hand=new_hand,
                    energy=self.energy,
                    max_energy=self.max_energy,
                )
                return new_state, card
        return self, None

    def spend_energy(self, amount: Energy) -> PlayerState:
        """Return a new state with energy spent."""
        return PlayerState(
            player_id=self.player_id,
            deck=self.deck,
            hand=self.hand,
            energy=Energy(self.energy - amount),
            max_energy=self.max_energy,
        )


# =============================================================================
# Location State
# =============================================================================


@dataclass(frozen=True, slots=True)
class LocationState:
    """
    Immutable state of a single location (lane).
    """

    index: LocationIndex
    """The location's index (0, 1, or 2)."""

    cards_by_player: Mapping[PlayerId, tuple[CardInstance, ...]]
    """Cards at this location, keyed by player ID."""

    def get_cards(self, player_id: PlayerId) -> tuple[CardInstance, ...]:
        """Get all cards at this location for a player."""
        return self.cards_by_player.get(player_id, ())

    def card_count(self, player_id: PlayerId) -> int:
        """Get the number of cards at this location for a player."""
        return len(self.get_cards(player_id))

    def add_card(self, card: CardInstance, player_id: PlayerId) -> LocationState:
        """Return a new state with a card added."""
        current_cards = self.get_cards(player_id)
        new_cards = (*current_cards, card)

        new_mapping: dict[PlayerId, tuple[CardInstance, ...]] = dict(self.cards_by_player)
        new_mapping[player_id] = new_cards

        return LocationState(
            index=self.index,
            cards_by_player=new_mapping,
        )

    def remove_card(self, instance_id: InstanceId) -> tuple[LocationState, CardInstance | None]:
        """
        Remove a card by instance ID.

        Returns:
            Tuple of (new_state, removed_card or None if not found)
        """
        new_mapping: dict[PlayerId, tuple[CardInstance, ...]] = {}
        removed_card: CardInstance | None = None

        for player_id, cards in self.cards_by_player.items():
            new_cards: list[CardInstance] = []
            for card in cards:
                if card.instance_id == instance_id and removed_card is None:
                    removed_card = card
                else:
                    new_cards.append(card)
            new_mapping[player_id] = tuple(new_cards)

        return LocationState(index=self.index, cards_by_player=new_mapping), removed_card

    def update_card(self, updated_card: CardInstance) -> LocationState:
        """Return a new state with a card updated."""
        new_mapping: dict[PlayerId, tuple[CardInstance, ...]] = {}

        for player_id, cards in self.cards_by_player.items():
            new_cards = tuple(
                updated_card if c.instance_id == updated_card.instance_id else c for c in cards
            )
            new_mapping[player_id] = new_cards

        return LocationState(index=self.index, cards_by_player=new_mapping)

    def total_power(self, player_id: PlayerId) -> Power:
        """Calculate total power at this location for a player."""
        return Power(sum(c.effective_power() for c in self.get_cards(player_id)))

    def all_cards(self) -> tuple[CardInstance, ...]:
        """Get all cards at this location."""
        all_cards: list[CardInstance] = []
        for cards in self.cards_by_player.values():
            all_cards.extend(cards)
        return tuple(all_cards)


# =============================================================================
# Game State
# =============================================================================


@dataclass(frozen=True, slots=True)
class GameState:
    """
    Complete immutable game state snapshot.

    This is the central state object that captures everything about
    the current state of a game. All state transitions return new
    GameState objects.
    """

    turn: TurnNumber
    """Current turn number (1-6)."""

    phase: GamePhase
    """Current phase of the turn."""

    players: tuple[PlayerState, PlayerState]
    """State of both players (indexed by PlayerId)."""

    locations: tuple[LocationState, LocationState, LocationState]
    """State of all three locations."""

    result: GameResult
    """Current game result (IN_PROGRESS or final outcome)."""

    next_instance_id: InstanceId
    """Next available instance ID for creating cards."""

    # Game-wide tracking for conditional effects
    cards_destroyed_this_game: tuple[InstanceId, ...] = ()
    """Instance IDs of cards destroyed this game (for Cerberus, etc.)."""

    cards_moved_this_game: tuple[InstanceId, ...] = ()
    """Instance IDs of cards moved this game (for Poseidon, etc.)."""

    cards_moved_this_turn: tuple[InstanceId, ...] = ()
    """Instance IDs of cards moved this turn (legacy, kept for compatibility)."""

    silenced_cards: tuple[InstanceId, ...] = ()
    """Instance IDs of cards whose ongoing abilities are silenced."""

    def get_player(self, player_id: PlayerId) -> PlayerState:
        """Get state for a specific player."""
        return self.players[player_id]

    def get_location(self, index: LocationIndex) -> LocationState:
        """Get state for a specific location."""
        return self.locations[index]

    def with_player(self, player_id: PlayerId, player_state: PlayerState) -> GameState:
        """Return a new state with updated player state."""
        new_players: list[PlayerState] = list(self.players)
        new_players[player_id] = player_state

        return GameState(
            turn=self.turn,
            phase=self.phase,
            players=(new_players[0], new_players[1]),
            locations=self.locations,
            result=self.result,
            next_instance_id=self.next_instance_id,
            cards_destroyed_this_game=self.cards_destroyed_this_game,
            cards_moved_this_game=self.cards_moved_this_game,
            cards_moved_this_turn=self.cards_moved_this_turn,
            silenced_cards=self.silenced_cards,
        )

    def with_location(self, index: LocationIndex, location_state: LocationState) -> GameState:
        """Return a new state with updated location state."""
        new_locations: list[LocationState] = list(self.locations)
        new_locations[index] = location_state

        return GameState(
            turn=self.turn,
            phase=self.phase,
            players=self.players,
            locations=(new_locations[0], new_locations[1], new_locations[2]),
            result=self.result,
            next_instance_id=self.next_instance_id,
            cards_destroyed_this_game=self.cards_destroyed_this_game,
            cards_moved_this_game=self.cards_moved_this_game,
            cards_moved_this_turn=self.cards_moved_this_turn,
            silenced_cards=self.silenced_cards,
        )

    def with_turn(self, turn: TurnNumber) -> GameState:
        """Return a new state with updated turn number."""
        return GameState(
            turn=turn,
            phase=self.phase,
            players=self.players,
            locations=self.locations,
            result=self.result,
            next_instance_id=self.next_instance_id,
            cards_destroyed_this_game=self.cards_destroyed_this_game,
            cards_moved_this_game=self.cards_moved_this_game,
            cards_moved_this_turn=self.cards_moved_this_turn,
            silenced_cards=self.silenced_cards,
        )

    def with_phase(self, phase: GamePhase) -> GameState:
        """Return a new state with updated phase."""
        return GameState(
            turn=self.turn,
            phase=phase,
            players=self.players,
            locations=self.locations,
            result=self.result,
            next_instance_id=self.next_instance_id,
            cards_destroyed_this_game=self.cards_destroyed_this_game,
            cards_moved_this_game=self.cards_moved_this_game,
            cards_moved_this_turn=self.cards_moved_this_turn,
            silenced_cards=self.silenced_cards,
        )

    def with_result(self, result: GameResult) -> GameState:
        """Return a new state with updated result."""
        return GameState(
            turn=self.turn,
            phase=self.phase,
            players=self.players,
            locations=self.locations,
            result=result,
            next_instance_id=self.next_instance_id,
            cards_destroyed_this_game=self.cards_destroyed_this_game,
            cards_moved_this_game=self.cards_moved_this_game,
            cards_moved_this_turn=self.cards_moved_this_turn,
            silenced_cards=self.silenced_cards,
        )

    def with_next_instance_id(self, next_id: InstanceId) -> GameState:
        """Return a new state with updated next instance ID."""
        return GameState(
            turn=self.turn,
            phase=self.phase,
            players=self.players,
            locations=self.locations,
            result=self.result,
            next_instance_id=next_id,
            cards_destroyed_this_game=self.cards_destroyed_this_game,
            cards_moved_this_game=self.cards_moved_this_game,
            cards_moved_this_turn=self.cards_moved_this_turn,
            silenced_cards=self.silenced_cards,
        )

    def with_card_destroyed(self, instance_id: InstanceId) -> GameState:
        """Return a new state tracking a destroyed card."""
        return GameState(
            turn=self.turn,
            phase=self.phase,
            players=self.players,
            locations=self.locations,
            result=self.result,
            next_instance_id=self.next_instance_id,
            cards_destroyed_this_game=(*self.cards_destroyed_this_game, instance_id),
            cards_moved_this_game=self.cards_moved_this_game,
            cards_moved_this_turn=self.cards_moved_this_turn,
            silenced_cards=self.silenced_cards,
        )

    def with_card_moved(self, instance_id: InstanceId) -> GameState:
        """Return a new state tracking a moved card (both this turn and this game)."""
        return GameState(
            turn=self.turn,
            phase=self.phase,
            players=self.players,
            locations=self.locations,
            result=self.result,
            next_instance_id=self.next_instance_id,
            cards_destroyed_this_game=self.cards_destroyed_this_game,
            cards_moved_this_game=(*self.cards_moved_this_game, instance_id),
            cards_moved_this_turn=(*self.cards_moved_this_turn, instance_id),
            silenced_cards=self.silenced_cards,
        )

    def clear_turn_tracking(self) -> GameState:
        """Return a new state with turn-specific tracking cleared (called at turn start)."""
        return GameState(
            turn=self.turn,
            phase=self.phase,
            players=self.players,
            locations=self.locations,
            result=self.result,
            next_instance_id=self.next_instance_id,
            cards_destroyed_this_game=self.cards_destroyed_this_game,
            cards_moved_this_game=self.cards_moved_this_game,  # Keep game-wide tracking
            cards_moved_this_turn=(),  # Clear moved cards each turn
            silenced_cards=self.silenced_cards,
        )

    def with_silenced_card(self, instance_id: InstanceId) -> GameState:
        """Return a new state with a card's ongoing abilities silenced."""
        if instance_id in self.silenced_cards:
            return self
        return GameState(
            turn=self.turn,
            phase=self.phase,
            players=self.players,
            locations=self.locations,
            result=self.result,
            next_instance_id=self.next_instance_id,
            cards_destroyed_this_game=self.cards_destroyed_this_game,
            cards_moved_this_game=self.cards_moved_this_game,
            cards_moved_this_turn=self.cards_moved_this_turn,
            silenced_cards=(*self.silenced_cards, instance_id),
        )

    def is_silenced(self, instance_id: InstanceId) -> bool:
        """Check if a card's ongoing abilities are silenced."""
        return instance_id in self.silenced_cards

    def location_is_full(self, location_idx: LocationIndex, player_id: PlayerId) -> bool:
        """Check if a location is at full capacity for a player."""
        from engine.types import LOCATION_CAPACITY

        return self.get_location(location_idx).card_count(player_id) >= LOCATION_CAPACITY

    def has_destroyed_card_this_game(self) -> bool:
        """Check if any card has been destroyed this game."""
        return len(self.cards_destroyed_this_game) > 0

    def has_moved_card_this_game(self) -> bool:
        """Check if any card has been moved this game."""
        return len(self.cards_moved_this_game) > 0

    def has_moved_card_this_turn(self) -> bool:
        """Check if any card has been moved this turn."""
        return len(self.cards_moved_this_turn) > 0

    def find_card_by_instance(self, instance_id: InstanceId) -> CardInstance | None:
        """Find a card instance anywhere in the game state."""
        # Check hands
        for player in self.players:
            for card in player.hand:
                if card.instance_id == instance_id:
                    return card
            for card in player.deck:
                if card.instance_id == instance_id:
                    return card

        # Check locations
        for location in self.locations:
            for card in location.all_cards():
                if card.instance_id == instance_id:
                    return card

        return None

    def find_card_location(self, instance_id: InstanceId) -> LocationIndex | None:
        """Find which location a card is at, or None if not on board."""
        for location in self.locations:
            for card in location.all_cards():
                if card.instance_id == instance_id:
                    return location.index
        return None

    def all_board_cards(self) -> tuple[CardInstance, ...]:
        """Get all cards on the board."""
        cards: list[CardInstance] = []
        for location in self.locations:
            cards.extend(location.all_cards())
        return tuple(cards)


# =============================================================================
# Player Actions
# =============================================================================


@dataclass(frozen=True, slots=True)
class PlayCardAction:
    """Action to play a card from hand to a location."""

    player_id: PlayerId
    """The player taking this action."""

    card_instance_id: InstanceId
    """The instance ID of the card to play."""

    location: LocationIndex
    """The location to play the card to."""


@dataclass(frozen=True, slots=True)
class PassAction:
    """Action to pass without playing a card."""

    player_id: PlayerId
    """The player taking this action."""


# Type alias for any player action
PlayerAction = PlayCardAction | PassAction


# =============================================================================
# Factory Functions
# =============================================================================


def create_empty_location(index: LocationIndex) -> LocationState:
    """Create an empty location state."""
    return LocationState(
        index=index,
        cards_by_player={
            PlayerId(0): (),
            PlayerId(1): (),
        },
    )


def create_initial_locations() -> tuple[LocationState, LocationState, LocationState]:
    """Create the initial three empty locations."""
    return (
        create_empty_location(LocationIndex(0)),
        create_empty_location(LocationIndex(1)),
        create_empty_location(LocationIndex(2)),
    )
