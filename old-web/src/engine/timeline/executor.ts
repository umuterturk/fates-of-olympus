/**
 * Timeline executor for the deterministic resolution system.
 * 
 * This module executes a pre-computed ResolutionTimeline step-by-step.
 * The executor applies each step's effect to the game state in order.
 * 
 * CRITICAL: The executor applies the pre-computed timeline.
 * It does NOT make decisions - all decisions were made during generation.
 */

import type { GameState, CardInstance } from '../models';
import type { GameEvent } from '../events';
import type { LocationIndex, PlayerId, InstanceId } from '../types';
import { SeededRNG } from '../rng';
import {
  getLocation,
  withLocation,
  withPhase,
  getCards,
  getAllCards,
  updateCard,
  withRevealed,
  withOngoingPower,
  isSilenced,
  withSilencedCard,
  findCardByInstance,
  findCardLocation,
  getCardCount,
} from '../models';
import { LOCATION_CAPACITY } from '../types';
import { applyEffect, applyOngoingPowerModification } from '../ability/effects';
import { evaluateCondition } from '../ability/conditions';
import { resolveTargets } from '../ability/selectors';
import { parseCardAbilities } from './generator';
import type { ResolutionTimeline, Step } from './types';

// =============================================================================
// Execution Result
// =============================================================================

export interface ExecutionResult {
  /** Final game state after executing all steps */
  readonly state: GameState;
  
  /** All events emitted during execution */
  readonly events: GameEvent[];
  
  /** Whether execution completed successfully */
  readonly success: boolean;
  
  /** Index of the step where execution stopped (if not successful) */
  readonly stoppedAtStep?: number;
  
  /** Error message (if not successful) */
  readonly error?: string;
}

// =============================================================================
// Timeline Execution
// =============================================================================

/**
 * Execute a complete resolution timeline.
 * 
 * @param state - Game state at the start of resolution
 * @param timeline - Pre-computed resolution timeline
 * @param rng - Seeded RNG (same seed used during generation)
 * @returns Final state and all events
 */
export function executeTimeline(
  state: GameState,
  timeline: ResolutionTimeline,
  rng: SeededRNG
): ExecutionResult {
  let currentState = withPhase(state, 'RESOLUTION');
  const allEvents: GameEvent[] = [];
  
  for (const step of timeline) {
    try {
      const result = executeStep(currentState, step, rng);
      currentState = result.state;
      allEvents.push(...result.events);
    } catch (error) {
      console.error(`Error executing step ${step.stepIndex}:`, error);
      return {
        state: currentState,
        events: allEvents,
        success: false,
        stoppedAtStep: step.stepIndex,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  return {
    state: currentState,
    events: allEvents,
    success: true,
  };
}

/**
 * Execute a single timeline step.
 */
function executeStep(
  state: GameState,
  step: Step,
  rng: SeededRNG
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const newState = state;
  
  switch (step.phase) {
    case 'REVEAL':
      return executeRevealStep(newState, step);
    
    case 'EVENT':
      return executeEventStep(newState, step, rng);
    
    case 'ONGOING_RECALC':
      return executeOngoingRecalcStep(newState, rng);
    
    case 'CLEANUP':
      return executeCleanupStep(newState);
    
    default:
      console.warn(`Unknown step phase: ${step.phase}`);
      return { state: newState, events };
  }
}

// =============================================================================
// Phase-Specific Execution
// =============================================================================

/**
 * Execute a REVEAL step.
 */
function executeRevealStep(
  state: GameState,
  step: Step
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;
  
  if (step.source.type !== 'CARD') {
    return { state: newState, events };
  }
  
  const cardId = step.source.id as InstanceId;
  const card = findCardByInstance(newState, cardId);
  const location = findCardLocation(newState, cardId);
  
  if (!card || location === null) {
    return { state: newState, events };
  }
  
  // Reveal the card
  const revealedCard = withRevealed(card, true);
  let loc = getLocation(newState, location);
  loc = updateCard(loc, revealedCard);
  newState = withLocation(newState, location, loc);
  
  events.push({
    type: 'CardRevealed',
    cardInstanceId: cardId,
    location,
    playerId: card.owner,
  });
  
  return { state: newState, events };
}

/**
 * Execute an EVENT step (ability effect).
 */
function executeEventStep(
  state: GameState,
  step: Step,
  rng: SeededRNG
): { state: GameState; events: GameEvent[] } {
  const result = applyEffect(state, step, rng);
  
  // Add ability triggered event
  const events: GameEvent[] = [{
    type: 'AbilityTriggered' as const,
    sourceCardId: step.source.id as InstanceId,
    trigger: step.trigger,
    targets: [...step.targets],
    effect: step.effect,
  } as GameEvent, ...result.events];
  
  return {
    state: result.state,
    events,
  };
}

/**
 * Execute an ONGOING_RECALC step.
 * This recomputes all ongoing effects from scratch using the ability system.
 * 
 * IMPORTANT: This function now emits PowerChangedEvent for cards whose
 * effective power changed due to ongoing effects (e.g., Ares conditional buff).
 */
function executeOngoingRecalcStep(
  state: GameState,
  rng: SeededRNG
): { state: GameState; events: GameEvent[] } {
  let newState = state;
  const events: GameEvent[] = [];
  
  // Track old effective power for all cards BEFORE any changes
  // Map: instanceId -> { oldPower, oldOngoingPower }
  const oldPowerMap = new Map<InstanceId, { oldPower: number; oldOngoingPower: number }>();
  for (const location of state.locations) {
    for (const card of getAllCards(location)) {
      oldPowerMap.set(card.instanceId, {
        oldPower: card.cardDef.basePower + card.permanentPowerModifier + card.ongoingPowerModifier,
        oldOngoingPower: card.ongoingPowerModifier,
      });
    }
  }
  
  // Track which source card provides ongoing power to which targets
  // Map: targetId -> sourceId (the card providing the ongoing buff)
  const ongoingSourceMap = new Map<InstanceId, InstanceId>();
  
  // Step 1: Reset all ongoing power modifiers to 0
  for (let locIdx = 0; locIdx < 3; locIdx++) {
    let loc = getLocation(newState, locIdx as LocationIndex);
    const newCardsByPlayer: [readonly CardInstance[], readonly CardInstance[]] = [
      loc.cardsByPlayer[0].map(c => withOngoingPower(c, 0)),
      loc.cardsByPlayer[1].map(c => withOngoingPower(c, 0)),
    ];
    loc = { ...loc, cardsByPlayer: newCardsByPlayer };
    newState = withLocation(newState, locIdx as LocationIndex, loc);
  }
  
  // Step 2: Clear silenced cards (silence is reapplied fresh)
  newState = { ...newState, silencedCards: [] };
  
  // Step 3: Apply silence effects first (using ability system)
  for (const location of newState.locations) {
    for (const card of getAllCards(location)) {
      if (!card.revealed || card.cardDef.abilityType !== 'ONGOING') continue;
      
      // Parse ONGOING abilities for this card
      const abilities = parseCardAbilities(card, 'ONGOING');
      
      for (const ability of abilities) {
        if (ability.effect === 'SILENCE_ENEMY_ONGOING_HERE') {
          // Apply silence to all enemies at this location
          const enemyPlayer = (1 - card.owner) as PlayerId;
          const enemies = getCards(location, enemyPlayer);
          for (const enemy of enemies) {
            newState = withSilencedCard(newState, enemy.instanceId);
          }
        }
      }
    }
  }
  
  // Step 4: Apply ongoing power effects (respecting silence, using ability system)
  for (const location of newState.locations) {
    for (const card of getAllCards(location)) {
      if (!card.revealed || card.cardDef.abilityType !== 'ONGOING') continue;
      if (isSilenced(newState, card.instanceId)) continue;
      
      // Parse ONGOING abilities for this card
      const abilities = parseCardAbilities(card, 'ONGOING');
      
      for (const ability of abilities) {
        // Skip silence effects (already handled)
        if (ability.effect === 'SILENCE_ENEMY_ONGOING_HERE') continue;
        
        // Evaluate condition
        if (!evaluateCondition(ability.condition, newState, card, location.index)) {
          continue;
        }
        
        // Handle different effect types
        if (ability.effect === 'BUFF_ALLIES_HERE' || ability.effect === 'DEBUFF_ENEMIES_HERE') {
          // Check if this is a scaling effect (has perUnitAmount parameter)
          if (ability.parameters?.perUnitAmount !== undefined && ability.parameters?.countFilter) {
            // Scaling ongoing effect (e.g., Dionysus)
            let count = 0;
            
            // Count based on countFilter
            if (ability.parameters.countFilter === 'LOCATION') {
              // Count empty slots for Dionysus
              const allyCount = getCardCount(location, card.owner);
              count = LOCATION_CAPACITY - allyCount;
            } else {
              // Use target resolver for other count filters
              const countTargets = resolveTargets(
                ability.parameters.countFilter as import('../ability/types').TargetSelector,
                newState,
                card,
                location.index,
                rng
              );
              count = countTargets.length;
            }
            
            const bonus = count * ability.parameters.perUnitAmount;
            
            if (bonus !== 0) {
              const targets = resolveTargets(ability.targetSelector, newState, card, location.index, rng);
              // Track which source card is providing the ongoing buff
              for (const targetId of targets) {
                // Only track if source is different from target (for animation purposes)
                if (targetId !== card.instanceId) {
                  ongoingSourceMap.set(targetId, card.instanceId);
                }
              }
              newState = applyOngoingPowerModification(newState, targets, bonus);
            }
          } else {
            // Simple ongoing power effect
            const targets = resolveTargets(ability.targetSelector, newState, card, location.index, rng);
            // Track which source card is providing the ongoing buff
            for (const targetId of targets) {
              // Only track if source is different from target (for animation purposes)
              if (targetId !== card.instanceId) {
                ongoingSourceMap.set(targetId, card.instanceId);
              }
            }
            newState = applyOngoingPowerModification(newState, targets, ability.value);
          }
        } else if (ability.effect === 'BUFF_DESTROY_CARDS_GLOBAL') {
          // Global ongoing buff for destroy-tagged cards (Underworld Gate)
          const targets = resolveTargets(ability.targetSelector, newState, card, location.index, rng);
          // Track which source card is providing the ongoing buff
          for (const targetId of targets) {
            if (targetId !== card.instanceId) {
              ongoingSourceMap.set(targetId, card.instanceId);
            }
          }
          newState = applyOngoingPowerModification(newState, targets, ability.value);
        }
      }
    }
  }
  
  // Step 5: Emit PowerChangedEvent for cards whose ongoing power changed
  // Only emit events where source != target (these trigger animations)
  for (const location of newState.locations) {
    for (const card of getAllCards(location)) {
      const oldData = oldPowerMap.get(card.instanceId);
      if (!oldData) continue;
      
      const newPower = card.cardDef.basePower + card.permanentPowerModifier + card.ongoingPowerModifier;
      const oldPower = oldData.oldPower;
      
      // Check if effective power changed due to ongoing effects
      if (newPower !== oldPower) {
        // Get the source card that caused this change
        const sourceCardId = ongoingSourceMap.get(card.instanceId);
        
        // Only emit if we have a source and it's different from the target
        // This matches the filter in gameStore that triggers animations
        if (sourceCardId !== undefined && sourceCardId !== card.instanceId) {
          events.push({
            type: 'PowerChanged',
            cardInstanceId: card.instanceId,
            oldPower,
            newPower,
            sourceCardId,
          });
        }
      }
    }
  }
  
  return { state: newState, events };
}

/**
 * Execute a CLEANUP step.
 * This expires temporary effects and prepares for next turn.
 */
function executeCleanupStep(
  state: GameState
): { state: GameState; events: GameEvent[] } {
  // Currently, most cleanup is handled by ongoing recalc
  // This step is primarily for future temporary effect expiration
  return { state, events: [] };
}

// =============================================================================
// Step-by-Step Execution (for UI animation)
// =============================================================================

/**
 * Create an iterator for step-by-step execution.
 * This allows the UI to execute one step at a time with animation pauses.
 */
export function createStepIterator(
  initialState: GameState,
  timeline: ResolutionTimeline,
  rng: SeededRNG
): TimelineIterator {
  return new TimelineIterator(initialState, timeline, rng);
}

/**
 * Iterator for step-by-step timeline execution.
 */
export class TimelineIterator {
  private currentState: GameState;
  private readonly timeline: ResolutionTimeline;
  private readonly rng: SeededRNG;
  private currentIndex: number;
  private readonly allEvents: GameEvent[];
  
  constructor(
    initialState: GameState,
    timeline: ResolutionTimeline,
    rng: SeededRNG
  ) {
    this.currentState = withPhase(initialState, 'RESOLUTION');
    this.timeline = timeline;
    this.rng = rng;
    this.currentIndex = 0;
    this.allEvents = [];
  }
  
  /**
   * Check if there are more steps to execute.
   */
  hasNext(): boolean {
    return this.currentIndex < this.timeline.length;
  }
  
  /**
   * Get the current step (without executing).
   */
  peek(): Step | null {
    if (!this.hasNext()) return null;
    return this.timeline[this.currentIndex]!;
  }
  
  /**
   * Execute the next step and return its events.
   */
  next(): { step: Step; events: GameEvent[] } | null {
    if (!this.hasNext()) return null;
    
    const step = this.timeline[this.currentIndex]!;
    const result = executeStep(this.currentState, step, this.rng);
    
    this.currentState = result.state;
    this.allEvents.push(...result.events);
    this.currentIndex++;
    
    return { step, events: result.events };
  }
  
  /**
   * Get the current game state.
   */
  getState(): GameState {
    return this.currentState;
  }
  
  /**
   * Get all events emitted so far.
   */
  getEvents(): readonly GameEvent[] {
    return this.allEvents;
  }
  
  /**
   * Get the current step index.
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }
  
  /**
   * Get the total number of steps.
   */
  getTotalSteps(): number {
    return this.timeline.length;
  }
  
  /**
   * Get progress as a percentage (0-100).
   */
  getProgress(): number {
    if (this.timeline.length === 0) return 100;
    return Math.round((this.currentIndex / this.timeline.length) * 100);
  }
}
