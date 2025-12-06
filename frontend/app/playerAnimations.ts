/**
 * Player Animation Functions
 * Functions to control player character animations in pixel-art style
 */

export type AnimationState = "idle" | "moving" | "talking";

export interface PlayerAnimationState {
  animation: AnimationState;
  message?: string;
  facingDirection?: "left" | "right";
}

let currentAnimationState: PlayerAnimationState = {
  animation: "idle",
  facingDirection: "right",
};

let animationStateListeners: Set<(state: PlayerAnimationState) => void> =
  new Set();

/**
 * Subscribe to animation state changes
 */
export function subscribeToAnimationState(
  callback: (state: PlayerAnimationState) => void
): () => void {
  animationStateListeners.add(callback);
  // Immediately call with current state
  callback(currentAnimationState);

  // Return unsubscribe function
  return () => {
    animationStateListeners.delete(callback);
  };
}

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
  animationStateListeners.forEach((callback) => {
    callback(currentAnimationState);
  });
}

/**
 * Start moving animation
 * @param direction - Direction to face while moving ('left' or 'right')
 */
export function startMovingAnimation(
  direction: "left" | "right" = "right"
): void {
  currentAnimationState = {
    animation: "moving",
    facingDirection: direction,
  };
  notifyListeners();
}

/**
 * Remove all animations and return to idle state
 */
export function removeAnimation(): void {
  currentAnimationState = {
    animation: "idle",
    facingDirection: currentAnimationState.facingDirection || "right",
  };
  notifyListeners();
}

/**
 * Start talking animation with a message
 * @param message - The message to display in the thought bubble
 */
export function startTalkingAnimation(message: string): void {
  currentAnimationState = {
    animation: "talking",
    message,
    facingDirection: currentAnimationState.facingDirection || "right",
  };
  notifyListeners();

  // Auto-remove talking animation after message duration
  // Default to 3 seconds, but can be adjusted
  const messageDuration = Math.max(2000, message.length * 100);
  setTimeout(() => {
    if (currentAnimationState.animation === "talking") {
      removeAnimation();
    }
  }, messageDuration);
}

/**
 * Get current animation state
 */
export function getCurrentAnimationState(): PlayerAnimationState {
  return { ...currentAnimationState };
}
