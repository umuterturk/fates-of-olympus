"""
Effect primitives for card abilities.

Effects are composable, data-driven primitives that can be attached to cards.
Each effect knows how to apply itself to a GameState and returns a new state
plus any events generated.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from engine.types import (
    PlayerId,
    LocationIndex,
    Power,
    TargetFilter,
    LOCATION_CAPACITY,
)
from engine.models import (
    CardInstance,
    GameState,
    LocationState,
)
from engine.events import (
    GameEvent,
    PowerChangedEvent,
    CardMovedEvent,
    CardDestroyedEvent,
)


# =============================================================================
# Base Effect Types
# =============================================================================


@dataclass(frozen=True, slots=True)
class AddPowerEffect:
    """
    Add power to target card(s).

    This is a one-time power addition (typically used by ON_REVEAL abilities).
    """

    target: TargetFilter
    """Which cards to target."""

    amount: Power
    """Amount of power to add (can be negative for debuffs)."""

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Apply this effect to the game state (permanent power change)."""
        events: list[GameEvent] = []
        targets = _resolve_targets(state, source_card, source_player, self.target)

        for target_card in targets:
            location_idx = state.find_card_location(target_card.instance_id)
            if location_idx is None:
                continue

            # Get current version of target from state
            current_target = state.find_card_by_instance(target_card.instance_id)
            if current_target is None:
                continue

            old_power = current_target.effective_power()
            updated_card = current_target.add_permanent_power(self.amount)
            new_power = updated_card.effective_power()

            location = state.get_location(location_idx)
            updated_location = location.update_card(updated_card)
            state = state.with_location(location_idx, updated_location)

            events.append(
                PowerChangedEvent(
                    card_instance_id=target_card.instance_id,
                    old_power=old_power,
                    new_power=new_power,
                    source_card_id=source_card.instance_id,
                )
            )

        return state, events


@dataclass(frozen=True, slots=True)
class AddOngoingPowerEffect:
    """
    Ongoing power modifier that is recomputed each turn.

    This effect is registered on the card and applied during ONGOING resolution.
    The power modifier is applied to matching cards on the board.
    """

    target: TargetFilter
    """Which cards to target."""

    amount: Power
    """Amount of power to add (can be negative)."""

    def get_affected_cards(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> Sequence[CardInstance]:
        """Get the cards affected by this ongoing effect."""
        return _resolve_targets(state, source_card, source_player, self.target)


@dataclass(frozen=True, slots=True)
class ConditionalOngoingPowerEffect:
    """
    Ongoing power modifier with a condition that must be met.

    Used for cards like Ares (location must be full).
    """

    target: TargetFilter
    """Which cards to target."""

    amount: Power
    """Amount of power to add."""

    condition: str
    """
    Condition that must be true:
    - "location_full": Location must be at capacity for the owner
    """

    def check_condition(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> bool:
        """Check if the condition is met."""
        source_location = state.find_card_location(source_card.instance_id)
        if source_location is None:
            return False

        if self.condition == "location_full":
            return state.location_is_full(source_location, source_player)

        return True

    def get_affected_cards(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> Sequence[CardInstance]:
        """Get the cards affected by this ongoing effect (empty if condition not met)."""
        if not self.check_condition(state, source_card, source_player):
            return []
        return _resolve_targets(state, source_card, source_player, self.target)


@dataclass(frozen=True, slots=True)
class MoveCardEffect:
    """
    Move a card to a different location.
    """

    target: TargetFilter
    """Which card(s) to move."""

    to_other_location: bool = False
    """If True, move to any other location (deterministic: first available)."""

    destination: LocationIndex | None = None
    """Explicit destination location index (if not using to_other_location)."""

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Apply this effect to the game state."""
        events: list[GameEvent] = []
        targets = _resolve_targets(state, source_card, source_player, self.target)

        for target_card in targets:
            from_location_idx = state.find_card_location(target_card.instance_id)
            if from_location_idx is None:
                continue

            # Determine destination
            dest: LocationIndex | None = self.destination

            if self.to_other_location:
                # Find first available other location
                for loc_idx in (LocationIndex(0), LocationIndex(1), LocationIndex(2)):
                    if loc_idx != from_location_idx:
                        dest_loc = state.get_location(loc_idx)
                        if dest_loc.card_count(target_card.owner) < LOCATION_CAPACITY:
                            dest = loc_idx
                            break

            if dest is None:
                continue

            # Skip if already at destination
            if from_location_idx == dest:
                continue

            # Check capacity at destination
            dest_location = state.get_location(dest)
            if dest_location.card_count(target_card.owner) >= LOCATION_CAPACITY:
                continue

            # Remove from current location
            from_location = state.get_location(from_location_idx)
            updated_from, removed_card = from_location.remove_card(target_card.instance_id)
            if removed_card is None:
                continue

            state = state.with_location(from_location_idx, updated_from)

            # Add to destination
            dest_location = state.get_location(dest)
            updated_dest = dest_location.add_card(removed_card, removed_card.owner)
            state = state.with_location(dest, updated_dest)

            # Track moved card
            state = state.with_card_moved(target_card.instance_id)

            events.append(
                CardMovedEvent(
                    card_instance_id=target_card.instance_id,
                    from_location=from_location_idx,
                    to_location=dest,
                    source_card_id=source_card.instance_id,
                )
            )

        return state, events


@dataclass(frozen=True, slots=True)
class DestroyCardEffect:
    """
    Destroy a card, removing it from the board.
    """

    target: TargetFilter
    """Which card(s) to destroy."""

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Apply this effect to the game state."""
        events: list[GameEvent] = []
        targets = _resolve_targets(state, source_card, source_player, self.target)

        for target_card in targets:
            location_idx = state.find_card_location(target_card.instance_id)
            if location_idx is None:
                continue

            location = state.get_location(location_idx)
            updated_location, removed_card = location.remove_card(target_card.instance_id)

            if removed_card is not None:
                state = state.with_location(location_idx, updated_location)
                # Track destroyed card
                state = state.with_card_destroyed(target_card.instance_id)
                events.append(
                    CardDestroyedEvent(
                        card_instance_id=target_card.instance_id,
                        location=location_idx,
                        source_card_id=source_card.instance_id,
                    )
                )

        return state, events


@dataclass(frozen=True, slots=True)
class DestroyAndBuffEffect:
    """
    Destroy a card and apply a buff to another card.

    Used for Shade (destroy self, give +2 to ally) and Hecate (destroy ally, give -3 to enemy).
    """

    destroy_target: TargetFilter
    """Which card to destroy."""

    buff_target: TargetFilter
    """Which card to buff after destruction."""

    buff_amount: Power
    """Power to add to buff target."""

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Apply this effect to the game state."""
        events: list[GameEvent] = []

        # First, find the card to destroy
        destroy_targets = _resolve_targets(state, source_card, source_player, self.destroy_target)
        if not destroy_targets:
            return state, events

        target_to_destroy = destroy_targets[0]
        location_idx = state.find_card_location(target_to_destroy.instance_id)
        if location_idx is None:
            return state, events

        # Destroy the card
        location = state.get_location(location_idx)
        updated_location, removed_card = location.remove_card(target_to_destroy.instance_id)

        if removed_card is None:
            return state, events

        state = state.with_location(location_idx, updated_location)
        state = state.with_card_destroyed(target_to_destroy.instance_id)
        events.append(
            CardDestroyedEvent(
                card_instance_id=target_to_destroy.instance_id,
                location=location_idx,
                source_card_id=source_card.instance_id,
            )
        )

        # Now apply the buff
        buff_targets = _resolve_targets(state, source_card, source_player, self.buff_target)
        for buff_card in buff_targets:
            buff_loc_idx = state.find_card_location(buff_card.instance_id)
            if buff_loc_idx is None:
                continue

            current_target = state.find_card_by_instance(buff_card.instance_id)
            if current_target is None:
                continue

            old_power = current_target.effective_power()
            updated_card = current_target.add_permanent_power(self.buff_amount)
            new_power = updated_card.effective_power()

            buff_location = state.get_location(buff_loc_idx)
            updated_buff_loc = buff_location.update_card(updated_card)
            state = state.with_location(buff_loc_idx, updated_buff_loc)

            events.append(
                PowerChangedEvent(
                    card_instance_id=buff_card.instance_id,
                    old_power=old_power,
                    new_power=new_power,
                    source_card_id=source_card.instance_id,
                )
            )
            break  # Only buff one card

        return state, events


@dataclass(frozen=True, slots=True)
class DestroyAndGainPowerEffect:
    """
    Destroy another allied card and gain its power.

    Used for Hades.
    """

    destroy_target: TargetFilter
    """Which card to destroy."""

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Apply this effect to the game state."""
        events: list[GameEvent] = []

        # Check if there's an empty slot at this location (required by Hades)
        source_location_idx = state.find_card_location(source_card.instance_id)
        if source_location_idx is None:
            return state, events

        # Find card to destroy
        destroy_targets = _resolve_targets(state, source_card, source_player, self.destroy_target)
        if not destroy_targets:
            return state, events

        target_to_destroy = destroy_targets[0]
        target_loc_idx = state.find_card_location(target_to_destroy.instance_id)
        if target_loc_idx is None:
            return state, events

        # Get the power of the card being destroyed
        destroyed_power = target_to_destroy.effective_power()

        # Destroy the card
        location = state.get_location(target_loc_idx)
        updated_location, removed_card = location.remove_card(target_to_destroy.instance_id)

        if removed_card is None:
            return state, events

        state = state.with_location(target_loc_idx, updated_location)
        state = state.with_card_destroyed(target_to_destroy.instance_id)
        events.append(
            CardDestroyedEvent(
                card_instance_id=target_to_destroy.instance_id,
                location=target_loc_idx,
                source_card_id=source_card.instance_id,
            )
        )

        # Add the destroyed card's power to source card
        current_source = state.find_card_by_instance(source_card.instance_id)
        if current_source is not None:
            source_loc_idx = state.find_card_location(source_card.instance_id)
            if source_loc_idx is not None:
                old_power = current_source.effective_power()
                updated_source = current_source.add_permanent_power(Power(destroyed_power))
                new_power = updated_source.effective_power()

                source_loc = state.get_location(source_loc_idx)
                updated_source_loc = source_loc.update_card(updated_source)
                state = state.with_location(source_loc_idx, updated_source_loc)

                events.append(
                    PowerChangedEvent(
                        card_instance_id=source_card.instance_id,
                        old_power=old_power,
                        new_power=new_power,
                        source_card_id=source_card.instance_id,
                    )
                )

        return state, events


@dataclass(frozen=True, slots=True)
class ConditionalPowerEffect:
    """
    Add power to self if a condition is met.

    Used for:
    - Zeus: +6 if only card at location
    - Cerberus: +4 if destroyed a card this game
    - Poseidon: +2 to cards here if moved a card this turn
    """

    target: TargetFilter
    """Which cards to buff."""

    amount: Power
    """Amount of power to add."""

    condition: str
    """
    Condition that must be true:
    - "only_card_here": Source is the only card at this location for owner
    - "destroyed_this_game": At least one card destroyed this game
    - "moved_this_game": At least one card moved this game
    - "moved_this_turn": At least one card moved this turn
    - "has_empty_slot": Location has an empty slot
    """

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Apply this effect to the game state."""
        events: list[GameEvent] = []

        # Check condition
        if not self._check_condition(state, source_card, source_player):
            return state, events

        # Apply buff
        targets = _resolve_targets(state, source_card, source_player, self.target)

        for target_card in targets:
            location_idx = state.find_card_location(target_card.instance_id)
            if location_idx is None:
                continue

            current_target = state.find_card_by_instance(target_card.instance_id)
            if current_target is None:
                continue

            old_power = current_target.effective_power()
            updated_card = current_target.add_permanent_power(self.amount)
            new_power = updated_card.effective_power()

            location = state.get_location(location_idx)
            updated_location = location.update_card(updated_card)
            state = state.with_location(location_idx, updated_location)

            events.append(
                PowerChangedEvent(
                    card_instance_id=target_card.instance_id,
                    old_power=old_power,
                    new_power=new_power,
                    source_card_id=source_card.instance_id,
                )
            )

        return state, events

    def _check_condition(
        self, state: GameState, source_card: CardInstance, source_player: PlayerId
    ) -> bool:
        """Check if the condition is met."""
        source_location = state.find_card_location(source_card.instance_id)

        match self.condition:
            case "only_card_here":
                if source_location is None:
                    return False
                location = state.get_location(source_location)
                return location.card_count(source_player) == 1

            case "destroyed_this_game":
                return state.has_destroyed_card_this_game()

            case "moved_this_turn":
                return state.has_moved_card_this_turn()

            case "moved_this_game":
                return state.has_moved_card_this_game()

            case "has_empty_slot":
                if source_location is None:
                    return False
                return not state.location_is_full(source_location, source_player)

            case _:
                return True


@dataclass(frozen=True, slots=True)
class SilenceOngoingEffect:
    """
    Silence enemy ongoing abilities at a location (Gorgon Glare).

    This doesn't remove the cards, but marks them as silenced so their
    ongoing effects don't apply.
    """

    target: TargetFilter
    """Which cards to silence."""

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Apply this effect by marking cards as silenced."""
        targets = _resolve_targets(state, source_card, source_player, self.target)

        for target_card in targets:
            state = state.with_silenced_card(target_card.instance_id)

        return state, []

    def get_silenced_cards(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> Sequence[CardInstance]:
        """Get the cards that should be silenced by this ongoing effect."""
        return _resolve_targets(state, source_card, source_player, self.target)


@dataclass(frozen=True, slots=True)
class StealPowerEffect:
    """
    Steal power from an enemy card and add it to self.

    Used for Shade (Blood Offering) - drains life force from enemies.
    """

    target: TargetFilter
    """Which enemy card to steal from."""

    amount: Power
    """Amount of power to steal."""

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Apply this effect: reduce enemy power, increase self power."""
        events: list[GameEvent] = []

        # Find enemy target
        targets = _resolve_targets(state, source_card, source_player, self.target)
        if not targets:
            return state, events

        target_card = targets[0]
        target_loc_idx = state.find_card_location(target_card.instance_id)
        if target_loc_idx is None:
            return state, events

        # Reduce enemy power
        current_target = state.find_card_by_instance(target_card.instance_id)
        if current_target is None:
            return state, events

        old_target_power = current_target.effective_power()
        updated_target = current_target.add_permanent_power(Power(-self.amount))
        new_target_power = updated_target.effective_power()

        target_location = state.get_location(target_loc_idx)
        updated_target_loc = target_location.update_card(updated_target)
        state = state.with_location(target_loc_idx, updated_target_loc)

        events.append(
            PowerChangedEvent(
                card_instance_id=target_card.instance_id,
                old_power=old_target_power,
                new_power=new_target_power,
                source_card_id=source_card.instance_id,
            )
        )

        # Increase self power
        source_loc_idx = state.find_card_location(source_card.instance_id)
        if source_loc_idx is not None:
            current_source = state.find_card_by_instance(source_card.instance_id)
            if current_source is not None:
                old_source_power = current_source.effective_power()
                updated_source = current_source.add_permanent_power(self.amount)
                new_source_power = updated_source.effective_power()

                source_location = state.get_location(source_loc_idx)
                updated_source_loc = source_location.update_card(updated_source)
                state = state.with_location(source_loc_idx, updated_source_loc)

                events.append(
                    PowerChangedEvent(
                        card_instance_id=source_card.instance_id,
                        old_power=old_source_power,
                        new_power=new_source_power,
                        source_card_id=source_card.instance_id,
                    )
                )

        return state, events


@dataclass(frozen=True, slots=True)
class ScalingOngoingPowerEffect:
    """
    Ongoing power modifier that scales with the number of matching cards.

    Used for Athena (Divine Strategy) - allies grow stronger together.
    """

    target: TargetFilter
    """Which cards receive the buff."""

    per_card_amount: Power
    """Amount of power to add per matching card."""

    count_filter: TargetFilter
    """Which cards to count for scaling."""

    def get_affected_cards(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> Sequence[CardInstance]:
        """Get the cards affected by this ongoing effect."""
        return _resolve_targets(state, source_card, source_player, self.target)

    def get_scaling_amount(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> Power:
        """Calculate the power bonus based on card count."""
        count_cards = _resolve_targets(state, source_card, source_player, self.count_filter)
        return Power(len(count_cards) * self.per_card_amount)


@dataclass(frozen=True, slots=True)
class ScalingPowerEffect:
    """
    On-reveal power modifier that scales with destroyed card count.

    Used for Underworld Gate (Wealth of the Dead) - grows from death.
    """

    target: TargetFilter
    """Which cards receive the buff (usually SELF)."""

    per_destroyed_amount: Power
    """Amount of power to add per destroyed card this game."""

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Apply scaling power based on destroyed cards."""
        events: list[GameEvent] = []

        # Calculate bonus
        destroyed_count = len(state.cards_destroyed_this_game)
        total_bonus = Power(destroyed_count * self.per_destroyed_amount)

        if total_bonus == 0:
            return state, events

        targets = _resolve_targets(state, source_card, source_player, self.target)

        for target_card in targets:
            location_idx = state.find_card_location(target_card.instance_id)
            if location_idx is None:
                continue

            current_target = state.find_card_by_instance(target_card.instance_id)
            if current_target is None:
                continue

            old_power = current_target.effective_power()
            updated_card = current_target.add_permanent_power(total_bonus)
            new_power = updated_card.effective_power()

            location = state.get_location(location_idx)
            updated_location = location.update_card(updated_card)
            state = state.with_location(location_idx, updated_location)

            events.append(
                PowerChangedEvent(
                    card_instance_id=target_card.instance_id,
                    old_power=old_power,
                    new_power=new_power,
                    source_card_id=source_card.instance_id,
                )
            )

        return state, events


@dataclass(frozen=True, slots=True)
class ReviveEffect:
    """
    Summon a spirit based on the number of destroyed cards this game.

    Used for Hades (Claim the Soul) - lord of the dead commands spirits.
    The spirit's power equals the number of cards destroyed this game.
    """

    base_spirit_power: Power = Power(2)
    """Base power of the summoned spirit."""

    def apply(
        self,
        state: GameState,
        source_card: CardInstance,
        source_player: PlayerId,
    ) -> tuple[GameState, list[GameEvent]]:
        """Summon a spirit whose power scales with destroyed cards."""
        events: list[GameEvent] = []

        # Find the source location
        source_loc_idx = state.find_card_location(source_card.instance_id)
        if source_loc_idx is None:
            return state, events

        # Check if location has space
        location = state.get_location(source_loc_idx)
        if location.card_count(source_player) >= LOCATION_CAPACITY:
            return state, events

        # Must have destroyed at least one card
        if not state.cards_destroyed_this_game:
            return state, events

        from engine.cards import get_card_def
        from engine.types import CardId
        from engine.models import CardInstance, InstanceId

        # Use Shade as the spirit template (thematic)
        spirit_def = get_card_def(CardId("shade"))
        if spirit_def is None:
            return state, events

        # Spirit power = base + number of destroyed cards
        destroyed_count = len(state.cards_destroyed_this_game)
        spirit_bonus = Power(self.base_spirit_power + destroyed_count)

        # Create new spirit instance
        new_instance_id = state.next_instance_id
        spirit_card = CardInstance(
            instance_id=new_instance_id,
            card_def=spirit_def,
            owner=source_player,
            permanent_power_modifier=spirit_bonus,  # Bonus makes spirit scale with deaths
            revealed=True,
        )

        # Add to location
        updated_location = location.add_card(spirit_card, source_player)
        state = state.with_location(source_loc_idx, updated_location)
        state = state.with_next_instance_id(InstanceId(new_instance_id + 1))

        return state, events


# Type alias for all effect types
Effect = (
    AddPowerEffect
    | AddOngoingPowerEffect
    | ConditionalOngoingPowerEffect
    | MoveCardEffect
    | DestroyCardEffect
    | DestroyAndBuffEffect
    | DestroyAndGainPowerEffect
    | ConditionalPowerEffect
    | SilenceOngoingEffect
    | StealPowerEffect
    | ScalingOngoingPowerEffect
    | ScalingPowerEffect
    | ReviveEffect
)


# =============================================================================
# Target Resolution
# =============================================================================


def _resolve_targets(
    state: GameState,
    source_card: CardInstance,
    source_player: PlayerId,
    target_filter: TargetFilter,
) -> Sequence[CardInstance]:
    """
    Resolve which cards match the given target filter.

    Args:
        state: Current game state
        source_card: The card whose effect is being applied
        source_player: The player who owns the source card
        target_filter: The filter to apply

    Returns:
        Sequence of matching card instances
    """
    source_location = state.find_card_location(source_card.instance_id)

    match target_filter:
        case TargetFilter.SELF:
            return [source_card]

        case TargetFilter.SAME_LOCATION_FRIENDLY:
            if source_location is None:
                return []
            location = state.get_location(source_location)
            return [
                c
                for c in location.get_cards(source_player)
                if c.instance_id != source_card.instance_id
            ]

        case TargetFilter.SAME_LOCATION_ENEMY:
            if source_location is None:
                return []
            enemy_player = PlayerId(1 - source_player)
            location = state.get_location(source_location)
            return list(location.get_cards(enemy_player))

        case TargetFilter.SAME_LOCATION_ALL:
            if source_location is None:
                return []
            location = state.get_location(source_location)
            return [c for c in location.all_cards() if c.instance_id != source_card.instance_id]

        case TargetFilter.ALL_FRIENDLY:
            result: list[CardInstance] = []
            for location in state.locations:
                for card in location.get_cards(source_player):
                    if card.instance_id != source_card.instance_id:
                        result.append(card)
            return result

        case TargetFilter.ALL_ENEMY:
            enemy_player = PlayerId(1 - source_player)
            result = []
            for location in state.locations:
                result.extend(location.get_cards(enemy_player))
            return result

        case TargetFilter.ALL_CARDS:
            result = []
            for location in state.locations:
                for card in location.all_cards():
                    if card.instance_id != source_card.instance_id:
                        result.append(card)
            return result

        case TargetFilter.OTHER_LOCATIONS_FRIENDLY:
            if source_location is None:
                # If not on board, consider all locations
                result = []
                for location in state.locations:
                    result.extend(location.get_cards(source_player))
                return result

            result = []
            for location in state.locations:
                if location.index != source_location:
                    result.extend(location.get_cards(source_player))
            return result

        case TargetFilter.LEFTMOST_FRIENDLY:
            # Find leftmost friendly card across all locations
            for location in state.locations:
                cards = location.get_cards(source_player)
                if cards:
                    return [cards[0]]
            return []

        case TargetFilter.RIGHTMOST_FRIENDLY:
            # Find rightmost friendly card across all locations
            for location in reversed(state.locations):
                cards = location.get_cards(source_player)
                if cards:
                    return [cards[-1]]
            return []

        case TargetFilter.ONE_SAME_LOCATION_FRIENDLY:
            # One other friendly card at the same location (first found, excluding self)
            if source_location is None:
                return []
            location = state.get_location(source_location)
            for card in location.get_cards(source_player):
                if card.instance_id != source_card.instance_id:
                    return [card]
            return []

        case TargetFilter.ONE_SAME_LOCATION_ENEMY:
            # One enemy card at the same location (first found)
            if source_location is None:
                return []
            enemy_player = PlayerId(1 - source_player)
            location = state.get_location(source_location)
            cards = location.get_cards(enemy_player)
            if cards:
                return [cards[0]]
            return []

        case TargetFilter.FRIENDLY_WITH_DESTROY_TAG:
            # All friendly cards that have the 'Destroy' tag
            result = []
            for location in state.locations:
                for card in location.get_cards(source_player):
                    if "Destroy" in card.card_def.tags:
                        result.append(card)
            return result

    # This should never be reached due to exhaustive match
    return []


# =============================================================================
# Ongoing Effect Resolution
# =============================================================================


def compute_ongoing_effects(state: GameState) -> tuple[GameState, list[GameEvent]]:
    """
    Recompute all ongoing effects on the board.

    This should be called after each reveal phase to ensure ongoing
    effects are correctly applied.

    Returns:
        Tuple of (updated_state, events_generated)
    """
    events: list[GameEvent] = []

    # First, reset all ONGOING power modifiers to 0 (preserve permanent modifiers)
    for loc_idx, location in enumerate(state.locations):
        new_cards_by_player: dict[PlayerId, tuple[CardInstance, ...]] = {}

        for player_id, cards in location.cards_by_player.items():
            reset_cards = tuple(card.with_ongoing_power_modifier(Power(0)) for card in cards)
            new_cards_by_player[player_id] = reset_cards

        updated_location = LocationState(
            index=LocationIndex(loc_idx),
            cards_by_player=new_cards_by_player,
        )
        state = state.with_location(LocationIndex(loc_idx), updated_location)

    # Clear silenced cards and recompute (silence is an ongoing effect)
    state = GameState(
        turn=state.turn,
        phase=state.phase,
        players=state.players,
        locations=state.locations,
        result=state.result,
        next_instance_id=state.next_instance_id,
        cards_destroyed_this_game=state.cards_destroyed_this_game,
        cards_moved_this_game=state.cards_moved_this_game,
        cards_moved_this_turn=state.cards_moved_this_turn,
        silenced_cards=(),  # Clear silenced cards
    )

    # Apply silence effects first (from cards like Gorgon Glare)
    from engine.types import AbilityType

    for location in state.locations:
        for card in location.all_cards():
            if not card.revealed:
                continue
            if card.card_def.ability_type != AbilityType.ONGOING:
                continue

            for effect in card.card_def.effects:
                if isinstance(effect, SilenceOngoingEffect):
                    silenced = effect.get_silenced_cards(state, card, card.owner)
                    for target in silenced:
                        state = state.with_silenced_card(target.instance_id)

    # Then, apply all ongoing power effects from revealed, non-silenced cards
    for location in state.locations:
        for card in location.all_cards():
            if not card.revealed:
                continue

            if card.card_def.ability_type != AbilityType.ONGOING:
                continue

            # Skip if this card is silenced
            if state.is_silenced(card.instance_id):
                continue

            for effect in card.card_def.effects:
                if isinstance(effect, AddOngoingPowerEffect):
                    # Get affected cards and apply ongoing power modifier
                    affected = effect.get_affected_cards(state, card, card.owner)

                    for target in affected:
                        target_loc_idx = state.find_card_location(target.instance_id)
                        if target_loc_idx is None:
                            continue

                        # Get the current version of the target card from state
                        current_target = state.find_card_by_instance(target.instance_id)
                        if current_target is None:
                            continue

                        old_power = current_target.effective_power()
                        updated_target = current_target.add_ongoing_power(effect.amount)
                        new_power = updated_target.effective_power()

                        target_location = state.get_location(target_loc_idx)
                        updated_location = target_location.update_card(updated_target)
                        state = state.with_location(target_loc_idx, updated_location)

                        events.append(
                            PowerChangedEvent(
                                card_instance_id=target.instance_id,
                                old_power=old_power,
                                new_power=new_power,
                                source_card_id=card.instance_id,
                            )
                        )

                elif isinstance(effect, ConditionalOngoingPowerEffect):
                    # Get affected cards (returns empty if condition not met)
                    affected = effect.get_affected_cards(state, card, card.owner)

                    for target in affected:
                        target_loc_idx = state.find_card_location(target.instance_id)
                        if target_loc_idx is None:
                            continue

                        current_target = state.find_card_by_instance(target.instance_id)
                        if current_target is None:
                            continue

                        old_power = current_target.effective_power()
                        updated_target = current_target.add_ongoing_power(effect.amount)
                        new_power = updated_target.effective_power()

                        target_location = state.get_location(target_loc_idx)
                        updated_location = target_location.update_card(updated_target)
                        state = state.with_location(target_loc_idx, updated_location)

                        events.append(
                            PowerChangedEvent(
                                card_instance_id=target.instance_id,
                                old_power=old_power,
                                new_power=new_power,
                                source_card_id=card.instance_id,
                            )
                        )

                elif isinstance(effect, ScalingOngoingPowerEffect):
                    # Get affected cards and scaling amount
                    affected = effect.get_affected_cards(state, card, card.owner)
                    scaling_amount = effect.get_scaling_amount(state, card, card.owner)

                    if scaling_amount == 0:
                        continue

                    for target in affected:
                        target_loc_idx = state.find_card_location(target.instance_id)
                        if target_loc_idx is None:
                            continue

                        current_target = state.find_card_by_instance(target.instance_id)
                        if current_target is None:
                            continue

                        old_power = current_target.effective_power()
                        updated_target = current_target.add_ongoing_power(scaling_amount)
                        new_power = updated_target.effective_power()

                        target_location = state.get_location(target_loc_idx)
                        updated_location = target_location.update_card(updated_target)
                        state = state.with_location(target_loc_idx, updated_location)

                        events.append(
                            PowerChangedEvent(
                                card_instance_id=target.instance_id,
                                old_power=old_power,
                                new_power=new_power,
                                source_card_id=card.instance_id,
                            )
                        )

    return state, events
