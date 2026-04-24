/**
 * Storage types and interfaces.
 * Designed to support both localStorage and future Firebase migration.
 */

import type { CardId } from '@engine/types';

// =============================================================================
// Ideology Types
// =============================================================================

export type Ideology = 'NOMOS' | 'KATABASIS' | 'KINESIS';

export const IDEOLOGIES: readonly Ideology[] = ['NOMOS', 'KATABASIS', 'KINESIS'] as const;

// =============================================================================
// Player Profile
// =============================================================================

export interface LoginStreak {
  count: number;
  lastLoginDate: string; // ISO date string (YYYY-MM-DD)
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  perfectWins: number;
}

export interface PlayerProfile {
  id: string;
  credits: number;
  unlockedCardIds: CardId[];
  currentDeckIds: CardId[];
  unlockPathPosition: number;
  chosenIdeology: Ideology | null;
  loginStreak: LoginStreak;
  stats: PlayerStats;
  /** Whether the player has completed the scripted tutorial match */
  tutorialCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Storage Adapter Interface
// =============================================================================

/**
 * Storage adapter interface for persistence.
 * Implementations can use localStorage, Firebase, or other backends.
 */
export interface StorageAdapter {
  /**
   * Get a player profile by ID.
   * Returns null if profile doesn't exist.
   */
  getProfile(id: string): Promise<PlayerProfile | null>;

  /**
   * Save a complete player profile.
   * Creates a new profile if it doesn't exist.
   */
  saveProfile(profile: PlayerProfile): Promise<void>;

  /**
   * Update player credits by a delta (positive or negative).
   */
  updateCredits(id: string, delta: number): Promise<void>;

  /**
   * Add a card to the player's unlocked cards.
   */
  unlockCard(id: string, cardId: CardId): Promise<void>;

  /**
   * Update the player's current deck.
   */
  updateDeck(id: string, deckIds: CardId[]): Promise<void>;

  /**
   * Update the player's stats after a game.
   */
  updateStats(id: string, stats: Partial<PlayerStats>): Promise<void>;

  /**
   * Update the login streak.
   */
  updateLoginStreak(id: string, streak: LoginStreak): Promise<void>;

  /**
   * Set the player's chosen ideology.
   */
  setIdeology(id: string, ideology: Ideology): Promise<void>;

  /**
   * Increment the unlock path position.
   */
  incrementPathPosition(id: string): Promise<void>;

  /**
   * Check if storage is available.
   */
  isAvailable(): boolean;
}

// =============================================================================
// Factory Types
// =============================================================================

export type StorageType = 'localStorage' | 'firebase';

export interface StorageConfig {
  type: StorageType;
  // Firebase config would go here in the future
}
