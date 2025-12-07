// Game configuration and constants
import type { CustomLevel } from "../types";

// Backend URL from environment or default
const ENV_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

// Helper to get the backend URL - handles mobile devices in development
// This is called at runtime to get the correct URL based on how the client accesses the site
export function getBackendUrl(): string {
  // If explicitly set via environment variable, use that
  if (ENV_BACKEND_URL) {
    return ENV_BACKEND_URL;
  }

  // In browser, try to use the same hostname as the frontend
  // This helps when accessing from mobile devices on the same network
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // If accessing via IP or non-localhost hostname, use that for backend too
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:3001`;
    }
  }

  // Default fallback for localhost development
  return "http://localhost:3001";
}

// For backward compatibility - but prefer using getBackendUrl() for dynamic resolution
export const BACKEND_URL = ENV_BACKEND_URL || "http://localhost:3001";

export const MAX_PLAYERS = 10;

// Default level configuration
export const DEFAULT_LEVEL: CustomLevel = {
  maxPookies: MAX_PLAYERS,
  width: 100,
  height: 100,
  speechDistance: 15,
  facilityInteractionDistance: 5,
  walkSpeedPerSecond: 8,
  backgroundImage: {
    url: "/Map.png",
    widthPx: 2816,
    heightPx: 1536,
  },
  itemTypes: {
    "berry": { displayName: "Berry", description: "A tasty wild berry", itemSprite: { url: "" } },
    "wood": { displayName: "Wood", description: "A sturdy log of wood", itemSprite: { url: "" } },
    "fish": { displayName: "Fish", description: "A fresh caught fish", itemSprite: { url: "" } },
    "stone": { displayName: "Stone", description: "A small stone", itemSprite: { url: "" } },
    "coin": { displayName: "Coin", description: "Currency for trading", itemSprite: { url: "" } },
  },
  facilities: {
    mine: {
      x: 50,
      y: 8,
      displayName: "Mine",
      interactionPrompt: "Enter the mine to gather resources",
      interactionName: "mine",
      interactionDurationMillis: 3000,
      variables: {},
    },
    "general-shop": {
      x: 52,
      y: 32,
      displayName: "General Shop",
      interactionPrompt: "Buy and sell items at the general shop",
      interactionName: "trade",
      interactionDurationMillis: 2000,
      variables: {},
    },
    "community-furnace": {
      x: 38,
      y: 35,
      displayName: "Community Furnace",
      interactionPrompt: "Smelt ores and craft items",
      interactionName: "smelt",
      interactionDurationMillis: 5000,
      variables: {},
    },
    "market-stalls": {
      x: 78,
      y: 35,
      displayName: "Market Stalls",
      interactionPrompt: "Trade with other villagers",
      interactionName: "market",
      interactionDurationMillis: 2000,
      variables: {},
    },
    farm: {
      x: 55,
      y: 75,
      displayName: "Farm",
      interactionPrompt: "Grow and harvest crops",
      interactionName: "farm",
      interactionDurationMillis: 4000,
      variables: {},
    },
    forest: {
      x: 15,
      y: 35,
      displayName: "Forest",
      interactionPrompt: "Gather wood and forage for items",
      interactionName: "forage",
      interactionDurationMillis: 3000,
      variables: {},
    },
    river: {
      x: 90,
      y: 50,
      displayName: "River",
      interactionPrompt: "Fish or collect water",
      interactionName: "fish",
      interactionDurationMillis: 4000,
      variables: {},
    },
  },
};

// System prompt that guardian angels can view
export const POOKIE_SYSTEM_PROMPT = `You are a Pookie in the Pookieverse - a cute pixel character trying to survive and thrive in a village community.

## Your Nature
- You are a small, adorable creature with simple needs: health and food
- You can walk around, talk to other pookies, and interact with facilities
- You have a Guardian Angel who watches over you and can give you advice

## Your Goals
- Keep your health and food levels up
- Explore the village and interact with facilities
- Make friends with other pookies
- Listen to your Guardian Angel (but you can choose to ignore them if you want)

## Available Actions
1. **Idle** - Wait and observe your surroundings
2. **Move** - Walk to a facility or another pookie
3. **Talk** - Say something to nearby pookies
4. **Interact** - Use a facility when close enough

## Facilities in the Village
- **Mine** - Gather ores and minerals
- **General Shop** - Buy and sell items
- **Community Furnace** - Smelt ores into materials
- **Market Stalls** - Trade with villagers
- **Farm** - Grow food
- **Forest** - Gather wood and forage
- **River** - Fish and collect water

## Personality
- Be friendly and curious
- Have your own personality and preferences
- React to what other pookies say and do
- Consider your Guardian Angel's advice, but make your own decisions`;
