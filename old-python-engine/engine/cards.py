"""
Greek Mythology card definitions for Fates of Olympus.

This module loads card definitions from cards.json, providing a single source of truth
for all card data including stats, effects, and flavor text.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from engine.types import (
    CardId,
    Energy,
    Power,
    AbilityType,
    TargetFilter,
)
from engine.models import CardDef
from engine.effects import (
    Effect,
    AddPowerEffect,
    AddOngoingPowerEffect,
    ConditionalOngoingPowerEffect,
    MoveCardEffect,
    DestroyCardEffect,
    DestroyAndBuffEffect,
    DestroyAndGainPowerEffect,
    ConditionalPowerEffect,
    SilenceOngoingEffect,
    StealPowerEffect,
    ScalingOngoingPowerEffect,
    ScalingPowerEffect,
    ReviveEffect,
)


# =============================================================================
# JSON Loading and Parsing
# =============================================================================

# Path to the cards.json file (relative to this module)
CARDS_JSON_PATH = Path(__file__).parent.parent.parent / "cards.json"


def _parse_target_filter(target_str: str) -> TargetFilter:
    """Parse a target filter string into a TargetFilter enum value."""
    return TargetFilter[target_str]


def _parse_ability_type(ability_str: str) -> AbilityType:
    """Parse an ability type string into an AbilityType enum value."""
    return AbilityType[ability_str]


def _parse_effect(effect_data: dict[str, Any]) -> Effect:
    """Parse an effect dictionary into an Effect object."""
    effect_type = effect_data["type"]

    match effect_type:
        case "AddPowerEffect":
            return AddPowerEffect(
                target=_parse_target_filter(effect_data["target"]),
                amount=Power(effect_data["amount"]),
            )

        case "AddOngoingPowerEffect":
            return AddOngoingPowerEffect(
                target=_parse_target_filter(effect_data["target"]),
                amount=Power(effect_data["amount"]),
            )

        case "ConditionalOngoingPowerEffect":
            return ConditionalOngoingPowerEffect(
                target=_parse_target_filter(effect_data["target"]),
                amount=Power(effect_data["amount"]),
                condition=effect_data["condition"],
            )

        case "MoveCardEffect":
            return MoveCardEffect(
                target=_parse_target_filter(effect_data["target"]),
                to_other_location=effect_data.get("to_other_location", False),
                destination=effect_data.get("destination"),
            )

        case "DestroyCardEffect":
            return DestroyCardEffect(
                target=_parse_target_filter(effect_data["target"]),
            )

        case "DestroyAndBuffEffect":
            return DestroyAndBuffEffect(
                destroy_target=_parse_target_filter(effect_data["destroy_target"]),
                buff_target=_parse_target_filter(effect_data["buff_target"]),
                buff_amount=Power(effect_data["buff_amount"]),
            )

        case "DestroyAndGainPowerEffect":
            return DestroyAndGainPowerEffect(
                destroy_target=_parse_target_filter(effect_data["destroy_target"]),
            )

        case "ConditionalPowerEffect":
            return ConditionalPowerEffect(
                target=_parse_target_filter(effect_data["target"]),
                amount=Power(effect_data["amount"]),
                condition=effect_data["condition"],
            )

        case "SilenceOngoingEffect":
            return SilenceOngoingEffect(
                target=_parse_target_filter(effect_data["target"]),
            )

        case "StealPowerEffect":
            return StealPowerEffect(
                target=_parse_target_filter(effect_data["target"]),
                amount=Power(effect_data["amount"]),
            )

        case "ScalingOngoingPowerEffect":
            return ScalingOngoingPowerEffect(
                target=_parse_target_filter(effect_data["target"]),
                per_card_amount=Power(effect_data["per_card_amount"]),
                count_filter=_parse_target_filter(effect_data["count_filter"]),
            )

        case "ScalingPowerEffect":
            return ScalingPowerEffect(
                target=_parse_target_filter(effect_data["target"]),
                per_destroyed_amount=Power(effect_data["per_destroyed_amount"]),
            )

        case "ReviveEffect":
            return ReviveEffect()

        case _:
            raise ValueError(f"Unknown effect type: {effect_type}")


def _parse_card_def(card_data: dict[str, Any]) -> CardDef:
    """Parse a card dictionary into a CardDef object."""
    effects = tuple(_parse_effect(e) for e in card_data.get("effects", []))

    return CardDef(
        id=CardId(card_data["id"]),
        name=card_data["name"],
        cost=Energy(card_data["cost"]),
        base_power=Power(card_data["base_power"]),
        text=card_data.get("text", ""),
        ability_type=_parse_ability_type(card_data["ability_type"]),
        effects=effects,
        tags=frozenset(card_data.get("tags", [])),
    )


def _load_cards_from_json() -> tuple[tuple[CardDef, ...], dict[str, list[str]]]:
    """
    Load all card definitions from the JSON file.

    Returns:
        Tuple of (all_cards, deck_definitions)
    """
    with open(CARDS_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    cards = tuple(_parse_card_def(card_data) for card_data in data["cards"])
    decks = data.get("decks", {})

    return cards, decks


# =============================================================================
# Card Data (loaded from JSON)
# =============================================================================


class _CardDataStore:
    """
    Mutable container for card data.
    
    This allows hot-reloading of card definitions without module reimport.
    Using a class avoids pyright's constant redefinition warnings.
    """
    
    def __init__(self) -> None:
        self.all_cards: tuple[CardDef, ...]
        self.deck_definitions: dict[str, list[str]]
        self.registry: dict[CardId, CardDef]
        self._load()
    
    def _load(self) -> None:
        """Load card data from JSON."""
        self.all_cards, self.deck_definitions = _load_cards_from_json()
        self.registry = {card.id: card for card in self.all_cards}
    
    def reload(self) -> None:
        """Reload card data from JSON."""
        self._load()


# Initialize card data at module import time
_card_data = _CardDataStore()

# Public API - access card data through the store
ALL_CARDS: tuple[CardDef, ...] = _card_data.all_cards
CARD_REGISTRY: dict[CardId, CardDef] = _card_data.registry


# =============================================================================
# Public API Functions
# =============================================================================


def get_card_def(card_id: CardId) -> CardDef | None:
    """Get a card definition by ID."""
    return _card_data.registry.get(card_id)


def get_starter_deck_defs() -> tuple[CardDef, ...]:
    """
    Get a balanced starter deck of 12 cards.

    Returns cards suitable for a starter deck, providing a mix of
    costs and ability types.
    """
    card_ids = _card_data.deck_definitions.get("starter", [])
    return tuple(_card_data.registry[CardId(cid)] for cid in card_ids if CardId(cid) in _card_data.registry)


def get_destroy_deck_defs() -> tuple[CardDef, ...]:
    """
    Get a destroy-synergy deck of 12 cards.

    Focuses on destroy mechanics and synergies.
    """
    card_ids = _card_data.deck_definitions.get("destroy", [])
    return tuple(_card_data.registry[CardId(cid)] for cid in card_ids if CardId(cid) in _card_data.registry)


def get_move_deck_defs() -> tuple[CardDef, ...]:
    """
    Get a move-synergy deck of 12 cards.

    Focuses on move mechanics and synergies.
    """
    card_ids = _card_data.deck_definitions.get("move", [])
    return tuple(_card_data.registry[CardId(cid)] for cid in card_ids if CardId(cid) in _card_data.registry)


def reload_cards() -> None:
    """
    Reload card definitions from the JSON file.

    This allows runtime reloading of card data without restarting the application.
    Useful for development and testing balance changes.
    
    Note: Updates the internal store. Modules that imported ALL_CARDS or CARD_REGISTRY
    directly at import time will need to re-import to see changes.
    """
    _card_data.reload()
    # Update module-level references for code that accesses them directly
    global ALL_CARDS, CARD_REGISTRY  # noqa: PLW0603
    ALL_CARDS = _card_data.all_cards  # type: ignore[misc]
    CARD_REGISTRY = _card_data.registry  # type: ignore[misc]


# =============================================================================
# Convenience: Individual Card Constants (for backwards compatibility)
# =============================================================================

# These provide named access to individual cards for code that references them directly.
# They are populated from the registry after loading.


def _get_card(card_id: str) -> CardDef:
    """Get a card by ID, raising if not found."""
    card = CARD_REGISTRY.get(CardId(card_id))
    if card is None:
        raise KeyError(f"Card not found: {card_id}")
    return card


# 1-Cost Cards
HOPLITE = _get_card("hoplite")
SATYR = _get_card("satyr")
NAIAD_NYMPH = _get_card("naiad_nymph")
SHADE = _get_card("shade")
HARPIES = _get_card("harpies")

# 2-Cost Cards
ARGIVE_SCOUT = _get_card("argive_scout")
IRIS = _get_card("iris")
HERMES = _get_card("hermes")
PHAETHON = _get_card("phaethon")
GORGON_GLARE = _get_card("gorgon_glare")

# 3-Cost Cards
ATHENA = _get_card("athena")
ARES = _get_card("ares")
MEDUSA = _get_card("medusa")
MYRMIDON = _get_card("myrmidon")
UNDERWORLD_GATE = _get_card("underworld_gate")

# 4-Cost Cards
PEGASUS_RIDER = _get_card("pegasus_rider")
MINOTAUR = _get_card("minotaur")
HECATE = _get_card("hecate")
POSEIDON = _get_card("poseidon")

# 5-Cost Cards
CERBERUS = _get_card("cerberus")
HADES = _get_card("hades")
CYCLOPS = _get_card("cyclops")

# 6-Cost Cards
ZEUS = _get_card("zeus")
TITAN_ATLAS = _get_card("titan_atlas")
