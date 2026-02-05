/**
 * Greedy AI for NPC opponent
 * 
 * Simple strategy: evaluate each legal action and pick the one
 * that maximizes immediate board state value.
 * 
 * Uses the DETERMINISTIC resolution system for accurate simulation.
 */

import type { GameState, PlayerAction, PassAction } from '@engine/models';
import { getLocation, getPlayer, getTotalPower, getCardCount } from '@engine/models';
import type { PlayerId, LocationIndex } from '@engine/types';
import { getLegalActions, resolveTurnDeterministic } from '@engine/controller';
import { SeededRNG } from '@engine/rng';

// =============================================================================
// Difficulty Configuration
// =============================================================================

/**
 * Configuration for AI difficulty levels.
 * Higher randomness and blunder chance make the AI easier.
 */
export interface DifficultyConfig {
  /** Multiplier for random bonus when selecting actions (0.5 is baseline) */
  randomnessFactor: number;
  /** Probability (0-1) to make a completely random move instead of optimal */
  blunderChance: number;
  /** Random noise added to state evaluations (masks true best plays) */
  evaluationNoise: number;
}

/**
 * Predefined difficulty levels for the AI.
 * - easy: For new players (0-4 unlocks) - makes frequent mistakes
 * - medium: For intermediate players (5-14 unlocks) - occasional mistakes
 * - hard: For experienced players (15+ unlocks) - plays optimally
 */
export const DIFFICULTY_LEVELS: Record<'easy' | 'medium' | 'hard', DifficultyConfig> = {
  easy: {
    randomnessFactor: 3.0,
    blunderChance: 0.3,
    evaluationNoise: 200,
  },
  medium: {
    randomnessFactor: 1.5,
    blunderChance: 0.1,
    evaluationNoise: 50,
  },
  hard: {
    randomnessFactor: 0.5,
    blunderChance: 0.0,
    evaluationNoise: 0,
  },
};

/**
 * Get the appropriate difficulty level based on player's unlock progress.
 * As players unlock more cards, they face a smarter AI.
 */
export function getDifficultyForPosition(unlockPosition: number): DifficultyConfig {
  if (unlockPosition < 5) return DIFFICULTY_LEVELS.easy;
  if (unlockPosition < 15) return DIFFICULTY_LEVELS.medium;
  return DIFFICULTY_LEVELS.hard;
}

/** Default difficulty (hard) for backwards compatibility */
const DEFAULT_DIFFICULTY: DifficultyConfig = DIFFICULTY_LEVELS.hard;

// =============================================================================
// AI Implementation
// =============================================================================

// Simulation RNG for AI evaluation (seeded for consistency within a game)
let simulationRng = new SeededRNG(12345);

/**
 * Reset the simulation RNG (call at start of each turn for consistency).
 */
export function resetSimulationRng(seed: number = 12345): void {
  simulationRng = new SeededRNG(seed);
}

/**
 * Compute the best action for the NPC using greedy evaluation.
 * Uses deterministic simulation for accurate predictions.
 * 
 * @param state - Current game state
 * @param playerId - The player ID making the decision (typically 1 for NPC)
 * @param difficulty - Optional difficulty configuration (defaults to hard)
 */
export function computeGreedyAction(
  state: GameState,
  playerId: PlayerId,
  difficulty: DifficultyConfig = DEFAULT_DIFFICULTY
): PlayerAction {
  const legalActions = getLegalActions(state, playerId);
  
  if (legalActions.length === 0) {
    return { type: 'Pass', playerId };
  }
  
  // If only pass is available, pass
  if (legalActions.length === 1) {
    return legalActions[0]!;
  }
  
  // Blunder check: with some probability, make a completely random move
  // This makes the AI feel more human and helps beginners win
  if (difficulty.blunderChance > 0 && simulationRng.next() < difficulty.blunderChance) {
    // Pick a random non-pass action if available, otherwise pass
    const nonPassActions = legalActions.filter(a => a.type !== 'Pass');
    if (nonPassActions.length > 0) {
      const randomIndex = Math.floor(simulationRng.next() * nonPassActions.length);
      return nonPassActions[randomIndex]!;
    }
  }
  
  let bestAction: PlayerAction = { type: 'Pass', playerId };
  let bestScore = -Infinity;
  
  // Evaluate current state with noise
  const currentScore = evaluateState(state, playerId) + 
    (difficulty.evaluationNoise > 0 ? (simulationRng.next() - 0.5) * difficulty.evaluationNoise : 0);
  
  for (const action of legalActions) {
    if (action.type === 'Pass') {
      // Passing keeps current score
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestAction = action;
      }
      continue;
    }
    
    // Simulate this action (opponent passes) using DETERMINISTIC resolution
    const opponentId = (1 - playerId) as PlayerId;
    const opponentPass: PassAction = { type: 'Pass', playerId: opponentId };
    
    // Clone RNG state for simulation to avoid affecting the real game
    const simRng = simulationRng.clone();
    
    const result = resolveTurnDeterministic(
      state,
      playerId === 0 ? action : opponentPass,
      playerId === 1 ? action : opponentPass,
      simRng
    );
    
    // Add evaluation noise to mask the true best plays (easier difficulties)
    const evaluationNoise = difficulty.evaluationNoise > 0 
      ? (simulationRng.next() - 0.5) * difficulty.evaluationNoise 
      : 0;
    const score = evaluateState(result.state, playerId) + evaluationNoise;
    
    // Add randomness to avoid predictable play (scaled by difficulty)
    const randomBonus = simulationRng.next() * difficulty.randomnessFactor;
    
    if (score + randomBonus > bestScore) {
      bestScore = score + randomBonus;
      bestAction = action;
    }
  }
  
  return bestAction;
}

/**
 * Evaluate the board state from a player's perspective.
 * Higher score = better position.
 */
function evaluateState(state: GameState, playerId: PlayerId): number {
  let score = 0;
  const enemyId = (1 - playerId) as PlayerId;
  
  // Evaluate each location
  for (let i = 0; i < 3; i++) {
    const location = getLocation(state, i as LocationIndex);
    const myPower = getTotalPower(location, playerId);
    const enemyPower = getTotalPower(location, enemyId);
    const myCards = getCardCount(location, playerId);
    
    // Winning a location is very valuable (1000 points)
    if (myPower > enemyPower) {
      score += 1000;
      // Bonus for larger margin
      score += (myPower - enemyPower) * 10;
    } else if (myPower === enemyPower && myPower > 0) {
      // Tied location is somewhat valuable
      score += 200;
    }
    
    // Raw power matters for tiebreakers
    score += myPower * 5;
    
    // Prefer to spread cards out (don't over-commit to one location)
    if (myCards > 0 && myCards < 4) {
      score += 50;
    }
    
    // Penalty for empty locations late game
    if (myCards === 0 && state.turn >= 3) {
      score -= 100;
    }
    
    // Consider card slots (having room to play is valuable)
    const availableSlots = 4 - myCards;
    score += availableSlots * 20;
  }
  
  // Value cards in hand (future potential)
  const player = getPlayer(state, playerId);
  for (const card of player.hand) {
    // Higher cost cards are generally more impactful
    score += card.cardDef.basePower * 3;
    
    // Can we afford to play this card?
    if (card.cardDef.cost <= player.energy) {
      score += 30; // Bonus for playable cards
    }
  }
  
  // Energy efficiency - penalize unspent energy late game
  if (state.turn >= 4 && player.energy > 0) {
    score -= player.energy * 10;
  }
  
  return score;
}

/**
 * Add a small delay to make NPC feel more natural
 */
export function computeGreedyActionWithDelay(
  state: GameState, 
  playerId: PlayerId,
  delayMs: number = 500,
  difficulty: DifficultyConfig = DEFAULT_DIFFICULTY,
): Promise<PlayerAction> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(computeGreedyAction(state, playerId, difficulty));
    }, delayMs);
  });
}
