"""
Fates of Olympus - Core Game Engine

A data-driven card game engine with immutable state snapshots and typed event logging.
This package contains pure game logic with no I/O dependencies.
"""

from engine.types import (
    CardId,
    InstanceId,
    PlayerId,
    LocationIndex,
    TurnNumber,
    Energy,
    Power,
    AbilityType,
    TargetFilter,
    ActionType,
    GamePhase,
    GameResult,
)
from engine.models import (
    CardDef,
    CardInstance,
    PlayerState,
    LocationState,
    GameState,
    PlayerAction,
    PlayCardAction,
    PassAction,
)
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
)
from engine.controller import GameController

__all__ = [
    # Types
    "CardId",
    "InstanceId",
    "PlayerId",
    "LocationIndex",
    "TurnNumber",
    "Energy",
    "Power",
    "AbilityType",
    "TargetFilter",
    "ActionType",
    "GamePhase",
    "GameResult",
    # Models
    "CardDef",
    "CardInstance",
    "PlayerState",
    "LocationState",
    "GameState",
    "PlayerAction",
    "PlayCardAction",
    "PassAction",
    # Effects
    "Effect",
    "AddPowerEffect",
    "AddOngoingPowerEffect",
    "ConditionalOngoingPowerEffect",
    "MoveCardEffect",
    "DestroyCardEffect",
    "DestroyAndBuffEffect",
    "DestroyAndGainPowerEffect",
    "ConditionalPowerEffect",
    "SilenceOngoingEffect",
    # Controller
    "GameController",
]
