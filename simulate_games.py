#!/usr/bin/env python3
"""
Game Simulation Script for Card Balancing

Runs random games and collects statistics for each card to help with balancing.
Supports parallel execution for faster simulations.
"""

from __future__ import annotations

import random
import multiprocessing as mp
from dataclasses import dataclass, field
from collections import defaultdict
from typing import TypeAlias
from functools import partial

from engine.controller import GameController
from engine.models import GameState, PlayerAction, PassAction, PlayCardAction, CardDef
from engine.cards import ALL_CARDS, get_starter_deck_defs
from engine.types import (
    PlayerId,
    LocationIndex,
    GameResult,
    GamePhase,
    CardId,
    Power,
)
from engine.events import GameEndedEvent


# =============================================================================
# Statistics Data Structures
# =============================================================================


@dataclass
class CardStats:
    """Statistics for a single card."""

    card_id: CardId
    card_name: str
    cost: int
    base_power: int

    # Play statistics
    times_in_deck: int = 0
    times_played: int = 0
    times_in_winning_deck: int = 0
    times_in_losing_deck: int = 0
    times_played_and_won: int = 0
    times_played_and_lost: int = 0

    # Power statistics
    total_final_power: int = 0  # Sum of effective power at game end

    # Location statistics
    location_plays: dict[int, int] = field(default_factory=lambda: {0: 0, 1: 0, 2: 0})

    # Turn statistics (when was it played)
    turn_plays: dict[int, int] = field(
        default_factory=lambda: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}
    )

    @property
    def play_rate(self) -> float:
        """Rate at which card is played when in deck."""
        return self.times_played / self.times_in_deck if self.times_in_deck > 0 else 0.0

    @property
    def win_rate_when_played(self) -> float:
        """Win rate when this card was played."""
        total = self.times_played_and_won + self.times_played_and_lost
        return self.times_played_and_won / total if total > 0 else 0.0

    @property
    def win_rate_in_deck(self) -> float:
        """Win rate when this card was in the deck."""
        total = self.times_in_winning_deck + self.times_in_losing_deck
        return self.times_in_winning_deck / total if total > 0 else 0.0

    @property
    def average_final_power(self) -> float:
        """Average effective power when played."""
        return self.total_final_power / self.times_played if self.times_played > 0 else 0.0

    @property
    def power_delta(self) -> float:
        """Difference between average final power and base power."""
        return self.average_final_power - self.base_power


@dataclass
class GameStats:
    """Aggregate game statistics."""

    total_games: int = 0
    player_0_wins: int = 0
    player_1_wins: int = 0
    draws: int = 0

    # Turn statistics
    total_turns: int = 0

    # Card statistics
    card_stats: dict[CardId, CardStats] = field(default_factory=dict)


# =============================================================================
# AI Types
# =============================================================================

AI_RANDOM = "random"
AI_GREEDY = "greedy"
AI_TYPES = [AI_RANDOM, AI_GREEDY]


# =============================================================================
# Random AI Player
# =============================================================================


def get_random_action(state: GameState, player_id: PlayerId) -> PlayerAction:
    """
    Get a random legal action for a player.

    The AI:
    1. Gets all legal actions
    2. Filters to actions that are "reasonable" (play cards when possible)
    3. Randomly selects one
    """
    from engine.models import PlayCardAction
    from engine.rules import validate_action

    actions: list[PlayerAction] = []

    # Get all legal play card actions
    player = state.get_player(player_id)
    for card in player.hand:
        for loc_idx in (LocationIndex(0), LocationIndex(1), LocationIndex(2)):
            action = PlayCardAction(
                player_id=player_id,
                card_instance_id=card.instance_id,
                location=loc_idx,
            )
            result = validate_action(state, action)
            if result.valid:
                actions.append(action)

    # If no card actions available, pass
    if not actions:
        return PassAction(player_id=player_id)

    # Randomly select from available card plays
    # (we prefer playing cards over passing to simulate realistic play)
    return random.choice(actions)


# =============================================================================
# Greedy AI Player
# =============================================================================


def get_greedy_action(state: GameState, player_id: PlayerId) -> PlayerAction:
    """
    Get a greedy action for a player.

    The greedy AI:
    1. Finds all legal card plays
    2. Scores each action based on:
       - Card's base power (higher is better)
       - Prefers locations where we're losing or tied
       - Prefers spreading cards across locations
    3. Selects the highest-scoring action
    """
    from engine.models import PlayCardAction
    from engine.rules import validate_action

    actions_with_scores: list[tuple[PlayerAction, float]] = []

    player = state.get_player(player_id)
    opponent_id = PlayerId(1 - player_id)

    # Calculate current power at each location
    location_power: list[tuple[int, int]] = []  # (our_power, their_power)
    location_card_count: list[int] = []  # our card count
    for loc_idx in range(3):
        loc = state.get_location(LocationIndex(loc_idx))
        our_power = loc.total_power(player_id)
        their_power = loc.total_power(opponent_id)
        our_count = loc.card_count(player_id)
        location_power.append((our_power, their_power))
        location_card_count.append(our_count)

    # Get all legal play card actions with scores
    for card in player.hand:
        for loc_idx in (LocationIndex(0), LocationIndex(1), LocationIndex(2)):
            action = PlayCardAction(
                player_id=player_id,
                card_instance_id=card.instance_id,
                location=loc_idx,
            )
            result = validate_action(state, action)
            if result.valid:
                # Calculate score for this action
                score = 0.0

                # Base score: card's power (prioritize high-power cards)
                score += card.card_def.base_power * 10

                # Bonus for locations where we're losing or tied
                our_power, their_power = location_power[loc_idx]
                if our_power <= their_power:
                    score += 5  # Prioritize contested/losing locations

                # Small penalty for stacking too many cards in one location
                # (encourages spreading)
                score -= location_card_count[loc_idx] * 0.5

                # Prefer playing higher cost cards (use energy efficiently)
                score += card.card_def.cost * 2

                # Add small random tiebreaker
                score += random.random() * 0.1

                actions_with_scores.append((action, score))

    # If no card actions available, pass
    if not actions_with_scores:
        return PassAction(player_id=player_id)

    # Select highest scoring action
    actions_with_scores.sort(key=lambda x: x[1], reverse=True)
    return actions_with_scores[0][0]


def get_action(state: GameState, player_id: PlayerId, ai_type: str) -> PlayerAction:
    """Get an action based on the AI type."""
    if ai_type == AI_GREEDY:
        return get_greedy_action(state, player_id)
    else:
        return get_random_action(state, player_id)


# =============================================================================
# Game Simulation
# =============================================================================


def create_random_deck() -> tuple[CardDef, ...]:
    """Create a random 12-card deck from all available cards."""
    # Shuffle all cards and pick 12
    cards = list(ALL_CARDS)
    random.shuffle(cards)
    return tuple(cards[:12])


def run_single_game(
    controller: GameController,
    use_starter_deck: bool = False,
    ai_type: str = AI_RANDOM,
) -> tuple[GameState, list[tuple[CardId, PlayerId, LocationIndex, int]], tuple[CardDef, ...], tuple[CardDef, ...]]:
    """
    Run a single game with the specified AI type.

    Args:
        controller: The game controller
        use_starter_deck: Whether to use starter decks or random decks
        ai_type: AI type to use ("random" or "greedy")

    Returns:
        Tuple of:
        - Final game state
        - List of (card_id, player_id, location, turn) for each card played
        - Player 0's deck definitions
        - Player 1's deck definitions
    """
    # Create decks
    if use_starter_deck:
        deck_p0 = get_starter_deck_defs()
        deck_p1 = get_starter_deck_defs()
    else:
        deck_p0 = create_random_deck()
        deck_p1 = create_random_deck()

    # Create game
    state, _ = controller.create_game(deck_defs_p0=deck_p0, deck_defs_p1=deck_p1)

    # Track cards played
    cards_played: list[tuple[CardId, PlayerId, LocationIndex, int]] = []

    # Run game loop
    while state.result == GameResult.IN_PROGRESS:
        # Start turn
        state, _ = controller.start_turn(state)

        current_turn = state.turn

        # Get actions from both players using the specified AI
        action_p0 = get_action(state, PlayerId(0), ai_type)
        action_p1 = get_action(state, PlayerId(1), ai_type)

        # Track played cards
        if isinstance(action_p0, PlayCardAction):
            card = state.find_card_by_instance(action_p0.card_instance_id)
            if card:
                cards_played.append(
                    (card.card_def.id, PlayerId(0), action_p0.location, current_turn)
                )

        if isinstance(action_p1, PlayCardAction):
            card = state.find_card_by_instance(action_p1.card_instance_id)
            if card:
                cards_played.append(
                    (card.card_def.id, PlayerId(1), action_p1.location, current_turn)
                )

        # Resolve turn
        state, _ = controller.resolve_turn(state, action_p0, action_p1)

    return state, cards_played, deck_p0, deck_p1


def initialize_card_stats() -> dict[CardId, CardStats]:
    """Initialize statistics for all cards."""
    stats: dict[CardId, CardStats] = {}
    for card in ALL_CARDS:
        stats[card.id] = CardStats(
            card_id=card.id,
            card_name=card.name,
            cost=card.cost,
            base_power=card.base_power,
        )
    return stats


def update_stats_from_game(
    stats: GameStats,
    final_state: GameState,
    cards_played: list[tuple[CardId, PlayerId, LocationIndex, int]],
    deck_p0: tuple[CardDef, ...],
    deck_p1: tuple[CardDef, ...],
) -> None:
    """Update statistics based on a completed game."""
    stats.total_games += 1
    stats.total_turns += final_state.turn

    result = final_state.result
    if result == GameResult.PLAYER_0_WINS:
        stats.player_0_wins += 1
        winning_player = PlayerId(0)
        losing_player = PlayerId(1)
    elif result == GameResult.PLAYER_1_WINS:
        stats.player_1_wins += 1
        winning_player = PlayerId(1)
        losing_player = PlayerId(0)
    else:
        stats.draws += 1
        winning_player = None
        losing_player = None

    # Update deck statistics
    for card_def in deck_p0:
        card_stats = stats.card_stats[card_def.id]
        card_stats.times_in_deck += 1
        if result == GameResult.PLAYER_0_WINS:
            card_stats.times_in_winning_deck += 1
        elif result == GameResult.PLAYER_1_WINS:
            card_stats.times_in_losing_deck += 1

    for card_def in deck_p1:
        card_stats = stats.card_stats[card_def.id]
        card_stats.times_in_deck += 1
        if result == GameResult.PLAYER_1_WINS:
            card_stats.times_in_winning_deck += 1
        elif result == GameResult.PLAYER_0_WINS:
            card_stats.times_in_losing_deck += 1

    # Track which cards were played by which player
    cards_played_by_player: dict[PlayerId, set[CardId]] = {
        PlayerId(0): set(),
        PlayerId(1): set(),
    }

    # Update play statistics
    for card_id, player_id, location, turn in cards_played:
        card_stats = stats.card_stats[card_id]
        card_stats.times_played += 1
        card_stats.location_plays[location] += 1
        card_stats.turn_plays[turn] += 1
        cards_played_by_player[player_id].add(card_id)

    # Update win/loss statistics for played cards
    if winning_player is not None:
        for card_id in cards_played_by_player[winning_player]:
            stats.card_stats[card_id].times_played_and_won += 1
        for card_id in cards_played_by_player[losing_player]:
            stats.card_stats[card_id].times_played_and_lost += 1

    # Update power statistics from final board state
    for location in final_state.locations:
        for card in location.all_cards():
            card_stats = stats.card_stats[card.card_def.id]
            card_stats.total_final_power += card.effective_power()


# =============================================================================
# Main Simulation
# =============================================================================


def merge_stats(stats_list: list[GameStats]) -> GameStats:
    """Merge multiple GameStats objects into one."""
    merged = GameStats(card_stats=initialize_card_stats())

    for stats in stats_list:
        merged.total_games += stats.total_games
        merged.player_0_wins += stats.player_0_wins
        merged.player_1_wins += stats.player_1_wins
        merged.draws += stats.draws
        merged.total_turns += stats.total_turns

        for card_id, card_stats in stats.card_stats.items():
            m = merged.card_stats[card_id]
            m.times_in_deck += card_stats.times_in_deck
            m.times_played += card_stats.times_played
            m.times_in_winning_deck += card_stats.times_in_winning_deck
            m.times_in_losing_deck += card_stats.times_in_losing_deck
            m.times_played_and_won += card_stats.times_played_and_won
            m.times_played_and_lost += card_stats.times_played_and_lost
            m.total_final_power += card_stats.total_final_power

            for loc in range(3):
                m.location_plays[loc] += card_stats.location_plays[loc]
            for turn in range(1, 7):
                m.turn_plays[turn] += card_stats.turn_plays[turn]

    return merged


# Global counter for progress tracking across processes
_progress_counter: mp.Value | None = None
_progress_lock: mp.Lock | None = None


def _init_worker(counter: mp.Value, lock: mp.Lock) -> None:
    """Initialize worker process with shared counter."""
    global _progress_counter, _progress_lock
    _progress_counter = counter
    _progress_lock = lock


def run_games_batch(
    args: tuple[int, int, bool, int | None, str]
) -> GameStats:
    """
    Run a batch of games (for parallel execution).

    Args:
        args: Tuple of (batch_id, num_games, use_starter_deck, base_seed, ai_type)

    Returns:
        GameStats for this batch
    """
    global _progress_counter, _progress_lock

    batch_id, num_games, use_starter_deck, base_seed, ai_type = args

    # Each worker gets a unique seed based on batch_id
    if base_seed is not None:
        random.seed(base_seed + batch_id)
    else:
        random.seed()

    controller = GameController()
    stats = GameStats(card_stats=initialize_card_stats())

    for i in range(num_games):
        final_state, cards_played, deck_p0, deck_p1 = run_single_game(
            controller, use_starter_deck=use_starter_deck, ai_type=ai_type
        )
        update_stats_from_game(stats, final_state, cards_played, deck_p0, deck_p1)

        # Update shared progress counter
        if _progress_counter is not None and _progress_lock is not None:
            with _progress_lock:
                _progress_counter.value += 1

    return stats


def run_simulation(
    num_games: int = 10000,
    use_starter_deck: bool = False,
    seed: int | None = None,
    verbose: bool = True,
    num_workers: int = 1,
    ai_type: str = AI_RANDOM,
) -> GameStats:
    """
    Run the full simulation.

    Args:
        num_games: Number of games to simulate
        use_starter_deck: If True, use starter deck. If False, use random decks.
        seed: Random seed for reproducibility
        verbose: Print progress updates
        num_workers: Number of parallel workers (1 = sequential)
        ai_type: AI type to use ("random" or "greedy")

    Returns:
        GameStats with all collected statistics
    """
    if verbose:
        print(f"Running {num_games} simulated games...")
        print(f"Deck mode: {'Starter deck' if use_starter_deck else 'Random decks'}")
        print(f"AI type: {ai_type}")
        print(f"Workers: {num_workers}")
        print()

    if num_workers <= 1:
        # Sequential execution
        if seed is not None:
            random.seed(seed)

        controller = GameController()
        stats = GameStats(card_stats=initialize_card_stats())

        for i in range(num_games):
            if verbose and (i + 1) % 1000 == 0:
                print(f"  Completed {i + 1}/{num_games} games...")

            final_state, cards_played, deck_p0, deck_p1 = run_single_game(
                controller, use_starter_deck=use_starter_deck, ai_type=ai_type
            )
            update_stats_from_game(stats, final_state, cards_played, deck_p0, deck_p1)
    else:
        # Parallel execution with progress tracking
        import threading
        import time

        games_per_worker = num_games // num_workers
        remainder = num_games % num_workers

        # Distribute games across workers
        batch_args: list[tuple[int, int, bool, int | None, str]] = []
        for i in range(num_workers):
            batch_size = games_per_worker + (1 if i < remainder else 0)
            batch_args.append((i, batch_size, use_starter_deck, seed, ai_type))

        # Create shared counter for progress
        progress_counter = mp.Value('i', 0)
        progress_lock = mp.Lock()

        # Flag to stop progress thread
        done = threading.Event()

        def print_progress():
            """Background thread to print progress."""
            last_printed = 0
            while not done.is_set():
                with progress_lock:
                    current = progress_counter.value
                # Print every 1000 games or at completion
                if current >= last_printed + 1000 or current == num_games:
                    print(f"  Completed {current}/{num_games} games...")
                    last_printed = (current // 1000) * 1000
                if current >= num_games:
                    break
                time.sleep(0.1)

        if verbose:
            print(f"  Starting {num_workers} parallel workers...")
            progress_thread = threading.Thread(target=print_progress, daemon=True)
            progress_thread.start()

        with mp.Pool(
            processes=num_workers,
            initializer=_init_worker,
            initargs=(progress_counter, progress_lock)
        ) as pool:
            results = pool.map(run_games_batch, batch_args)

        done.set()
        if verbose:
            # Final progress update
            print(f"  Completed {num_games}/{num_games} games...")
            print(f"  All workers complete. Merging results...")

        stats = merge_stats(results)

    if verbose:
        print(f"Simulation complete!")
        print()

    return stats


def print_statistics(stats: GameStats) -> None:
    """Print formatted statistics."""
    print("=" * 80)
    print("GAME STATISTICS")
    print("=" * 80)
    print()

    print(f"Total games: {stats.total_games}")
    print(f"Player 0 wins: {stats.player_0_wins} ({100*stats.player_0_wins/stats.total_games:.1f}%)")
    print(f"Player 1 wins: {stats.player_1_wins} ({100*stats.player_1_wins/stats.total_games:.1f}%)")
    print(f"Draws: {stats.draws} ({100*stats.draws/stats.total_games:.1f}%)")
    print(f"Average turns per game: {stats.total_turns/stats.total_games:.2f}")
    print()

    print("=" * 80)
    print("CARD STATISTICS (sorted by win rate when played)")
    print("=" * 80)
    print()

    # Sort cards by win rate when played
    sorted_cards = sorted(
        stats.card_stats.values(),
        key=lambda c: c.win_rate_when_played,
        reverse=True,
    )

    print(f"{'Card Name':<20} {'Cost':>4} {'Base':>5} {'Played':>7} {'Play%':>6} {'WinPlayed':>10} {'WinDeck':>8} {'AvgPwr':>7} {'Delta':>6}")
    print("-" * 80)

    for card in sorted_cards:
        print(
            f"{card.card_name:<20} "
            f"{card.cost:>4} "
            f"{card.base_power:>5} "
            f"{card.times_played:>7} "
            f"{100*card.play_rate:>5.1f}% "
            f"{100*card.win_rate_when_played:>9.1f}% "
            f"{100*card.win_rate_in_deck:>7.1f}% "
            f"{card.average_final_power:>7.2f} "
            f"{card.power_delta:>+5.2f}"
        )

    print()
    print("=" * 80)
    print("CARD DETAILS BY COST")
    print("=" * 80)

    for cost in range(1, 7):
        cost_cards = [c for c in sorted_cards if c.cost == cost]
        if not cost_cards:
            continue

        print()
        print(f"--- {cost}-Cost Cards ---")
        print()

        for card in cost_cards:
            print(f"  {card.card_name}:")
            print(f"    Times in deck: {card.times_in_deck}, Times played: {card.times_played}")
            print(f"    Play rate: {100*card.play_rate:.1f}%")
            print(f"    Win rate when played: {100*card.win_rate_when_played:.1f}%")
            print(f"    Win rate in deck: {100*card.win_rate_in_deck:.1f}%")
            print(f"    Base power: {card.base_power}, Avg final power: {card.average_final_power:.2f} (delta: {card.power_delta:+.2f})")
            print(f"    Location plays: L0={card.location_plays[0]}, L1={card.location_plays[1]}, L2={card.location_plays[2]}")
            turn_str = ", ".join(f"T{t}={card.turn_plays[t]}" for t in range(1, 7))
            print(f"    Turn plays: {turn_str}")
            print()

    print("=" * 80)
    print("BALANCE INSIGHTS")
    print("=" * 80)
    print()

    # Cards with highest win rate when played
    print("Top 5 cards by win rate when played:")
    for i, card in enumerate(sorted_cards[:5], 1):
        print(f"  {i}. {card.card_name}: {100*card.win_rate_when_played:.1f}%")

    print()

    # Cards with lowest win rate when played
    print("Bottom 5 cards by win rate when played:")
    for i, card in enumerate(sorted_cards[-5:], 1):
        print(f"  {i}. {card.card_name}: {100*card.win_rate_when_played:.1f}%")

    print()

    # Cards with biggest power gains
    power_sorted = sorted(
        [c for c in sorted_cards if c.times_played > 0],
        key=lambda c: c.power_delta,
        reverse=True,
    )
    print("Top 5 cards by power gain (average final - base):")
    for i, card in enumerate(power_sorted[:5], 1):
        print(f"  {i}. {card.card_name}: {card.power_delta:+.2f} (base {card.base_power} -> avg {card.average_final_power:.2f})")

    print()

    # Cards with biggest power losses
    print("Top 5 cards by power loss (average final - base):")
    for i, card in enumerate(power_sorted[-5:], 1):
        print(f"  {i}. {card.card_name}: {card.power_delta:+.2f} (base {card.base_power} -> avg {card.average_final_power:.2f})")

    print()

    # Most played cards
    play_sorted = sorted(sorted_cards, key=lambda c: c.times_played, reverse=True)
    print("Top 5 most played cards:")
    for i, card in enumerate(play_sorted[:5], 1):
        print(f"  {i}. {card.card_name}: {card.times_played} plays ({100*card.play_rate:.1f}% play rate)")

    print()

    # Least played cards
    print("Top 5 least played cards:")
    for i, card in enumerate(play_sorted[-5:], 1):
        print(f"  {i}. {card.card_name}: {card.times_played} plays ({100*card.play_rate:.1f}% play rate)")


def export_csv(stats: GameStats, filename: str = "card_stats.csv") -> None:
    """Export statistics to a CSV file."""
    import csv

    with open(filename, "w", newline="") as f:
        writer = csv.writer(f)

        # Header
        writer.writerow([
            "card_id",
            "card_name",
            "cost",
            "base_power",
            "times_in_deck",
            "times_played",
            "play_rate",
            "times_played_won",
            "times_played_lost",
            "win_rate_when_played",
            "times_in_winning_deck",
            "times_in_losing_deck",
            "win_rate_in_deck",
            "total_final_power",
            "avg_final_power",
            "power_delta",
            "loc_0_plays",
            "loc_1_plays",
            "loc_2_plays",
            "turn_1_plays",
            "turn_2_plays",
            "turn_3_plays",
            "turn_4_plays",
            "turn_5_plays",
            "turn_6_plays",
        ])

        # Data rows
        for card in stats.card_stats.values():
            writer.writerow([
                card.card_id,
                card.card_name,
                card.cost,
                card.base_power,
                card.times_in_deck,
                card.times_played,
                f"{card.play_rate:.4f}",
                card.times_played_and_won,
                card.times_played_and_lost,
                f"{card.win_rate_when_played:.4f}",
                card.times_in_winning_deck,
                card.times_in_losing_deck,
                f"{card.win_rate_in_deck:.4f}",
                card.total_final_power,
                f"{card.average_final_power:.2f}",
                f"{card.power_delta:.2f}",
                card.location_plays[0],
                card.location_plays[1],
                card.location_plays[2],
                card.turn_plays[1],
                card.turn_plays[2],
                card.turn_plays[3],
                card.turn_plays[4],
                card.turn_plays[5],
                card.turn_plays[6],
            ])

    print(f"Statistics exported to {filename}")


# =============================================================================
# CLI Entry Point
# =============================================================================


def main() -> None:
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Run game simulations for card balancing"
    )
    parser.add_argument(
        "-n", "--num-games",
        type=int,
        default=10000,
        help="Number of games to simulate (default: 10000)"
    )
    parser.add_argument(
        "-s", "--seed",
        type=int,
        default=None,
        help="Random seed for reproducibility"
    )
    parser.add_argument(
        "-w", "--workers",
        type=int,
        default=1,
        help="Number of parallel workers (default: 1)"
    )
    parser.add_argument(
        "--starter-deck",
        action="store_true",
        help="Use starter deck instead of random decks"
    )
    parser.add_argument(
        "--ai",
        type=str,
        choices=AI_TYPES,
        default=AI_RANDOM,
        help=f"AI type to use: {', '.join(AI_TYPES)} (default: {AI_RANDOM})"
    )
    parser.add_argument(
        "--csv",
        type=str,
        default=None,
        help="Export results to CSV file"
    )
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Suppress progress output"
    )

    args = parser.parse_args()

    stats = run_simulation(
        num_games=args.num_games,
        use_starter_deck=args.starter_deck,
        seed=args.seed,
        verbose=not args.quiet,
        num_workers=args.workers,
        ai_type=args.ai,
    )

    print_statistics(stats)

    if args.csv:
        export_csv(stats, args.csv)


if __name__ == "__main__":
    main()
