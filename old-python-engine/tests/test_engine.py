"""
Tests for the Fates of Olympus game engine.

Tests cover:
- Legality: Cannot play card not in hand, exceed energy, exceed capacity
- Determinism: Same inputs produce same state/events
- Win condition: Correct winner computation
"""

import pytest

from engine.types import (
    PlayerId,
    LocationIndex,
    InstanceId,
    TurnNumber,
    Energy,
    Power,
    GamePhase,
    GameResult,
    LOCATION_CAPACITY,
)
from engine.models import (
    GameState,
    CardDef,
    CardInstance,
    PlayCardAction,
    PassAction,
)
from engine.cards import (
    TITAN_ATLAS,  # 6 cost, 9 power - vanilla
    CYCLOPS,      # 5 cost, 7 power - vanilla
    HOPLITE,      # 1 cost, 2 power - vanilla
    ARGIVE_SCOUT, # 2 cost, 3 power - vanilla
    MINOTAUR,     # 4 cost, 5 power - vanilla
    SATYR,        # 1 cost, 1 power - on reveal buff
    NAIAD_NYMPH,  # 1 cost, 1 power - ongoing buff
)
from engine.controller import GameController, create_test_state
from engine.rules import validate_action, compute_winner, resolve_actions


def make_card(
    instance_id: int,
    card_def: CardDef,
    owner: int,
    revealed: bool = True,
) -> CardInstance:
    """Helper to create CardInstance for tests."""
    return CardInstance(
        instance_id=InstanceId(instance_id),
        card_def=card_def,
        owner=PlayerId(owner),
        permanent_power_modifier=Power(0),
        ongoing_power_modifier=Power(0),
        revealed=revealed,
    )


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def controller() -> GameController:
    """Create a GameController instance."""
    return GameController()


@pytest.fixture
def basic_game_state() -> GameState:
    """Create a basic game state for testing."""
    return create_test_state(
        turn=1,
        p0_energy=1,
        p1_energy=1,
        p0_hand_defs=(HOPLITE, ARGIVE_SCOUT),
        p1_hand_defs=(HOPLITE, ARGIVE_SCOUT),
    )


# =============================================================================
# Legality Tests
# =============================================================================


class TestLegality:
    """Tests for action validation (legality checks)."""

    def test_cannot_play_card_not_in_hand(self, basic_game_state: GameState) -> None:
        """Playing a card not in the player's hand should be invalid."""
        # Try to play an instance ID that doesn't exist
        action = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=InstanceId(999),
            location=LocationIndex(0),
        )
        result = validate_action(basic_game_state, action)

        assert not result.valid
        assert "not in hand" in result.reason.lower()

    def test_cannot_exceed_energy(self) -> None:
        """Playing a card costing more than available energy should be invalid."""
        # Create state with low energy but expensive card in hand
        state = create_test_state(
            turn=1,
            p0_energy=1,
            p1_energy=1,
            p0_hand_defs=(TITAN_ATLAS,),  # Hulk costs 6
            p1_hand_defs=(HOPLITE,),
        )

        player = state.get_player(PlayerId(0))
        hulk_instance = player.hand[0]

        action = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=hulk_instance.instance_id,
            location=LocationIndex(0),
        )
        result = validate_action(state, action)

        assert not result.valid
        assert "energy" in result.reason.lower()

    def test_cannot_exceed_location_capacity(self) -> None:
        """Playing to a full location should be invalid."""
        # Create state with a full location
        state = create_test_state(
            turn=1,
            p0_energy=6,
            p1_energy=1,
            p0_hand_defs=(HOPLITE,),
            p1_hand_defs=(),
        )

        # Manually fill location 0 with 4 cards for player 0
        location = state.get_location(LocationIndex(0))
        for i in range(LOCATION_CAPACITY):
            fake_card = CardInstance(
                instance_id=InstanceId(100 + i),
                card_def=ARGIVE_SCOUT,
                owner=PlayerId(0),
                permanent_power_modifier=Power(0),
                ongoing_power_modifier=Power(0),
                revealed=True,
            )
            location = location.add_card(fake_card, PlayerId(0))

        state = state.with_location(LocationIndex(0), location)

        player = state.get_player(PlayerId(0))
        card = player.hand[0]

        action = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=card.instance_id,
            location=LocationIndex(0),
        )
        result = validate_action(state, action)

        assert not result.valid
        assert "capacity" in result.reason.lower()

    def test_pass_is_always_legal(self, basic_game_state: GameState) -> None:
        """Passing should always be a legal action."""
        action = PassAction(player_id=PlayerId(0))
        result = validate_action(basic_game_state, action)

        assert result.valid

    def test_can_play_affordable_card(self, basic_game_state: GameState) -> None:
        """Playing an affordable card to a valid location should be legal."""
        player = basic_game_state.get_player(PlayerId(0))
        misty = player.hand[0]  # Misty Knight costs 1

        action = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=misty.instance_id,
            location=LocationIndex(0),
        )
        result = validate_action(basic_game_state, action)

        assert result.valid

    def test_invalid_location_rejected(self, basic_game_state: GameState) -> None:
        """Playing to an invalid location index should be rejected."""
        player = basic_game_state.get_player(PlayerId(0))
        card = player.hand[0]

        action = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=card.instance_id,
            location=LocationIndex(5),  # Invalid
        )
        result = validate_action(basic_game_state, action)

        assert not result.valid


# =============================================================================
# Determinism Tests
# =============================================================================


class TestDeterminism:
    """Tests for deterministic behavior."""

    def test_same_inputs_produce_same_state(self, controller: GameController) -> None:
        """Identical inputs should produce identical states."""
        # Create two identical games
        state1, _ = controller.create_game()
        state2, _ = controller.create_game()

        # Start turn
        state1, _ = controller.start_turn(state1)
        state2, _ = controller.start_turn(state2)

        # Both players pass
        action_p0 = PassAction(player_id=PlayerId(0))
        action_p1 = PassAction(player_id=PlayerId(1))

        state1, _ = controller.resolve_turn(state1, action_p0, action_p1)
        state2, _ = controller.resolve_turn(state2, action_p0, action_p1)

        # States should be identical
        assert state1.turn == state2.turn
        assert state1.phase == state2.phase
        assert len(state1.players[0].hand) == len(state2.players[0].hand)
        assert len(state1.players[1].hand) == len(state2.players[1].hand)

    def test_same_actions_produce_same_events(self) -> None:
        """Identical actions should produce identical event sequences."""
        state = create_test_state(
            turn=2,
            p0_energy=2,
            p1_energy=2,
            p0_hand_defs=(SATYR,),  # 2-cost
            p1_hand_defs=(ARGIVE_SCOUT,),  # 2-cost
        )

        p0_card = state.get_player(PlayerId(0)).hand[0]
        p1_card = state.get_player(PlayerId(1)).hand[0]

        action_p0 = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=p0_card.instance_id,
            location=LocationIndex(1),
        )
        action_p1 = PlayCardAction(
            player_id=PlayerId(1),
            card_instance_id=p1_card.instance_id,
            location=LocationIndex(1),
        )

        # Resolve twice
        _, events1 = resolve_actions(state, action_p0, action_p1)
        _, events2 = resolve_actions(state, action_p0, action_p1)

        # Event types should match
        event_types1 = [e.event_type for e in events1]
        event_types2 = [e.event_type for e in events2]

        assert event_types1 == event_types2

    def test_resolve_order_is_p0_then_p1(self) -> None:
        """P0's cards should reveal before P1's cards."""
        state = create_test_state(
            turn=2,
            p0_energy=2,
            p1_energy=2,
            p0_hand_defs=(SATYR,),
            p1_hand_defs=(ARGIVE_SCOUT,),
        )

        p0_card = state.get_player(PlayerId(0)).hand[0]
        p1_card = state.get_player(PlayerId(1)).hand[0]

        action_p0 = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=p0_card.instance_id,
            location=LocationIndex(0),
        )
        action_p1 = PlayCardAction(
            player_id=PlayerId(1),
            card_instance_id=p1_card.instance_id,
            location=LocationIndex(0),
        )

        _, events = resolve_actions(state, action_p0, action_p1)

        # Find reveal events
        from engine.events import CardRevealedEvent

        reveal_events = [e for e in events if isinstance(e, CardRevealedEvent)]

        assert len(reveal_events) == 2
        assert reveal_events[0].player_id == PlayerId(0)  # P0 reveals first
        assert reveal_events[1].player_id == PlayerId(1)  # P1 reveals second


# =============================================================================
# Win Condition Tests
# =============================================================================


class TestWinCondition:
    """Tests for win condition computation."""

    def test_win_two_locations(self) -> None:
        """Player who wins 2 locations should win the game."""
        state = create_test_state(turn=6, p0_energy=0, p1_energy=0)

        # Set up board: P0 wins locations 0 and 1, P1 wins location 2
        # Location 0: P0 has 10 power, P1 has 5
        loc0 = state.get_location(LocationIndex(0))
        loc0 = loc0.add_card(make_card(100, TITAN_ATLAS, 0), PlayerId(0))  # 12 power
        loc0 = loc0.add_card(make_card(101, MINOTAUR, 1), PlayerId(1))  # 6 power
        state = state.with_location(LocationIndex(0), loc0)

        # Location 1: P0 wins
        loc1 = state.get_location(LocationIndex(1))
        loc1 = loc1.add_card(make_card(102, CYCLOPS, 0), PlayerId(0))  # 4 power
        loc1 = loc1.add_card(make_card(103, HOPLITE, 1), PlayerId(1))  # 2 power
        state = state.with_location(LocationIndex(1), loc1)

        # Location 2: P1 wins
        loc2 = state.get_location(LocationIndex(2))
        loc2 = loc2.add_card(make_card(104, HOPLITE, 0), PlayerId(0))  # 2 power
        loc2 = loc2.add_card(make_card(105, TITAN_ATLAS, 1), PlayerId(1))  # 12 power
        state = state.with_location(LocationIndex(2), loc2)

        result, location_winners = compute_winner(state)

        assert result == GameResult.PLAYER_0_WINS
        assert location_winners[0] == PlayerId(0)
        assert location_winners[1] == PlayerId(0)
        assert location_winners[2] == PlayerId(1)

    def test_tie_decided_by_total_power(self) -> None:
        """If locations are 1-1-1 tie, winner decided by total power."""
        state = create_test_state(turn=6, p0_energy=0, p1_energy=0)

        # P0 wins loc 0 with big power, tie at loc 1, P1 wins loc 2 with small power
        # Total: P0 should have more power

        # Location 0: P0 wins big
        loc0 = state.get_location(LocationIndex(0))
        loc0 = loc0.add_card(make_card(100, TITAN_ATLAS, 0), PlayerId(0))  # 12
        loc0 = loc0.add_card(make_card(101, HOPLITE, 1), PlayerId(1))  # 2
        state = state.with_location(LocationIndex(0), loc0)

        # Location 1: Tied
        loc1 = state.get_location(LocationIndex(1))
        loc1 = loc1.add_card(make_card(102, CYCLOPS, 0), PlayerId(0))  # 4
        loc1 = loc1.add_card(make_card(103, CYCLOPS, 1), PlayerId(1))  # 4
        state = state.with_location(LocationIndex(1), loc1)

        # Location 2: P1 wins small
        loc2 = state.get_location(LocationIndex(2))
        loc2 = loc2.add_card(make_card(104, HOPLITE, 0), PlayerId(0))  # 2
        loc2 = loc2.add_card(make_card(105, ARGIVE_SCOUT, 1), PlayerId(1))  # 3
        state = state.with_location(LocationIndex(2), loc2)

        # P0 total: 12 + 4 + 2 = 18
        # P1 total: 2 + 4 + 3 = 9
        # P0 wins by total power

        result, location_winners = compute_winner(state)

        assert result == GameResult.PLAYER_0_WINS
        assert location_winners[0] == PlayerId(0)
        assert location_winners[1] is None  # Tie
        assert location_winners[2] == PlayerId(1)

    def test_true_draw(self) -> None:
        """If locations and total power are tied, it's a draw."""
        state = create_test_state(turn=6, p0_energy=0, p1_energy=0)

        # Each player wins one location with same power, middle is tied
        # Location 0: P0 wins with 4
        loc0 = state.get_location(LocationIndex(0))
        loc0 = loc0.add_card(make_card(100, CYCLOPS, 0), PlayerId(0))  # 4
        state = state.with_location(LocationIndex(0), loc0)

        # Location 1: Tied
        loc1 = state.get_location(LocationIndex(1))
        loc1 = loc1.add_card(make_card(101, ARGIVE_SCOUT, 0), PlayerId(0))  # 3
        loc1 = loc1.add_card(make_card(102, ARGIVE_SCOUT, 1), PlayerId(1))  # 3
        state = state.with_location(LocationIndex(1), loc1)

        # Location 2: P1 wins with 4
        loc2 = state.get_location(LocationIndex(2))
        loc2 = loc2.add_card(make_card(103, CYCLOPS, 1), PlayerId(1))  # 4
        state = state.with_location(LocationIndex(2), loc2)

        # P0 total: 4 + 3 = 7
        # P1 total: 3 + 4 = 7
        # True draw

        result, _ = compute_winner(state)

        assert result == GameResult.DRAW

    def test_empty_board_is_draw(self) -> None:
        """Empty board should be a draw."""
        state = create_test_state(turn=6, p0_energy=0, p1_energy=0)

        result, location_winners = compute_winner(state)

        assert result == GameResult.DRAW
        assert all(w is None for w in location_winners)


# =============================================================================
# Effect Tests
# =============================================================================


class TestEffects:
    """Tests for card effects."""

    def test_on_reveal_adds_power(self) -> None:
        """ON_REVEAL effects should modify power when card is revealed."""
        # First, set up a state with an ally on the board
        state = create_test_state(
            turn=2,
            p0_energy=2,
            p1_energy=2,
            p0_hand_defs=(SATYR,),  # ON_REVEAL: +1 power to another ally here
            p1_hand_defs=(),
        )

        # Add a Hoplite to location 1 first
        loc1 = state.get_location(LocationIndex(1))
        loc1 = loc1.add_card(make_card(100, HOPLITE, 0), PlayerId(0))  # 2 power ally
        state = state.with_location(LocationIndex(1), loc1)

        satyr_card = state.get_player(PlayerId(0)).hand[0]
        action = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=satyr_card.instance_id,
            location=LocationIndex(1),  # Same location as ally
        )

        new_state, _ = resolve_actions(state, action, PassAction(player_id=PlayerId(1)))

        # Check the ally (Hoplite) got +1 power from Satyr's ON_REVEAL
        location = new_state.get_location(LocationIndex(1))
        cards = location.get_cards(PlayerId(0))
        assert len(cards) == 2

        # Find the Hoplite (id 100) and check it got +1 power
        hoplite = next(c for c in cards if c.instance_id == InstanceId(100))
        # Hoplite base power is 2, Satyr ON_REVEAL adds 1 = 3
        assert hoplite.effective_power() == Power(3)

    def test_ongoing_effect_applies(self) -> None:
        """ONGOING effects should modify other cards' power."""
        # First, play a regular card
        state = create_test_state(
            turn=4,
            p0_energy=4,
            p1_energy=4,
            p0_hand_defs=(HOPLITE, NAIAD_NYMPH),  # Spectrum: +1 to same location
            p1_hand_defs=(),
        )

        misty = state.get_player(PlayerId(0)).hand[0]
        _spectrum = state.get_player(PlayerId(0)).hand[1]  # noqa: F841

        # Play Misty Knight first
        action1 = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=misty.instance_id,
            location=LocationIndex(0),
        )
        state, _ = resolve_actions(state, action1, PassAction(player_id=PlayerId(1)))

        # Check Misty is at base power
        loc = state.get_location(LocationIndex(0))
        misty_on_board = loc.get_cards(PlayerId(0))[0]
        assert misty_on_board.effective_power() == HOPLITE.base_power

        # Now play Spectrum (need to update state with new hand)
        # The card was removed from hand by resolve_actions, so we need a fresh state
        state2 = create_test_state(
            turn=4,
            p0_energy=4,
            p1_energy=4,
            p0_hand_defs=(NAIAD_NYMPH,),
            p1_hand_defs=(),
        )
        # Add Misty to location 0
        loc0 = state2.get_location(LocationIndex(0))
        loc0 = loc0.add_card(make_card(100, HOPLITE, 0), PlayerId(0))
        state2 = state2.with_location(LocationIndex(0), loc0)

        spectrum_card = state2.get_player(PlayerId(0)).hand[0]
        action2 = PlayCardAction(
            player_id=PlayerId(0),
            card_instance_id=spectrum_card.instance_id,
            location=LocationIndex(0),
        )
        state2, _ = resolve_actions(state2, action2, PassAction(player_id=PlayerId(1)))

        # Check Misty got +1 from Spectrum's ongoing effect
        loc = state2.get_location(LocationIndex(0))
        cards = loc.get_cards(PlayerId(0))
        misty_card = next(c for c in cards if c.card_def.id == HOPLITE.id)
        # Misty base: 2, Spectrum ongoing: +1 = 3
        assert misty_card.effective_power() == Power(3)


# =============================================================================
# Controller Tests
# =============================================================================


class TestController:
    """Tests for the GameController."""

    def test_create_game_returns_valid_state(self, controller: GameController) -> None:
        """create_game should return a valid initial state."""
        state, _ = controller.create_game()

        assert state.turn == TurnNumber(0)  # Will be 1 after start_turn
        assert state.result == GameResult.IN_PROGRESS
        assert len(state.players) == 2
        assert len(state.locations) == 3

        # Both players should have drawn initial hands
        assert len(state.get_player(PlayerId(0)).hand) == 3
        assert len(state.get_player(PlayerId(1)).hand) == 3

    def test_start_turn_increments_turn(self, controller: GameController) -> None:
        """start_turn should increment the turn number."""
        state, _ = controller.create_game()
        state, _ = controller.start_turn(state)

        assert state.turn == TurnNumber(1)
        assert state.phase == GamePhase.PLANNING

    def test_energy_equals_turn_number(self, controller: GameController) -> None:
        """Energy should equal the turn number at start of turn."""
        state, _ = controller.create_game()

        for expected_turn in range(1, 7):
            state, _ = controller.start_turn(state)
            assert state.get_player(PlayerId(0)).energy == Energy(expected_turn)
            assert state.get_player(PlayerId(1)).energy == Energy(expected_turn)

            # Pass both players
            state, _ = controller.resolve_turn(
                state,
                PassAction(player_id=PlayerId(0)),
                PassAction(player_id=PlayerId(1)),
            )

    def test_game_ends_after_turn_6(self, controller: GameController) -> None:
        """Game should end after turn 6."""
        state, _ = controller.create_game()

        # Play 6 turns with both players passing
        for _ in range(6):
            state, _ = controller.start_turn(state)
            state, _ = controller.resolve_turn(
                state,
                PassAction(player_id=PlayerId(0)),
                PassAction(player_id=PlayerId(1)),
            )

        assert state.phase == GamePhase.GAME_OVER

    def test_get_legal_actions(self, controller: GameController) -> None:
        """get_legal_actions should return valid actions."""
        state = create_test_state(
            turn=1,
            p0_energy=1,
            p1_energy=1,
            p0_hand_defs=(HOPLITE, TITAN_ATLAS),  # 1-cost and 6-cost
            p1_hand_defs=(),
        )

        actions = controller.get_legal_actions(state, PlayerId(0))

        # Should have: pass + 3 locations for Misty Knight (Hulk too expensive)
        assert len(actions) == 4

        # Check pass is included
        pass_actions = [a for a in actions if isinstance(a, PassAction)]
        assert len(pass_actions) == 1

        # Check play actions are only for Misty Knight
        play_actions = [a for a in actions if isinstance(a, PlayCardAction)]
        assert len(play_actions) == 3

        misty = state.get_player(PlayerId(0)).hand[0]
        for action in play_actions:
            assert action.card_instance_id == misty.instance_id


# =============================================================================
# Integration Test
# =============================================================================


class TestIntegration:
    """Integration tests for full game scenarios."""

    def test_full_game_completes(self, controller: GameController) -> None:
        """A full game should complete without errors."""
        state, _ = controller.create_game()

        turn_count = 0
        while state.result == GameResult.IN_PROGRESS and turn_count < 10:
            state, _ = controller.start_turn(state)

            # Get first legal action for each player (pass if no plays)
            actions_p0 = controller.get_legal_actions(state, PlayerId(0))
            actions_p1 = controller.get_legal_actions(state, PlayerId(1))

            action_p0 = actions_p0[0]  # Could be pass or play
            action_p1 = actions_p1[0]

            state, _ = controller.resolve_turn(state, action_p0, action_p1)

            turn_count += 1

        # Game should end after 6 turns
        assert state.result != GameResult.IN_PROGRESS
        assert turn_count == 6
