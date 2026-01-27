#!/usr/bin/env python3
"""
Command-Line Interface for Fates of Olympus.

This is a presentation layer adapter that:
- Renders game state to the terminal
- Collects player input
- Displays the event log for each turn

The CLI can be replaced with any other UI (web, mobile, GUI) by implementing
the same interface to the GameController.

Usage:
    python cli.py
"""

from __future__ import annotations

import sys
from typing import TextIO

from engine.types import (
    PlayerId,
    LocationIndex,
    InstanceId,
    Power,
    GameResult,
    MAX_TURNS,
)
from engine.models import (
    GameState,
    PlayerAction,
    PlayCardAction,
    PassAction,
    CardInstance,
)
from engine.controller import GameController
from engine.events import (
    GameEvent,
    TurnStartedEvent,
    TurnEndedEvent,
    EnergySetEvent,
    EnergySpentEvent,
    CardDrawnEvent,
    CardPlayedEvent,
    CardRevealedEvent,
    CardMovedEvent,
    CardDestroyedEvent,
    PowerChangedEvent,
    PlayerPassedEvent,
    ActionInvalidEvent,
    GameStartedEvent,
    GameEndedEvent,
)


# =============================================================================
# Display Functions
# =============================================================================


def print_header(turn: int, output: TextIO = sys.stdout) -> None:
    """Print turn header."""
    output.write("\n")
    output.write("=" * 60 + "\n")
    output.write(f"                    TURN {turn} / {MAX_TURNS}\n")
    output.write("=" * 60 + "\n")


def print_player_status(state: GameState, player_id: PlayerId, output: TextIO = sys.stdout) -> None:
    """Print player's current status (energy, hand)."""
    player = state.get_player(player_id)
    output.write(f"\n--- Player {player_id} ---\n")
    output.write(f"Energy: {player.energy} / {player.max_energy}\n")
    output.write(f"Deck: {len(player.deck)} cards\n")
    output.write(f"Hand ({len(player.hand)} cards):\n")

    if not player.hand:
        output.write("  (empty)\n")
    else:
        for card in player.hand:
            output.write(
                f"  [{card.instance_id}] {card.card_def.name} "
                f"(Cost: {card.card_def.cost}, Power: {card.card_def.base_power})\n"
            )
            if card.card_def.text:
                output.write(f"      {card.card_def.text}\n")


def print_board(state: GameState, output: TextIO = sys.stdout) -> None:
    """Print the current board state."""
    output.write("\n" + "-" * 60 + "\n")
    output.write("                      BOARD\n")
    output.write("-" * 60 + "\n")

    for loc_idx in range(3):
        location = state.get_location(LocationIndex(loc_idx))
        p0_power = location.total_power(PlayerId(0))
        p1_power = location.total_power(PlayerId(1))

        output.write(f"\nLocation {loc_idx}:  [P0: {p0_power}]  vs  [P1: {p1_power}]\n")

        # Player 0 cards
        p0_cards = location.get_cards(PlayerId(0))
        output.write("  P0: ")
        if p0_cards:
            card_strs = [_format_board_card(c) for c in p0_cards]
            output.write(", ".join(card_strs))
        else:
            output.write("(none)")
        output.write("\n")

        # Player 1 cards
        p1_cards = location.get_cards(PlayerId(1))
        output.write("  P1: ")
        if p1_cards:
            card_strs = [_format_board_card(c) for c in p1_cards]
            output.write(", ".join(card_strs))
        else:
            output.write("(none)")
        output.write("\n")


def _format_board_card(card: CardInstance) -> str:
    """Format a card on the board for display."""
    power = card.effective_power()
    base = card.card_def.base_power

    if power != base:
        return f"{card.card_def.name}({power}*)"
    else:
        return f"{card.card_def.name}({power})"


def print_events(events: list[GameEvent], state: GameState, output: TextIO = sys.stdout) -> None:
    """Print the event log for a turn."""
    output.write("\n" + "-" * 60 + "\n")
    output.write("                    EVENT LOG\n")
    output.write("-" * 60 + "\n")

    for event in events:
        msg = _format_event(event, state)
        if msg:
            output.write(f"  > {msg}\n")


def _format_event(event: GameEvent, state: GameState) -> str:
    """Format a single event for display."""
    match event:
        case GameStartedEvent():
            return "Game started!"

        case TurnStartedEvent(turn=turn):
            return f"Turn {turn} started"

        case TurnEndedEvent(turn=turn):
            return f"Turn {turn} ended"

        case EnergySetEvent(player_id=pid, energy=energy):
            return f"Player {pid} energy set to {energy}"

        case EnergySpentEvent(player_id=pid, amount=amount, remaining=remaining):
            return f"Player {pid} spent {amount} energy ({remaining} remaining)"

        case CardDrawnEvent(player_id=pid, card_instance_id=iid):
            card = state.find_card_by_instance(iid)
            name = card.card_def.name if card else f"Card #{iid}"
            return f"Player {pid} drew {name}"

        case CardPlayedEvent(player_id=pid, card_instance_id=iid, location=loc):
            card = state.find_card_by_instance(iid)
            name = card.card_def.name if card else f"Card #{iid}"
            return f"Player {pid} played {name} at location {loc}"

        case CardRevealedEvent(card_instance_id=iid, location=loc, player_id=pid):
            card = state.find_card_by_instance(iid)
            name = card.card_def.name if card else f"Card #{iid}"
            return f"{name} revealed at location {loc}"

        case CardMovedEvent(
            card_instance_id=iid, from_location=from_loc, to_location=to_loc, source_card_id=_
        ):
            card = state.find_card_by_instance(iid)
            name = card.card_def.name if card else f"Card #{iid}"
            return f"{name} moved from location {from_loc} to {to_loc}"

        case CardDestroyedEvent(card_instance_id=iid, location=loc, source_card_id=_):
            # Card no longer in state, so we can't get its name
            return f"Card #{iid} destroyed at location {loc}"

        case PowerChangedEvent(
            card_instance_id=iid, old_power=old, new_power=new, source_card_id=_
        ):
            card = state.find_card_by_instance(iid)
            name = card.card_def.name if card else f"Card #{iid}"
            diff = new - old
            sign = "+" if diff > 0 else ""
            return f"{name} power changed: {old} -> {new} ({sign}{diff})"

        case PlayerPassedEvent(player_id=pid):
            return f"Player {pid} passed"

        case ActionInvalidEvent(player_id=pid, reason=reason):
            return f"Player {pid}'s action was invalid: {reason}"

        case GameEndedEvent(
            result=result,
            location_winners=loc_winners,
            location_powers=loc_powers,
            total_power=total,
        ):
            lines: list[str] = ["Game Over!"]

            for i, (winner, powers) in enumerate(zip(loc_winners, loc_powers)):
                p0_pow, p1_pow = powers
                if winner is None:
                    winner_str = "TIE"
                else:
                    winner_str = f"P{winner} wins"
                lines.append(f"  Location {i}: P0={p0_pow} vs P1={p1_pow} -> {winner_str}")

            lines.append(f"  Total Power: P0={total[0]} vs P1={total[1]}")

            match result:
                case GameResult.PLAYER_0_WINS:
                    lines.append("  PLAYER 0 WINS!")
                case GameResult.PLAYER_1_WINS:
                    lines.append("  PLAYER 1 WINS!")
                case GameResult.DRAW:
                    lines.append("  IT'S A DRAW!")
                case _:
                    pass

            return "\n".join(lines)

        case _:
            return ""


def print_game_result(state: GameState, output: TextIO = sys.stdout) -> None:
    """Print the final game result."""
    from engine.rules import compute_winner, compute_location_powers

    result, location_winners = compute_winner(state)
    location_powers = compute_location_powers(state)
    total_power = (
        Power(sum(p[0] for p in location_powers)),
        Power(sum(p[1] for p in location_powers)),
    )

    output.write("\n")
    output.write("=" * 60 + "\n")
    output.write("                   GAME OVER\n")
    output.write("=" * 60 + "\n\n")

    for i, (winner, powers) in enumerate(zip(location_winners, location_powers)):
        p0_pow, p1_pow = powers
        if winner is None:
            winner_str = "TIE"
        else:
            winner_str = f"Player {winner} wins"
        output.write(f"Location {i}: P0={p0_pow} vs P1={p1_pow} -> {winner_str}\n")

    output.write(f"\nTotal Power: P0={total_power[0]} vs P1={total_power[1]}\n\n")

    match result:
        case GameResult.PLAYER_0_WINS:
            output.write("*** PLAYER 0 WINS! ***\n")
        case GameResult.PLAYER_1_WINS:
            output.write("*** PLAYER 1 WINS! ***\n")
        case GameResult.DRAW:
            output.write("*** IT'S A DRAW! ***\n")
        case _:
            pass


# =============================================================================
# Input Functions
# =============================================================================


def get_player_action(
    state: GameState,
    player_id: PlayerId,
    input_stream: TextIO = sys.stdin,
    output: TextIO = sys.stdout,
) -> PlayerAction:
    """
    Get a player's action from input.

    Accepts:
    - "play <instance_id> <location>" to play a card
    - "pass" to pass

    Returns a validated PlayerAction.
    """
    player = state.get_player(player_id)

    while True:
        output.write(f"\nPlayer {player_id}, enter action (play <id> <loc> | pass): ")
        output.flush()

        try:
            line = input_stream.readline()
            if not line:
                # EOF - treat as pass
                return PassAction(player_id=player_id)

            line = line.strip().lower()

            if line == "pass":
                return PassAction(player_id=player_id)

            if line.startswith("play "):
                parts = line.split()
                if len(parts) != 3:
                    output.write("Usage: play <card_id> <location>\n")
                    continue

                try:
                    instance_id = InstanceId(int(parts[1]))
                    location = LocationIndex(int(parts[2]))
                except ValueError:
                    output.write("Card ID and location must be numbers.\n")
                    continue

                if location not in (LocationIndex(0), LocationIndex(1), LocationIndex(2)):
                    output.write("Location must be 0, 1, or 2.\n")
                    continue

                # Check card exists in hand
                found = any(c.instance_id == instance_id for c in player.hand)
                if not found:
                    output.write(f"Card {instance_id} not in hand.\n")
                    continue

                return PlayCardAction(
                    player_id=player_id,
                    card_instance_id=instance_id,
                    location=location,
                )

            output.write("Unknown command. Use 'play <id> <loc>' or 'pass'.\n")

        except KeyboardInterrupt:
            output.write("\nGame interrupted.\n")
            sys.exit(0)


# =============================================================================
# Game Loop
# =============================================================================


def run_game(
    input_stream: TextIO = sys.stdin,
    output: TextIO = sys.stdout,
) -> GameState:
    """
    Run a complete game in the terminal.

    Args:
        input_stream: Source for player input (default: stdin)
        output: Destination for game output (default: stdout)

    Returns:
        The final GameState
    """
    controller = GameController()

    # Create game
    state, events = controller.create_game()
    print_events(events, state, output)

    # Game loop
    while state.result == GameResult.IN_PROGRESS:
        # Start turn
        state, turn_events = controller.start_turn(state)

        # Display game state
        print_header(state.turn, output)
        print_board(state, output)
        print_player_status(state, PlayerId(0), output)
        print_player_status(state, PlayerId(1), output)

        # Collect actions
        action_p0 = get_player_action(state, PlayerId(0), input_stream, output)
        action_p1 = get_player_action(state, PlayerId(1), input_stream, output)

        # Resolve turn
        state, resolve_events = controller.resolve_turn(state, action_p0, action_p1)

        # Print events
        all_events = turn_events + resolve_events
        print_events(all_events, state, output)

    # Print final result
    print_board(state, output)
    print_game_result(state, output)

    return state


def main() -> None:
    """Entry point for CLI."""
    print("=" * 60)
    print("           FATES OF OLYMPUS - Card Battle Game")
    print("=" * 60)
    print()
    print("Welcome! This is a 2-player card game.")
    print("Each turn, play a card to one of 3 locations or pass.")
    print("Win by having more power at 2 of 3 locations after 6 turns.")
    print()
    print("Commands:")
    print("  play <card_id> <location>  - Play a card (0, 1, or 2)")
    print("  pass                       - Pass your turn")
    print()

    run_game()


if __name__ == "__main__":
    main()
