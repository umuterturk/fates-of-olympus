/**
 * Asset path utilities
 * Centralizes image path generation for easy format changes
 */

// Card image format - change this to switch between png/jpg
const CARD_IMAGE_FORMAT = 'jpg';

/**
 * Get the full path to a card image
 */
export function getCardImagePath(cardId: string): string {
  return `${import.meta.env.BASE_URL}cards/${cardId}.${CARD_IMAGE_FORMAT}`;
}

/**
 * Get the full path to a background image
 */
export function getBackgroundImagePath(name: string): string {
  return `${import.meta.env.BASE_URL}backgrounds/${name}`;
}

/**
 * Get the full path to a location image
 */
export function getLocationImagePath(name: string): string {
  return `${import.meta.env.BASE_URL}locations/${name}`;
}
