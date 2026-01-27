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
CARDS_JSON_PATH = Path(__file__).parent.parent / "cards.json"


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

# Load cards once at module import time
_ALL_CARDS, _DECK_DEFINITIONS = _load_cards_from_json()

# Public API - tuple of all card definitions
ALL_CARDS: tuple[CardDef, ...] = _ALL_CARDS

# Registry for quick lookup by ID
CARD_REGISTRY: dict[CardId, CardDef] = {card.id: card for card in ALL_CARDS}


# =============================================================================
# Public API Functions
# =============================================================================


def get_card_def(card_id: CardId) -> CardDef | None:
    """Get a card definition by ID."""
    return CARD_REGISTRY.get(card_id)


def get_starter_deck_defs() -> tuple[CardDef, ...]:
    """
    Get a balanced starter deck of 12 cards.

    Returns cards suitable for a starter deck, providing a mix of
    costs and ability types.
    """
    card_ids = _DECK_DEFINITIONS.get("starter", [])
    return tuple(CARD_REGISTRY[CardId(cid)] for cid in card_ids if CardId(cid) in CARD_REGISTRY)


def get_destroy_deck_defs() -> tuple[CardDef, ...]:
    """
    Get a destroy-synergy deck of 12 cards.

    Focuses on destroy mechanics and synergies.
    """
    card_ids = _DECK_DEFINITIONS.get("destroy", [])
    return tuple(CARD_REGISTRY[CardId(cid)] for cid in card_ids if CardId(cid) in CARD_REGISTRY)


def get_move_deck_defs() -> tuple[CardDef, ...]:
    """
    Get a move-synergy deck of 12 cards.

    Focuses on move mechanics and synergies.
    """
    card_ids = _DECK_DEFINITIONS.get("move", [])
    return tuple(CARD_REGISTRY[CardId(cid)] for cid in card_ids if CardId(cid) in CARD_REGISTRY)


def reload_cards() -> None:
    """
    Reload card definitions from the JSON file.

    This allows runtime reloading of card data without restarting the application.
    Useful for development and testing balance changes.
    """
    global _ALL_CARDS, _DECK_DEFINITIONS, ALL_CARDS, CARD_REGISTRY

    _ALL_CARDS, _DECK_DEFINITIONS = _load_cards_from_json()
    ALL_CARDS = _ALL_CARDS
    CARD_REGISTRY = {card.id: card for card in ALL_CARDS}


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
