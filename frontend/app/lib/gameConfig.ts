// Game configuration and constants

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export const MAX_PLAYERS = 10;

// Default level configuration
export const DEFAULT_LEVEL = {
  maxPookies: MAX_PLAYERS,
  width: 100,
  height: 100,
  speechDistance: 15,
  walkSpeedPerSecond: 8,
  backgroundImage: {
    url: "/Map.png",
    scale: 0.1, // 10 pixels = 1 unit
  },
  itemTypes: {},
  facilities: {
    mine: {
      x: 50,
      y: 8,
      displayName: "Mine",
      interactionPrompt: "Enter the mine to gather resources",
      interactionName: "mine",
      variables: {},
    },
    "general-shop": {
      x: 52,
      y: 32,
      displayName: "General Shop",
      interactionPrompt: "Buy and sell items at the general shop",
      interactionName: "trade",
      variables: {},
    },
    "community-furnace": {
      x: 38,
      y: 35,
      displayName: "Community Furnace",
      interactionPrompt: "Smelt ores and craft items",
      interactionName: "smelt",
      variables: {},
    },
    "market-stalls": {
      x: 78,
      y: 35,
      displayName: "Market Stalls",
      interactionPrompt: "Trade with other villagers",
      interactionName: "market",
      variables: {},
    },
    farm: {
      x: 55,
      y: 75,
      displayName: "Farm",
      interactionPrompt: "Grow and harvest crops",
      interactionName: "farm",
      variables: {},
    },
    forest: {
      x: 15,
      y: 35,
      displayName: "Forest",
      interactionPrompt: "Gather wood and forage for items",
      interactionName: "forage",
      variables: {},
    },
    river: {
      x: 90,
      y: 50,
      displayName: "River",
      interactionPrompt: "Fish or collect water",
      interactionName: "fish",
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
