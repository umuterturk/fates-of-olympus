"""
Game rules and validation logic.

This module implements the core game rules:
- Action validation (legality checks)
- Win condition computation
- Turn resolution pipeline
"""

from __future__ import annotations

from dataclasses import dataclass

from engine.types import (
    PlayerId,
    LocationIndex,
    TurnNumber,
    Power,
    AbilityType,
    GameResult,
    MAX_TURNS,
    LOCATION_CAPACITY,
)
from engine.models import (
    GameState,
    PlayerAction,
    PassAction,
    CardInstance,
)
from engine.events import (
    GameEvent,
    CardPlayedEvent,
    CardRevealedEvent,
    EnergySpentEvent,
    PlayerPassedEvent,
    ActionInvalidEvent,
)
from engine.effects import (
    AddPowerEffect,
    MoveCardEffect,
    DestroyCardEffect,
    DestroyAndBuffEffect,
    DestroyAndGainPowerEffect,
    ConditionalPowerEffect,
    StealPowerEffect,
    ScalingPowerEffect,
    ReviveEffect,
    SilenceOngoingEffect,
    compute_ongoing_effects,
)


# =============================================================================
# Action Validation
# =============================================================================


@dataclass(frozen=True, slots=True)
class ValidationResult:
    """Result of validating an action."""

    valid: bool
    """Whether the action is valid."""

    reason: str
    """Explanation (for invalid actions)."""


def validate_action(state: GameState, action: PlayerAction) -> ValidationResult:
    """
    Validate whether an action is legal given the current state.

    Checks:
    - Card is in player's hand
    - Player has enough energy
    - Location has capacity
    """
    if isinstance(action, PassAction):
        return ValidationResult(valid=True, reason="")

    # Check location index is valid first (before accessing it)
    if action.location not in (LocationIndex(0), LocationIndex(1), LocationIndex(2)):
        return ValidationResult(valid=False, reason=f"Invalid location: {action.location}")

    player = state.get_player(action.player_id)
    location = state.get_location(action.location)

    # Check card is in hand
    card_in_hand = None
    for card in player.hand:
        if card.instance_id == action.card_instance_id:
            card_in_hand = card
            break

    if card_in_hand is None:
        return ValidationResult(valid=False, reason="Card not in hand")

    # Check energy
    if card_in_hand.card_def.cost > player.energy:
        return ValidationResult(
            valid=False,
            reason=f"Not enough energy: need {card_in_hand.card_def.cost}, have {player.energy}",
        )

    # Check location capacity
    if location.card_count(action.player_id) >= LOCATION_CAPACITY:
        return ValidationResult(
            valid=False,
            reason=f"Location {action.location} is at capacity ({LOCATION_CAPACITY})",
        )

    return ValidationResult(valid=True, reason="")


# =============================================================================
# Action Resolution
# =============================================================================


def resolve_actions(
    state: GameState,
    action_p0: PlayerAction,
    action_p1: PlayerAction,
) -> tuple[GameState, list[GameEvent]]:
    """
    Resolve both players' actions for a turn.

    Resolution order (documented as P0 reveals first, then P1):
    1. Validate both actions against pre-resolution state
    2. Apply costs and place cards as pending
    3. Reveal P0's card (trigger ON_REVEAL)
    4. Reveal P1's card (trigger ON_REVEAL)
    5. Recompute ONGOING effects

    Args:
        state: Current game state
        action_p0: Player 0's action
        action_p1: Player 1's action

    Returns:
        Tuple of (new_state, events)
    """
    events: list[GameEvent] = []
    actions = [action_p0, action_p1]

    # Track played cards for reveal phase
    played_cards: list[tuple[CardInstance, LocationIndex, PlayerId]] = []

    # Phase 1: Validate and apply actions
    for action in actions:
        validation = validate_action(state, action)

        if not validation.valid:
            events.append(
                ActionInvalidEvent(
                    player_id=action.player_id,
                    reason=validation.reason,
                )
            )
            continue

        if isinstance(action, PassAction):
            events.append(PlayerPassedEvent(player_id=action.player_id))
            continue

        # PlayCardAction
        player = state.get_player(action.player_id)

        # Find card in hand
        card_to_play: CardInstance | None = None
        for card in player.hand:
            if card.instance_id == action.card_instance_id:
                card_to_play = card
                break

        if card_to_play is None:
            # Should not happen if validation passed
            continue

        # Spend energy
        new_player = player.spend_energy(card_to_play.card_def.cost)
        events.append(
            EnergySpentEvent(
                player_id=action.player_id,
                amount=card_to_play.card_def.cost,
                remaining=new_player.energy,
            )
        )

        # Remove from hand
        new_player, _ = new_player.remove_from_hand(card_to_play.instance_id)
        state = state.with_player(action.player_id, new_player)

        # Place at location (unrevealed)
        location = state.get_location(action.location)
        updated_location = location.add_card(card_to_play, action.player_id)
        state = state.with_location(action.location, updated_location)

        events.append(
            CardPlayedEvent(
                player_id=action.player_id,
                card_instance_id=card_to_play.instance_id,
                location=action.location,
            )
        )

        played_cards.append((card_to_play, action.location, action.player_id))

    # Phase 2: Reveal cards in order (P0 first, then P1)
    # Sort by player ID to ensure P0 reveals first
    played_cards.sort(key=lambda x: x[2])

    for card, loc_idx, player_id in played_cards:
        state, reveal_events = _reveal_card(state, card, loc_idx, player_id)
        events.extend(reveal_events)

    # Phase 3: Recompute ongoing effects
    state, ongoing_events = compute_ongoing_effects(state)
    events.extend(ongoing_events)

    return state, events


def _reveal_card(
    state: GameState,
    card: CardInstance,
    location_idx: LocationIndex,
    player_id: PlayerId,
) -> tuple[GameState, list[GameEvent]]:
    """
    Reveal a card and trigger its ON_REVEAL effects.

    Args:
        state: Current game state
        card: The card to reveal
        location_idx: Location where the card is
        player_id: The player who owns the card

    Returns:
        Tuple of (new_state, events)
    """
    events: list[GameEvent] = []

    # Mark card as revealed
    revealed_card = card.with_revealed(True)
    location = state.get_location(location_idx)
    updated_location = location.update_card(revealed_card)
    state = state.with_location(location_idx, updated_location)

    events.append(
        CardRevealedEvent(
            card_instance_id=card.instance_id,
            location=location_idx,
            player_id=player_id,
        )
    )

    # Trigger ON_REVEAL effects
    # Need to fetch the updated revealed card from state for effect application
    if card.card_def.ability_type == AbilityType.ON_REVEAL:
        # Get the current version of the card from state (now revealed)
        current_card = state.find_card_by_instance(card.instance_id)
        if current_card is not None:
            for effect in card.card_def.effects:
                # Handle all ON_REVEAL effect types
                if isinstance(
                    effect,
                    (
                        AddPowerEffect,
                        MoveCardEffect,
                        DestroyCardEffect,
                        DestroyAndBuffEffect,
                        DestroyAndGainPowerEffect,
                        ConditionalPowerEffect,
                        StealPowerEffect,
                        ScalingPowerEffect,
                        ReviveEffect,
                        SilenceOngoingEffect,
                    ),
                ):
                    state, effect_events = effect.apply(state, current_card, player_id)
                    events.extend(effect_events)

    return state, events


# =============================================================================
# Win Condition
# =============================================================================


def compute_winner(state: GameState) -> tuple[GameResult, tuple[PlayerId | None, PlayerId | None, PlayerId | None]]:
    """
    Compute the winner of the game based on current board state.

    Win condition:
    - Win if you win 2 of 3 locations
    - If 1-1 with one tied: compare total power across all locations
    - If still tied: draw

    Returns:
        Tuple of (result, location_winners)
        where location_winners[i] is the winner of location i (or None for tie)
    """
    location_winners: list[PlayerId | None] = []
    p0_wins = 0
    p1_wins = 0
    ties = 0

    for location in state.locations:
        p0_power = location.total_power(PlayerId(0))
        p1_power = location.total_power(PlayerId(1))

        if p0_power > p1_power:
            location_winners.append(PlayerId(0))
            p0_wins += 1
        elif p1_power > p0_power:
            location_winners.append(PlayerId(1))
            p1_wins += 1
        else:
            location_winners.append(None)
            ties += 1

    # Check for 2+ location wins
    if p0_wins >= 2:
        return GameResult.PLAYER_0_WINS, (location_winners[0], location_winners[1], location_winners[2])
    if p1_wins >= 2:
        return GameResult.PLAYER_1_WINS, (location_winners[0], location_winners[1], location_winners[2])

    # If 1-1 with tie(s), check total power
    total_p0 = Power(sum(loc.total_power(PlayerId(0)) for loc in state.locations))
    total_p1 = Power(sum(loc.total_power(PlayerId(1)) for loc in state.locations))

    if total_p0 > total_p1:
        return GameResult.PLAYER_0_WINS, (location_winners[0], location_winners[1], location_winners[2])
    elif total_p1 > total_p0:
        return GameResult.PLAYER_1_WINS, (location_winners[0], location_winners[1], location_winners[2])
    else:
        return GameResult.DRAW, (location_winners[0], location_winners[1], location_winners[2])


def compute_location_powers(
    state: GameState,
) -> tuple[tuple[Power, Power], tuple[Power, Power], tuple[Power, Power]]:
    """Compute power totals at each location."""
    return (
        (state.locations[0].total_power(PlayerId(0)), state.locations[0].total_power(PlayerId(1))),
        (state.locations[1].total_power(PlayerId(0)), state.locations[1].total_power(PlayerId(1))),
        (state.locations[2].total_power(PlayerId(0)), state.locations[2].total_power(PlayerId(1))),
    )


def is_game_over(state: GameState) -> bool:
    """Check if the game should end (after turn 6 completes)."""
    return state.turn >= TurnNumber(MAX_TURNS)
