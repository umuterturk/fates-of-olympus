/**
 * Greedy AI for NPC opponent
 * 
 * Simple strategy: evaluate each legal action and pick the one
 * that maximizes immediate board state value.
 */

import type { GameState, PlayerAction, PassAction } from '@engine/models';
import { getLocation, getPlayer, getTotalPower, getCardCount } from '@engine/models';
import type { PlayerId, LocationIndex } from '@engine/types';
import { getLegalActions, resolveTurn } from '@engine/controller';

/**
 * Compute the best action for the NPC using greedy evaluation.
 */
export function computeGreedyAction(state: GameState, playerId: PlayerId): PlayerAction {
  const legalActions = getLegalActions(state, playerId);
  
  if (legalActions.length === 0) {
    return { type: 'Pass', playerId };
  }
  
  // If only pass is available, pass
  if (legalActions.length === 1) {
    return legalActions[0]!;
  }
  
  let bestAction: PlayerAction = { type: 'Pass', playerId };
  let bestScore = -Infinity;
  
  // Evaluate current state
  const currentScore = evaluateState(state, playerId);
  
  for (const action of legalActions) {
    if (action.type === 'Pass') {
      // Passing keeps current score
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestAction = action;
      }
      continue;
    }
    
    // Simulate this action (opponent passes)
    const opponentId = (1 - playerId) as PlayerId;
    const opponentPass: PassAction = { type: 'Pass', playerId: opponentId };
    
    const { state: simState } = resolveTurn(
      state,
      playerId === 0 ? action : opponentPass,
      playerId === 1 ? action : opponentPass,
    );
    
    const score = evaluateState(simState, playerId);
    
    // Add some randomness to avoid predictable play
    const randomBonus = Math.random() * 0.5;
    
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
): Promise<PlayerAction> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(computeGreedyAction(state, playerId));
    }, delayMs);
  });
}
