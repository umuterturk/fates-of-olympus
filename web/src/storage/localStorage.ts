/**
 * LocalStorage adapter implementation.
 * Stores player profile data in browser localStorage.
 */

import type { CardId } from '@engine/types';
import type {
  StorageAdapter,
  PlayerProfile,
  PlayerStats,
  LoginStreak,
  Ideology,
} from './types';

const STORAGE_KEY_PREFIX = 'fates_of_olympus_';
const PROFILE_KEY = `${STORAGE_KEY_PREFIX}player_profile`;

/**
 * LocalStorage implementation of StorageAdapter.
 * Data persists across browser sessions but is device-specific.
 */
export class LocalStorageAdapter implements StorageAdapter {
  /**
   * Check if localStorage is available in this environment.
   */
  isAvailable(): boolean {
    try {
      const testKey = `${STORAGE_KEY_PREFIX}test`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the stored profile, or null if not found.
   */
  async getProfile(id: string): Promise<PlayerProfile | null> {
    if (!this.isAvailable()) return null;

    try {
      const data = localStorage.getItem(`${PROFILE_KEY}_${id}`);
      if (!data) return null;

      const profile = JSON.parse(data) as PlayerProfile;
      
      // Validate the profile structure
      if (!this.isValidProfile(profile)) {
        console.warn('[LocalStorage] Invalid profile structure, returning null');
        return null;
      }

      return profile;
    } catch (error) {
      console.error('[LocalStorage] Error reading profile:', error);
      return null;
    }
  }

  /**
   * Save a complete profile to localStorage.
   */
  async saveProfile(profile: PlayerProfile): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('localStorage is not available');
    }

    try {
      const updatedProfile = {
        ...profile,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        `${PROFILE_KEY}_${profile.id}`,
        JSON.stringify(updatedProfile)
      );
    } catch (error) {
      console.error('[LocalStorage] Error saving profile:', error);
      throw error;
    }
  }

  /**
   * Update credits by a delta amount.
   */
  async updateCredits(id: string, delta: number): Promise<void> {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.credits = Math.max(0, profile.credits + delta);
    await this.saveProfile(profile);
  }

  /**
   * Add a card to unlocked cards if not already unlocked.
   */
  async unlockCard(id: string, cardId: CardId): Promise<void> {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    if (!profile.unlockedCardIds.includes(cardId)) {
      profile.unlockedCardIds = [...profile.unlockedCardIds, cardId];
      await this.saveProfile(profile);
    }
  }

  /**
   * Update the player's current deck.
   */
  async updateDeck(id: string, deckIds: CardId[]): Promise<void> {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.currentDeckIds = deckIds;
    await this.saveProfile(profile);
  }

  /**
   * Update player stats.
   */
  async updateStats(id: string, stats: Partial<PlayerStats>): Promise<void> {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.stats = {
      ...profile.stats,
      ...stats,
    };
    await this.saveProfile(profile);
  }

  /**
   * Update the login streak.
   */
  async updateLoginStreak(id: string, streak: LoginStreak): Promise<void> {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.loginStreak = streak;
    await this.saveProfile(profile);
  }

  /**
   * Set the player's chosen ideology.
   */
  async setIdeology(id: string, ideology: Ideology): Promise<void> {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.chosenIdeology = ideology;
    await this.saveProfile(profile);
  }

  /**
   * Increment the unlock path position.
   */
  async incrementPathPosition(id: string): Promise<void> {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.unlockPathPosition += 1;
    await this.saveProfile(profile);
  }

  /**
   * Validate that an object has the expected profile structure.
   */
  private isValidProfile(obj: unknown): obj is PlayerProfile {
    if (!obj || typeof obj !== 'object') return false;

    const profile = obj as Partial<PlayerProfile>;

    return (
      typeof profile.id === 'string' &&
      typeof profile.credits === 'number' &&
      Array.isArray(profile.unlockedCardIds) &&
      Array.isArray(profile.currentDeckIds) &&
      typeof profile.unlockPathPosition === 'number' &&
      (profile.chosenIdeology === null || typeof profile.chosenIdeology === 'string') &&
      typeof profile.loginStreak === 'object' &&
      profile.loginStreak !== null &&
      typeof profile.loginStreak.count === 'number' &&
      typeof profile.loginStreak.lastLoginDate === 'string' &&
      typeof profile.stats === 'object' &&
      profile.stats !== null &&
      typeof profile.stats.gamesPlayed === 'number' &&
      typeof profile.stats.wins === 'number' &&
      typeof profile.stats.losses === 'number' &&
      typeof profile.stats.perfectWins === 'number' &&
      typeof profile.createdAt === 'string' &&
      (profile.tutorialCompleted === undefined || typeof profile.tutorialCompleted === 'boolean')
    );
  }

  /**
   * Clear all stored data (for testing/debugging).
   */
  async clearAll(): Promise<void> {
    if (!this.isAvailable()) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}

/**
 * Default localStorage adapter instance.
 */
export const localStorageAdapter = new LocalStorageAdapter();
