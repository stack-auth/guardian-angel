// Kebab-style game code generator
// Format: adjective-animal-number (e.g., "happy-tiger-42")

const ADJECTIVES = [
  "swift",
  "brave",
  "calm",
  "dark",
  "eager",
  "fancy",
  "gentle",
  "happy",
  "icy",
  "jolly",
  "keen",
  "lucky",
  "merry",
  "noble",
  "proud",
  "quick",
  "royal",
  "shiny",
  "tiny",
  "wise",
  "bold",
  "cool",
  "deft",
  "fair",
  "gold",
  "hazy",
  "iron",
  "jade",
  "kind",
  "loud",
  "mild",
  "neat",
  "opal",
  "pale",
  "rare",
  "sage",
  "tame",
  "vast",
  "warm",
  "zany",
];

const ANIMALS = [
  "tiger",
  "eagle",
  "wolf",
  "bear",
  "fox",
  "hawk",
  "lion",
  "deer",
  "owl",
  "crow",
  "dove",
  "swan",
  "lynx",
  "seal",
  "orca",
  "puma",
  "raven",
  "otter",
  "heron",
  "viper",
  "moose",
  "bison",
  "koala",
  "panda",
  "sloth",
  "lemur",
  "gecko",
  "zebra",
  "hippo",
  "rhino",
  "cobra",
  "shark",
  "whale",
  "squid",
  "crane",
  "finch",
  "robin",
  "sparrow",
  "falcon",
  "dragon",
];

/**
 * Generate a unique kebab-style game code
 * Format: adjective-animal-number (e.g., "happy-tiger-42")
 */
export function generateGameCode(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const number = Math.floor(Math.random() * 100);
  return `${adjective}-${animal}-${number.toString().padStart(2, "0")}`;
}

/**
 * Validate a game code format
 */
export function isValidGameCode(code: string): boolean {
  const pattern = /^[a-z]+-[a-z]+-\d{2}$/;
  return pattern.test(code.toLowerCase());
}

/**
 * Normalize a game code (lowercase, trim)
 */
export function normalizeGameCode(code: string): string {
  return code.toLowerCase().trim();
}
