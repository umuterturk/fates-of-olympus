/**
 * Tutorial state management using Zustand.
 *
 * Tracks progress through the scripted tutorial match and which step
 * the player is on. Used by Game.tsx and TutorialPrompt to show
 * contextual prompts and advance the flow.
 */

import { create } from 'zustand';

export interface TutorialStepConfig {
  id: string;
  message: string;
  /** data-name or other selector for spotlight highlight */
  highlight?: string;
  /** How this step is dismissed / advanced */
  trigger: 'click_continue' | 'on_play_card' | 'on_end_turn';
  /** If false, no dark backdrop — board stays bright (e.g. for intro steps). Default true. */
  dimBackground?: boolean;
}

interface TutorialStore {
  /** Whether the tutorial match is currently active */
  isActive: boolean;
  /** Current step index (into the steps array from TutorialMatch) */
  currentStep: number;
  /** Step IDs that have been completed (for persistence if needed) */
  completedSteps: string[];

  startTutorial: () => void;
  advanceStep: () => void;
  completeTutorial: () => void;
  skipTutorial: () => void;
}

export const useTutorialStore = create<TutorialStore>((set) => ({
  isActive: false,
  currentStep: 0,
  completedSteps: [],

  startTutorial: () =>
    set({
      isActive: true,
      currentStep: 0,
      completedSteps: [],
    }),

  advanceStep: () =>
    set((state) => ({
      currentStep: state.currentStep + 1,
      completedSteps: [...state.completedSteps],
    })),

  completeTutorial: () =>
    set({
      isActive: false,
      currentStep: 0,
      completedSteps: [],
    }),

  skipTutorial: () =>
    set({
      isActive: false,
      currentStep: 0,
      completedSteps: [],
    }),
}));
