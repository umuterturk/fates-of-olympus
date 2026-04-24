/**
 * Timeline types for the deterministic resolution system.
 * 
 * The ResolutionTimeline is the core data structure that represents
 * the pre-computed sequence of all game events during Phase B (Resolution).
 * 
 * CRITICAL: The timeline is generated ONCE at the start of Phase B,
 * and is then immutable. The UI consumes this timeline for animations.
 */

import type { InstanceId, LocationIndex, PlayerId, TurnNumber } from '../types';
import type {
  Trigger,
  Condition,
  EffectType,
  DurationScope,
  ResolutionPhase,
  StepSourceType,
  VisualEffectType,
  VisualIntensity,
} from '../ability/types';

// =============================================================================
// Step Source
// =============================================================================

/**
 * Identifies what triggered a timeline step.
 */
export interface StepSource {
  /** Type of source (card, location, or system) */
  readonly type: StepSourceType;
  
  /** ID of the source (card instance ID, location index, or 'SYSTEM') */
  readonly id: InstanceId | LocationIndex | 'SYSTEM';
  
  /** Owner of the source (if applicable) */
  readonly owner?: PlayerId;
}

/**
 * Create a card source.
 */
export function createCardSource(instanceId: InstanceId, owner: PlayerId): StepSource {
  return { type: 'CARD', id: instanceId, owner };
}

/**
 * Create a location source.
 */
export function createLocationSource(locationIndex: LocationIndex): StepSource {
  return { type: 'LOCATION', id: locationIndex };
}

/**
 * Create a system source.
 */
export function createSystemSource(): StepSource {
  return { type: 'SYSTEM', id: 'SYSTEM' };
}

// =============================================================================
// Visual Metadata for Steps
// =============================================================================

/**
 * Visual metadata attached to each step for UI animation.
 */
export interface StepVisualMetadata {
  /** Type of visual effect */
  readonly visualEffectType: VisualEffectType;
  
  /** Intensity of the effect */
  readonly intensity: VisualIntensity;
  
  /** Entities affected by the visual */
  readonly affectedEntities: readonly (InstanceId | LocationIndex)[];
  
  /** Source location for beam/particle effects */
  readonly sourceLocation?: LocationIndex;
  
  /** Target location for beam/particle effects */
  readonly targetLocation?: LocationIndex;
}

// =============================================================================
// Resolution Step
// =============================================================================

/**
 * Additional parameters for complex effects.
 */
export interface StepParameters {
  /** For compound effects: secondary target selector */
  readonly secondaryTarget?: string;
  
  /** For compound effects: secondary value */
  readonly secondaryValue?: number;
  
  /** For scaling effects: amount per unit */
  readonly perUnitAmount?: number;
  
  /** For scaling effects: what to count */
  readonly countFilter?: string;
}

/**
 * A single step in the resolution timeline.
 * 
 * Each step represents one atomic game action that will be executed
 * in sequence during Phase B resolution.
 */
export interface Step {
  /** Monotonically increasing index (0-based) */
  readonly stepIndex: number;
  
  /** Phase within resolution */
  readonly phase: ResolutionPhase;
  
  /** What triggered this step */
  readonly source: StepSource;
  
  /** The trigger that caused this step */
  readonly trigger: Trigger;
  
  /** Condition that was evaluated (for reference) */
  readonly condition: Condition;
  
  /** Target instance IDs that will be affected */
  readonly targets: readonly InstanceId[];
  
  /** Effect type to apply */
  readonly effect: EffectType;
  
  /** Numeric value for the effect */
  readonly value: number;
  
  /** Additional parameters for complex effects */
  readonly parameters?: StepParameters;
  
  /** How long the effect lasts */
  readonly durationScope: DurationScope;
  
  /** Visual metadata for UI animation */
  readonly visualMetadata: StepVisualMetadata;
  
  /** Optional description for debugging */
  readonly description?: string;
}

// =============================================================================
// Resolution Timeline
// =============================================================================

/**
 * The complete timeline of all steps in Phase B resolution.
 * 
 * This is an immutable array generated ONCE at the start of Phase B.
 * The engine executes steps in order, and the UI animates based on the timeline.
 */
export type ResolutionTimeline = readonly Step[];

// =============================================================================
// Timeline Metadata
// =============================================================================

/**
 * Metadata about the resolution timeline.
 */
export interface TimelineMetadata {
  /** Turn number this timeline is for */
  readonly turn: TurnNumber;
  
  /** Seed used for RNG during generation */
  readonly rngSeed: number;
  
  /** Total number of steps */
  readonly stepCount: number;
  
  /** Number of REVEAL steps */
  readonly revealCount: number;
  
  /** Number of EVENT steps */
  readonly eventCount: number;
  
  /** Number of ONGOING_RECALC steps */
  readonly ongoingRecalcCount: number;
  
  /** Number of CLEANUP steps */
  readonly cleanupCount: number;
  
  /** Cards that will be revealed */
  readonly cardsToReveal: readonly InstanceId[];
  
  /** Cards that will be destroyed */
  readonly cardsToDestroy: readonly InstanceId[];
  
  /** Cards that will be moved */
  readonly cardsToMove: readonly InstanceId[];
}

/**
 * Complete timeline result including steps and metadata.
 */
export interface TimelineResult {
  /** The resolution timeline (array of steps) */
  readonly timeline: ResolutionTimeline;
  
  /** Metadata about the timeline */
  readonly metadata: TimelineMetadata;
}

// =============================================================================
// Played Card Info
// =============================================================================

/**
 * Information about a card that was played this turn.
 * Used as input to timeline generation.
 */
export interface PlayedCard {
  /** Instance ID of the played card */
  readonly instanceId: InstanceId;
  
  /** Player who played the card */
  readonly playerId: PlayerId;
  
  /** Location where the card was played */
  readonly location: LocationIndex;
  
  /** Order in which the card was played (0-based, within this turn) */
  readonly playOrder: number;
}

// =============================================================================
// Step Factory Functions
// =============================================================================

/**
 * Create a REVEAL step for a card.
 */
export function createRevealStep(
  stepIndex: number,
  card: { instanceId: InstanceId; owner: PlayerId },
  location: LocationIndex
): Step {
  return {
    stepIndex,
    phase: 'REVEAL',
    source: createCardSource(card.instanceId, card.owner),
    trigger: 'ON_REVEAL',
    condition: 'NONE',
    targets: [card.instanceId],
    effect: 'POWER', // Reveal is not a power effect, but we use this as a placeholder
    value: 0,
    durationScope: 'INSTANT',
    visualMetadata: {
      visualEffectType: 'GLOW',
      intensity: 'MEDIUM',
      affectedEntities: [card.instanceId],
      sourceLocation: location,
    },
    description: `Reveal card ${card.instanceId}`,
  };
}

/**
 * Create an EVENT step for an ability effect.
 */
export function createEventStep(
  stepIndex: number,
  source: StepSource,
  trigger: Trigger,
  condition: Condition,
  targets: readonly InstanceId[],
  effect: EffectType,
  value: number,
  durationScope: DurationScope,
  visualMetadata: StepVisualMetadata,
  description?: string,
  parameters?: StepParameters
): Step {
  return {
    stepIndex,
    phase: 'EVENT',
    source,
    trigger,
    condition,
    targets,
    effect,
    value,
    parameters,
    durationScope,
    visualMetadata,
    description,
  };
}

/**
 * Create an ONGOING_RECALC step.
 */
export function createOngoingRecalcStep(stepIndex: number): Step {
  return {
    stepIndex,
    phase: 'ONGOING_RECALC',
    source: createSystemSource(),
    trigger: 'ONGOING',
    condition: 'NONE',
    targets: [],
    effect: 'POWER',
    value: 0,
    durationScope: 'WHILE_IN_PLAY',
    visualMetadata: {
      visualEffectType: 'PULSE',
      intensity: 'LOW',
      affectedEntities: [],
    },
    description: 'Recalculate ongoing effects',
  };
}

/**
 * Create a CLEANUP step.
 */
export function createCleanupStep(stepIndex: number): Step {
  return {
    stepIndex,
    phase: 'CLEANUP',
    source: createSystemSource(),
    trigger: 'END_OF_TURN',
    condition: 'NONE',
    targets: [],
    effect: 'POWER',
    value: 0,
    durationScope: 'INSTANT',
    visualMetadata: {
      visualEffectType: 'FADE',
      intensity: 'LOW',
      affectedEntities: [],
    },
    description: 'Cleanup temporary effects',
  };
}

// =============================================================================
// Timeline Utilities
// =============================================================================

/**
 * Get all steps of a specific phase.
 */
export function getStepsByPhase(
  timeline: ResolutionTimeline,
  phase: ResolutionPhase
): readonly Step[] {
  return timeline.filter(step => step.phase === phase);
}

/**
 * Get all steps for a specific source card.
 */
export function getStepsForCard(
  timeline: ResolutionTimeline,
  cardInstanceId: InstanceId
): readonly Step[] {
  return timeline.filter(
    step => step.source.type === 'CARD' && step.source.id === cardInstanceId
  );
}

/**
 * Get all steps affecting a specific target.
 */
export function getStepsAffectingTarget(
  timeline: ResolutionTimeline,
  targetInstanceId: InstanceId
): readonly Step[] {
  return timeline.filter(step => step.targets.includes(targetInstanceId));
}

/**
 * Calculate timeline metadata.
 */
export function calculateTimelineMetadata(
  timeline: ResolutionTimeline,
  turn: TurnNumber,
  rngSeed: number
): TimelineMetadata {
  const revealSteps = getStepsByPhase(timeline, 'REVEAL');
  const eventSteps = getStepsByPhase(timeline, 'EVENT');
  const ongoingSteps = getStepsByPhase(timeline, 'ONGOING_RECALC');
  const cleanupSteps = getStepsByPhase(timeline, 'CLEANUP');
  
  const cardsToReveal = revealSteps.map(s => s.targets[0]!);
  
  const cardsToDestroy: InstanceId[] = [];
  const cardsToMove: InstanceId[] = [];
  
  for (const step of eventSteps) {
    if (step.effect.includes('DESTROY')) {
      cardsToDestroy.push(...step.targets);
    }
    if (step.effect.includes('MOVE')) {
      cardsToMove.push(...step.targets);
    }
  }
  
  return {
    turn,
    rngSeed,
    stepCount: timeline.length,
    revealCount: revealSteps.length,
    eventCount: eventSteps.length,
    ongoingRecalcCount: ongoingSteps.length,
    cleanupCount: cleanupSteps.length,
    cardsToReveal,
    cardsToDestroy: [...new Set(cardsToDestroy)],
    cardsToMove: [...new Set(cardsToMove)],
  };
}

/**
 * Verify timeline integrity.
 */
export function verifyTimelineIntegrity(timeline: ResolutionTimeline): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check step indices are sequential
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i]!.stepIndex !== i) {
      errors.push(`Step ${i} has incorrect stepIndex ${timeline[i]!.stepIndex}`);
    }
  }
  
  // Check phases are in correct order
  let lastPhaseOrder = -1;
  const phaseOrder: Record<ResolutionPhase, number> = {
    'REVEAL': 0,
    'EVENT': 1,
    'ONGOING_RECALC': 2,
    'CLEANUP': 3,
  };
  
  for (const step of timeline) {
    const currentPhaseOrder = phaseOrder[step.phase];
    if (currentPhaseOrder < lastPhaseOrder) {
      errors.push(`Phase ${step.phase} at step ${step.stepIndex} is out of order`);
    }
    lastPhaseOrder = currentPhaseOrder;
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
