/**
 * Player profile state management using Zustand.
 * 
 * Manages player progression, credits, deck building, and persistence.
 */

import { create } from 'zustand';
import type { CardId } from '@engine/types';
import type {
  PlayerProfile,
  Ideology,
  PlayerStats,
  StorageAdapter,
} from '@storage/types';
import { localStorageAdapter } from '@storage/localStorage';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_PLAYER_ID = 'local_player';
const MIN_DECK_SIZE = 12;
const MAX_DECK_SIZE = 24;

// Credit economy constants
const DAILY_LOGIN_BASE = 50;
const STREAK_MULTIPLIER_INCREMENT = 0.1;
const MAX_STREAK_MULTIPLIER = 2.0; // 10-day streak cap
const MAX_STREAK_DAYS = 10;

const CREDITS_WIN = 25;
const CREDITS_LOSS = 10;
const CREDITS_PERFECT_WIN = 50;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get today's date as an ISO date string (YYYY-MM-DD).
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Calculate the number of days between two ISO date strings.
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate unlock cost based on path position.
 * Cost escalates ~10% per unlock.
 */
export function getUnlockCost(position: number): number {
  return Math.floor(50 * Math.pow(1.1, position));
}

/**
 * Calculate streak multiplier.
 */
function getStreakMultiplier(streak: number): number {
  return Math.min(1 + streak * STREAK_MULTIPLIER_INCREMENT, MAX_STREAK_MULTIPLIER);
}

/**
 * Create a new player profile with default values.
 */
function createDefaultProfile(id: string, starterDeckIds: CardId[]): PlayerProfile {
  const now = new Date().toISOString();
  return {
    id,
    credits: 0,
    unlockedCardIds: [...starterDeckIds],
    currentDeckIds: [...starterDeckIds],
    unlockPathPosition: 0,
    chosenIdeology: null,
    loginStreak: {
      count: 0,
      lastLoginDate: '',
    },
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      perfectWins: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// Store Interface
// =============================================================================

interface PlayerStore {
  // State
  profile: PlayerProfile | null;
  isLoading: boolean;
  error: string | null;
  storage: StorageAdapter;
  
  /** Whether the player just earned enough to unlock a new card */
  canUnlockNewCard: boolean;
  /** Notification was shown and acknowledged */
  unlockNotificationDismissed: boolean;

  // Profile Management
  /**
   * Initialize the player store - loads or creates profile.
   * Should be called on app startup.
   */
  initialize: (starterDeckIds: CardId[]) => Promise<void>;

  /**
   * Reset the player profile (for testing/debugging).
   */
  resetProfile: (starterDeckIds: CardId[]) => Promise<void>;

  // Credit Management
  /**
   * Add credits to the player.
   */
  addCredits: (amount: number) => Promise<void>;

  /**
   * Spend credits (returns false if insufficient).
   */
  spendCredits: (amount: number) => Promise<boolean>;

  // Daily Login
  /**
   * Process daily login and return credits earned.
   * Returns { creditsEarned, newStreak, wasReset }.
   */
  processDailyLogin: () => Promise<{
    creditsEarned: number;
    newStreak: number;
    wasReset: boolean;
  }>;

  // Game Rewards
  /**
   * Award credits for a game result.
   */
  awardGameCredits: (won: boolean, isPerfectWin: boolean) => Promise<number>;

  /**
   * Update player stats after a game.
   */
  updateGameStats: (won: boolean, isPerfectWin: boolean) => Promise<void>;

  // Card Unlocking
  /**
   * Unlock the next card in the path.
   * Returns the unlocked card ID or null if can't afford.
   */
  unlockNextCard: (nextCardId: CardId) => Promise<CardId | null>;

  /**
   * Check if player can afford to unlock next card.
   */
  canAffordUnlock: () => boolean;

  /**
   * Get the cost to unlock the next card.
   */
  getNextUnlockCost: () => number;

  /**
   * Dismiss the unlock notification.
   */
  dismissUnlockNotification: () => void;

  /**
   * Check if should show unlock ready notification.
   */
  shouldShowUnlockNotification: () => boolean;

  // Ideology
  /**
   * Choose an ideology (can only be done once, after position 5).
   */
  chooseIdeology: (ideology: Ideology) => Promise<boolean>;

  /**
   * Check if player needs to choose an ideology.
   */
  needsIdeologyChoice: () => boolean;

  // Deck Building
  /**
   * Update the current deck.
   */
  updateDeck: (deckIds: CardId[]) => Promise<boolean>;

  /**
   * Add a card to the current deck.
   */
  addCardToDeck: (cardId: CardId) => Promise<boolean>;

  /**
   * Remove a card from the current deck.
   */
  removeCardFromDeck: (cardId: CardId) => Promise<boolean>;

  /**
   * Check if a card is unlocked.
   */
  isCardUnlocked: (cardId: CardId) => boolean;

  /**
   * Validate a deck composition.
   */
  isValidDeck: (deckIds: CardId[]) => { valid: boolean; reason?: string };
}

// =============================================================================
// Store Implementation
// =============================================================================

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  profile: null,
  isLoading: true,
  error: null,
  storage: localStorageAdapter,
  canUnlockNewCard: false,
  unlockNotificationDismissed: false,

  initialize: async (starterDeckIds: CardId[]) => {
    const { storage } = get();
    set({ isLoading: true, error: null });

    try {
      let profile = await storage.getProfile(DEFAULT_PLAYER_ID);

      if (!profile) {
        // Create new profile
        profile = createDefaultProfile(DEFAULT_PLAYER_ID, starterDeckIds);
        await storage.saveProfile(profile);
      }

      // Check if player can afford to unlock
      const unlockCost = getUnlockCost(profile.unlockPathPosition);
      const canAfford = profile.credits >= unlockCost;

      set({ 
        profile, 
        isLoading: false,
        canUnlockNewCard: canAfford,
        unlockNotificationDismissed: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load profile';
      set({ error: message, isLoading: false });
      console.error('[PlayerStore] Initialization failed:', error);
    }
  },

  resetProfile: async (starterDeckIds: CardId[]) => {
    const { storage } = get();
    set({ isLoading: true, error: null });

    try {
      const profile = createDefaultProfile(DEFAULT_PLAYER_ID, starterDeckIds);
      await storage.saveProfile(profile);
      set({ 
        profile, 
        isLoading: false,
        canUnlockNewCard: false,
        unlockNotificationDismissed: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset profile';
      set({ error: message, isLoading: false });
    }
  },

  addCredits: async (amount: number) => {
    const { profile, storage, getNextUnlockCost } = get();
    if (!profile) return;

    const oldCredits = profile.credits;
    const newCredits = profile.credits + amount;
    const unlockCost = getNextUnlockCost();
    
    // Check if player just crossed the unlock threshold
    const couldAffordBefore = oldCredits >= unlockCost;
    const canAffordNow = newCredits >= unlockCost;
    const justCrossedThreshold = !couldAffordBefore && canAffordNow;

    const updatedProfile = { ...profile, credits: newCredits };
    
    set({ 
      profile: updatedProfile,
      canUnlockNewCard: canAffordNow,
      // Only reset dismissed state if we just crossed the threshold
      unlockNotificationDismissed: justCrossedThreshold ? false : get().unlockNotificationDismissed,
    });
    await storage.saveProfile(updatedProfile);
  },

  spendCredits: async (amount: number) => {
    const { profile, storage } = get();
    if (!profile || profile.credits < amount) return false;

    const newCredits = profile.credits - amount;
    const updatedProfile = { ...profile, credits: newCredits };
    
    set({ profile: updatedProfile });
    await storage.saveProfile(updatedProfile);
    return true;
  },

  processDailyLogin: async () => {
    const { profile, storage } = get();
    if (!profile) {
      return { creditsEarned: 0, newStreak: 0, wasReset: false };
    }

    const today = getTodayDateString();
    const lastLogin = profile.loginStreak.lastLoginDate;

    // Already logged in today
    if (lastLogin === today) {
      return {
        creditsEarned: 0,
        newStreak: profile.loginStreak.count,
        wasReset: false,
      };
    }

    let newStreak: number;
    let wasReset = false;

    if (!lastLogin) {
      // First login ever
      newStreak = 1;
    } else {
      const daysSince = daysBetween(lastLogin, today);

      if (daysSince === 1) {
        // Consecutive day - increase streak
        newStreak = Math.min(profile.loginStreak.count + 1, MAX_STREAK_DAYS);
      } else {
        // Missed day(s) - partial reset (go back 2)
        newStreak = Math.max(0, profile.loginStreak.count - 2);
        wasReset = true;
      }
    }

    const multiplier = getStreakMultiplier(newStreak);
    const creditsEarned = Math.floor(DAILY_LOGIN_BASE * multiplier);

    const updatedProfile: PlayerProfile = {
      ...profile,
      credits: profile.credits + creditsEarned,
      loginStreak: {
        count: newStreak,
        lastLoginDate: today,
      },
    };

    set({ profile: updatedProfile });
    await storage.saveProfile(updatedProfile);

    return { creditsEarned, newStreak, wasReset };
  },

  awardGameCredits: async (won: boolean, isPerfectWin: boolean) => {
    const { addCredits } = get();
    
    let credits: number;
    if (isPerfectWin) {
      credits = CREDITS_PERFECT_WIN;
    } else if (won) {
      credits = CREDITS_WIN;
    } else {
      credits = CREDITS_LOSS;
    }

    await addCredits(credits);
    return credits;
  },

  updateGameStats: async (won: boolean, isPerfectWin: boolean) => {
    const { profile, storage } = get();
    if (!profile) return;

    const stats: PlayerStats = {
      gamesPlayed: profile.stats.gamesPlayed + 1,
      wins: profile.stats.wins + (won ? 1 : 0),
      losses: profile.stats.losses + (won ? 0 : 1),
      perfectWins: profile.stats.perfectWins + (isPerfectWin ? 1 : 0),
    };

    const updatedProfile = { ...profile, stats };
    set({ profile: updatedProfile });
    await storage.saveProfile(updatedProfile);
  },

  unlockNextCard: async (nextCardId: CardId) => {
    const { profile, storage, canAffordUnlock, getNextUnlockCost } = get();
    if (!profile) return null;

    if (!canAffordUnlock()) return null;

    const cost = getNextUnlockCost();
    const newCredits = profile.credits - cost;
    const newPosition = profile.unlockPathPosition + 1;
    
    // Calculate if player can afford the NEXT unlock after this one
    const nextCost = getUnlockCost(newPosition);
    const canAffordNextUnlock = newCredits >= nextCost;

    const updatedProfile: PlayerProfile = {
      ...profile,
      credits: newCredits,
      unlockedCardIds: [...profile.unlockedCardIds, nextCardId],
      unlockPathPosition: newPosition,
    };

    set({ 
      profile: updatedProfile,
      canUnlockNewCard: canAffordNextUnlock,
      unlockNotificationDismissed: true, // Reset dismissed since they just unlocked
    });
    await storage.saveProfile(updatedProfile);
    return nextCardId;
  },

  canAffordUnlock: () => {
    const { profile, getNextUnlockCost } = get();
    if (!profile) return false;
    return profile.credits >= getNextUnlockCost();
  },

  getNextUnlockCost: () => {
    const { profile } = get();
    if (!profile) return getUnlockCost(0);
    return getUnlockCost(profile.unlockPathPosition);
  },

  dismissUnlockNotification: () => {
    set({ unlockNotificationDismissed: true });
  },

  shouldShowUnlockNotification: () => {
    const { canUnlockNewCard, unlockNotificationDismissed } = get();
    return canUnlockNewCard && !unlockNotificationDismissed;
  },

  chooseIdeology: async (ideology: Ideology) => {
    const { profile, storage, needsIdeologyChoice } = get();
    if (!profile) return false;
    if (!needsIdeologyChoice()) return false;

    const updatedProfile: PlayerProfile = {
      ...profile,
      chosenIdeology: ideology,
    };

    set({ profile: updatedProfile });
    await storage.saveProfile(updatedProfile);
    return true;
  },

  needsIdeologyChoice: () => {
    const { profile } = get();
    if (!profile) return false;
    // Can choose ideology after unlocking 5 cards
    return profile.unlockPathPosition >= 5 && profile.chosenIdeology === null;
  },

  updateDeck: async (deckIds: CardId[]) => {
    const { profile, storage, isValidDeck } = get();
    if (!profile) return false;

    const validation = isValidDeck(deckIds);
    if (!validation.valid) {
      console.warn('[PlayerStore] Invalid deck:', validation.reason);
      return false;
    }

    const updatedProfile = { ...profile, currentDeckIds: deckIds };
    set({ profile: updatedProfile });
    await storage.saveProfile(updatedProfile);
    return true;
  },

  addCardToDeck: async (cardId: CardId) => {
    const { profile, updateDeck, isCardUnlocked } = get();
    if (!profile) return false;

    if (!isCardUnlocked(cardId)) return false;
    if (profile.currentDeckIds.length >= MAX_DECK_SIZE) return false;
    if (profile.currentDeckIds.includes(cardId)) return false; // No duplicates

    return updateDeck([...profile.currentDeckIds, cardId]);
  },

  removeCardFromDeck: async (cardId: CardId) => {
    const { profile, updateDeck } = get();
    if (!profile) return false;

    const newDeck = profile.currentDeckIds.filter(id => id !== cardId);
    if (newDeck.length < MIN_DECK_SIZE) return false;

    return updateDeck(newDeck);
  },

  isCardUnlocked: (cardId: CardId) => {
    const { profile } = get();
    if (!profile) return false;
    return profile.unlockedCardIds.includes(cardId);
  },

  isValidDeck: (deckIds: CardId[]) => {
    const { profile } = get();
    if (!profile) return { valid: false, reason: 'No profile loaded' };

    if (deckIds.length < MIN_DECK_SIZE) {
      return { valid: false, reason: `Deck must have at least ${MIN_DECK_SIZE} cards` };
    }

    if (deckIds.length > MAX_DECK_SIZE) {
      return { valid: false, reason: `Deck cannot have more than ${MAX_DECK_SIZE} cards` };
    }

    // Check for duplicates
    const uniqueIds = new Set(deckIds);
    if (uniqueIds.size !== deckIds.length) {
      return { valid: false, reason: 'Deck cannot contain duplicate cards' };
    }

    // Check all cards are unlocked
    for (const cardId of deckIds) {
      if (!profile.unlockedCardIds.includes(cardId)) {
        return { valid: false, reason: `Card ${cardId} is not unlocked` };
      }
    }

    return { valid: true };
  },
}));

// =============================================================================
// Debug Console Helpers
// =============================================================================

if (typeof window !== 'undefined') {
  const playerDebug = {
    /** Get current profile */
    getProfile: () => usePlayerStore.getState().profile,
    /** Add credits */
    addCredits: (amount: number) => usePlayerStore.getState().addCredits(amount),
    /** Process daily login */
    dailyLogin: () => usePlayerStore.getState().processDailyLogin(),
    /** Reset profile */
    reset: (starterDeckIds: CardId[]) => usePlayerStore.getState().resetProfile(starterDeckIds),
    /** Get unlock cost for position */
    getUnlockCost,
    /** Show help */
    help: () => {
      console.log(`
Player Debug Commands:
  playerDebug.getProfile()      - Get current profile
  playerDebug.addCredits(100)   - Add 100 credits
  playerDebug.dailyLogin()      - Process daily login
  playerDebug.reset(deckIds)    - Reset profile with starter deck
  playerDebug.getUnlockCost(5)  - Get cost at position 5
      `);
    },
  };

  (window as unknown as { playerDebug: typeof playerDebug }).playerDebug = playerDebug;
}
