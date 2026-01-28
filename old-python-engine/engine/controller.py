"""
Game Controller - orchestrates game phases and exposes APIs.

The controller manages the game lifecycle without any I/O operations.
It provides a clean interface for:
- Creating new games
- Processing turns
- Querying game state

All operations return new state snapshots and event logs.
"""

from __future__ import annotations

from engine.types import (
    PlayerId,
    LocationIndex,
    TurnNumber,
    InstanceId,
    Energy,
    Power,
    GamePhase,
    GameResult,
    STARTING_HAND_SIZE,
)
from engine.models import (
    GameState,
    PlayerState,
    CardInstance,
    CardDef,
    PlayerAction,
    create_initial_locations,
)
from engine.events import (
    GameEvent,
    GameStartedEvent,
    GameEndedEvent,
    TurnStartedEvent,
    TurnEndedEvent,
    EnergySetEvent,
    CardDrawnEvent,
)
from engine.rules import (
    resolve_actions,
    compute_winner,
    compute_location_powers,
    is_game_over,
)
from engine.cards import get_starter_deck_defs


class GameController:
    """
    Orchestrates game phases and provides APIs for game interaction.

    The controller is stateless - all state is passed in and returned.
    This makes it easy to:
    - Test with specific states
    - Implement undo/redo
    - Serialize game states
    - Replay games from event logs

    Usage:
        controller = GameController()
        state, events = controller.create_game()
        state, events = controller.start_turn(state)
        state, events = controller.resolve_turn(state, action_p0, action_p1)
    """

    def create_game(
        self,
        deck_defs_p0: tuple[CardDef, ...] | None = None,
        deck_defs_p1: tuple[CardDef, ...] | None = None,
    ) -> tuple[GameState, list[GameEvent]]:
        """
        Create a new game with initial state.

        Args:
            deck_defs_p0: Card definitions for player 0's deck (uses default if None)
            deck_defs_p1: Card definitions for player 1's deck (uses default if None)

        Returns:
            Tuple of (initial_state, events)
        """
        events: list[GameEvent] = []

        # Use default decks if not provided
        if deck_defs_p0 is None:
            deck_defs_p0 = get_starter_deck_defs()
        if deck_defs_p1 is None:
            deck_defs_p1 = get_starter_deck_defs()

        # Create card instances
        next_id = InstanceId(0)

        def create_deck(
            defs: tuple[CardDef, ...], player_id: PlayerId
        ) -> tuple[tuple[CardInstance, ...], InstanceId]:
            nonlocal next_id
            cards: list[CardInstance] = []
            for card_def in defs:
                card = CardInstance(
                    instance_id=next_id,
                    card_def=card_def,
                    owner=player_id,
                    permanent_power_modifier=Power(0),
                    ongoing_power_modifier=Power(0),
                    revealed=False,
                )
                cards.append(card)
                next_id = InstanceId(next_id + 1)
            return tuple(cards), next_id

        deck_p0, next_id = create_deck(deck_defs_p0, PlayerId(0))
        deck_p1, next_id = create_deck(deck_defs_p1, PlayerId(1))

        # Create player states with empty hands (will draw during turn start)
        player_0 = PlayerState(
            player_id=PlayerId(0),
            deck=deck_p0,
            hand=(),
            energy=Energy(0),
            max_energy=Energy(0),
        )
        player_1 = PlayerState(
            player_id=PlayerId(1),
            deck=deck_p1,
            hand=(),
            energy=Energy(0),
            max_energy=Energy(0),
        )

        # Create initial game state
        state = GameState(
            turn=TurnNumber(0),  # Will be set to 1 on first start_turn
            phase=GamePhase.TURN_START,
            players=(player_0, player_1),
            locations=create_initial_locations(),
            result=GameResult.IN_PROGRESS,
            next_instance_id=next_id,
        )

        events.append(GameStartedEvent())

        # Draw initial hands
        for player_id in (PlayerId(0), PlayerId(1)):
            for _ in range(STARTING_HAND_SIZE):
                player = state.get_player(player_id)
                new_player, drawn_card = player.draw_card()
                state = state.with_player(player_id, new_player)

                if drawn_card is not None:
                    events.append(
                        CardDrawnEvent(
                            player_id=player_id,
                            card_instance_id=drawn_card.instance_id,
                        )
                    )

        return state, events

    def start_turn(self, state: GameState) -> tuple[GameState, list[GameEvent]]:
        """
        Start a new turn.

        - Increments turn number
        - Clears turn-specific tracking (moved cards)
        - Sets energy to turn number
        - Draws a card for each player

        Args:
            state: Current game state

        Returns:
            Tuple of (new_state, events)
        """
        events: list[GameEvent] = []

        # Increment turn
        new_turn = TurnNumber(state.turn + 1)
        state = state.with_turn(new_turn)

        # Clear turn-specific tracking (e.g., cards moved this turn)
        state = state.clear_turn_tracking()

        events.append(TurnStartedEvent(turn=new_turn))

        # Set energy and draw for each player
        for player_id in (PlayerId(0), PlayerId(1)):
            player = state.get_player(player_id)

            # Set energy = turn number
            new_energy = Energy(new_turn)
            new_player = player.with_energy(new_energy, new_energy)
            state = state.with_player(player_id, new_player)

            events.append(
                EnergySetEvent(
                    player_id=player_id,
                    energy=new_energy,
                )
            )

            # Draw a card (if not first turn - first turn already drew 3)
            if new_turn > TurnNumber(1):
                player = state.get_player(player_id)
                new_player, drawn_card = player.draw_card()
                state = state.with_player(player_id, new_player)

                if drawn_card is not None:
                    events.append(
                        CardDrawnEvent(
                            player_id=player_id,
                            card_instance_id=drawn_card.instance_id,
                        )
                    )

        state = state.with_phase(GamePhase.PLANNING)

        return state, events

    def resolve_turn(
        self,
        state: GameState,
        action_p0: PlayerAction,
        action_p1: PlayerAction,
    ) -> tuple[GameState, list[GameEvent]]:
        """
        Resolve both players' actions and end the turn.

        Args:
            state: Current game state (should be in PLANNING phase)
            action_p0: Player 0's action
            action_p1: Player 1's action

        Returns:
            Tuple of (new_state, events)
        """
        events: list[GameEvent] = []

        # Set phase to resolution
        state = state.with_phase(GamePhase.RESOLUTION)

        # Resolve actions
        state, action_events = resolve_actions(state, action_p0, action_p1)
        events.extend(action_events)

        # End turn
        events.append(TurnEndedEvent(turn=state.turn))
        state = state.with_phase(GamePhase.TURN_END)

        # Check for game end
        if is_game_over(state):
            result, location_winners = compute_winner(state)
            location_powers = compute_location_powers(state)
            total_power = (
                Power(sum(p[0] for p in location_powers)),
                Power(sum(p[1] for p in location_powers)),
            )

            state = state.with_result(result)
            state = state.with_phase(GamePhase.GAME_OVER)

            events.append(
                GameEndedEvent(
                    result=result,
                    location_winners=location_winners,
                    location_powers=location_powers,
                    total_power=total_power,
                )
            )

        return state, events

    def step(
        self,
        state: GameState,
        action_p0: PlayerAction,
        action_p1: PlayerAction,
    ) -> tuple[GameState, list[GameEvent]]:
        """
        Execute a complete turn step: start turn (if needed), resolve actions.

        This is a convenience method that handles the full turn cycle.
        Useful for game loops that don't need fine-grained phase control.

        Args:
            state: Current game state
            action_p0: Player 0's action
            action_p1: Player 1's action

        Returns:
            Tuple of (new_state, all_events)
        """
        all_events: list[GameEvent] = []

        # Start turn if needed
        if state.phase == GamePhase.TURN_START or state.phase == GamePhase.TURN_END:
            state, turn_events = self.start_turn(state)
            all_events.extend(turn_events)

        # Resolve turn
        state, resolve_events = self.resolve_turn(state, action_p0, action_p1)
        all_events.extend(resolve_events)

        return state, all_events

    def get_legal_actions(
        self,
        state: GameState,
        player_id: PlayerId,
    ) -> list[PlayerAction]:
        """
        Get all legal actions for a player.

        Args:
            state: Current game state
            player_id: The player to get actions for

        Returns:
            List of legal PlayerAction objects
        """
        from engine.models import PassAction, PlayCardAction
        from engine.rules import validate_action

        actions: list[PlayerAction] = []

        # Pass is always legal
        actions.append(PassAction(player_id=player_id))

        # Try each card in hand at each location
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

        return actions


# =============================================================================
# Utility Functions
# =============================================================================


def create_test_state(
    turn: int = 1,
    p0_energy: int = 1,
    p1_energy: int = 1,
    p0_hand_defs: tuple[CardDef, ...] = (),
    p1_hand_defs: tuple[CardDef, ...] = (),
) -> GameState:
    """
    Create a GameState for testing purposes.

    This is a convenience function for tests that need specific states.
    """
    next_id = InstanceId(0)

    def create_hand(
        defs: tuple[CardDef, ...], player_id: PlayerId
    ) -> tuple[tuple[CardInstance, ...], InstanceId]:
        nonlocal next_id
        cards: list[CardInstance] = []
        for card_def in defs:
            card = CardInstance(
                instance_id=next_id,
                card_def=card_def,
                owner=player_id,
                permanent_power_modifier=Power(0),
                ongoing_power_modifier=Power(0),
                revealed=False,
            )
            cards.append(card)
            next_id = InstanceId(next_id + 1)
        return tuple(cards), next_id

    hand_p0, next_id = create_hand(p0_hand_defs, PlayerId(0))
    hand_p1, next_id = create_hand(p1_hand_defs, PlayerId(1))

    player_0 = PlayerState(
        player_id=PlayerId(0),
        deck=(),
        hand=hand_p0,
        energy=Energy(p0_energy),
        max_energy=Energy(p0_energy),
    )
    player_1 = PlayerState(
        player_id=PlayerId(1),
        deck=(),
        hand=hand_p1,
        energy=Energy(p1_energy),
        max_energy=Energy(p1_energy),
    )

    return GameState(
        turn=TurnNumber(turn),
        phase=GamePhase.PLANNING,
        players=(player_0, player_1),
        locations=create_initial_locations(),
        result=GameResult.IN_PROGRESS,
        next_instance_id=next_id,
    )
