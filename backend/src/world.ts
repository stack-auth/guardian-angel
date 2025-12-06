// Note: All x, y, width, height values are in units and can be fractional (use backgroundImage.scale to convert to display pixels).

import { distance, randomElement, runAsynchronously } from "./util.js";
import { askPookie, type PookieResponse } from "./gemini.js";

type WorldState = {
  level: CustomLevel,
  startTimestampMillis: number,
  pookies: {
    [pookieName: string]: Pookie,
  },
}

type Pookie = {
  personality: string,
  currentAction: PookieAction,
  inventory: PookieInventoryItem[],
  thoughts: PookieThought[],
  health: number,
  food: number,
}

type CustomLevel = {
  maxPlayers: number,
  width: number,
  height: number,
  /** The distance in units at which pookies can hear each other's speech. */
  speechDistance: number,
  walkSpeedPerSecond: number,
  backgroundImage: {
    url: string,
    /** 1.0 means 1 pixel is 1 unit, 0.5 means 2 pixels are 1 unit, 10.0 means 1 pixel is 10 units, etc. Usually < 1.0 */
    scale: number,
  },
  itemTypes: {
    [itemTypeId: string]: {
      displayName: string,
      description: string,
      itemSprite: {
        url: string,
      },
    }
  },
  facilities: {
    [facilityId: string]: {
      x: number,
      y: number,
      displayName: string,
      interactionPrompt: string,
      interactionName: string,
      variables: Record<string, string | number | boolean>,
    }
  },
};

type PookieThought = (
  | {
    source: "self",
    text: string,
    spokenLoudly: boolean,
    timestampMillis: number,
  }
  | {
    source: "guardian-angel",
    text: string,
    timestampMillis: number,
  }
  | {
    source: "facility",
    text: string,
    timestampMillis: number,
  }
  | {
    source: "self-action-change",
    text: string,
    timestampMillis: number,
  }
  | {
    source: "someone-else-said",
    sayerPookieName: string,
    text: string,
    timestampMillis: number,
  }
);

type PookieAction = (
  | {
    // The pookie is not moving and at x, y.
    type: "idle",
    x: number,
    y: number,
    sinceTimestampMillis: number,
    minIdleDurationMillis: number,
  }
  | {
    // The pookie is not moving and at x, y. It is currently thinking about something.
    type: "thinking",
    x: number,
    y: number,
    thinkingIndex: number,
    sinceTimestampMillis: number,
  }
  | {
    // If current time is before startTimestampMillis, the pookie is not moving and at startX, startY.
    // If current time is after endTimestampMillis, the pookie is at endX, endY.
    // If current time is between startTimestampMillis and endTimestampMillis, the pookie is linearly interpolated between them. The moving animation should play.
    type: "move",
    startX: number,
    startY: number,
    startTimestampMillis: number,
    endX: number,
    endY: number,
    endTimestampMillis: number,
  }
  | {
    type: "interact-with-facility",
    x: number,
    y: number,
    facilityId: string,
    interactionName: string,
    interactionId: string,
  }
  | {
    type: "dead",
    x: number,
    y: number,
    timestampMillis: number,
    sinceTimestampMillis: number,
    untilTimestampMillis: number,
  }
);

type PookieInventoryItem = {
  id: string,
  amount: number,
}


const POOKIE_NAMES = [
  'Pookieboo',
  'Snugbug',
  'Wobbles',
  'Nibble',
  'Pawpaw',
  'Boo',
  'Glimmy',
  'Momo',
  'Toodle',
  'Pipspeak',
  'Mochi',
  'Wafflebean',
  'Nuggie',
  'Jellybun',
  'Puddington',
];

function generatePookiePersonality(): string {
  const adjectives = [
    "friendly",
    "curious",
    "shy",
    "brave",
    "smart",
    "funny",
    "silly",
    "talkative",
    "lazy",
    "quiet",
  ];
  const goals = [
    "to find a friend",
    "to make a lot of money",
    "to have as much food as possible",
    "to fall in love",
    "to get revenge on a bully",
    "to save the world from a disaster",
    "to be mean to other pookies for no reason (you use insults such as 'pestlepuff' or 'stinkybun')",
  ];

  return `You are a ${randomElement(adjectives)} and ${randomElement(adjectives)} pookie who wants ${randomElement(goals)}.`;
}


export type { WorldState, CustomLevel, Pookie, PookieThought, PookieAction, PookieInventoryItem };

export class World {
  /** Note: Do not change this directly. Instead, use _changeState() to change the world state. */
  private _worldStateDoNotUseDirectly: WorldState;
  private _worldStateChangeCallbacks: Map<string, (worldState: WorldState) => void>;
  private _tickInterval: NodeJS.Timeout;
  private _thinkingCounter: number = 0;

  constructor(levelState: CustomLevel) {
    this._worldStateDoNotUseDirectly = {
      level: levelState,
      startTimestampMillis: Date.now(),
      pookies: {},
    };
    this._worldStateChangeCallbacks = new Map();
    this._tickInterval = setInterval(() => this._tick(), 1000);
  }

  public getWorldState(): WorldState {
    return this._worldStateDoNotUseDirectly;
  }

  public onWorldStateChange(callback: (worldState: WorldState) => void): { unsubscribe: () => void } {
    const id = crypto.randomUUID();
    this._worldStateChangeCallbacks.set(id, callback);
    return {
      unsubscribe: () => {
        this._worldStateChangeCallbacks.delete(id);
      },
    };
  }

  private _notifyWorldStateChangeTimeout: NodeJS.Timeout | null = null;
  private _notifyWorldStateChange(): void {
    // debounce calls to this function with a 10ms timeout
    if (this._notifyWorldStateChangeTimeout) {
      clearTimeout(this._notifyWorldStateChangeTimeout);
    }
    this._notifyWorldStateChangeTimeout = setTimeout(() => {
      this._worldStateChangeCallbacks.forEach(callback => callback(this.getWorldState()));
    }, 10);
  }

  /**
   * Use this function to modify world state; you do so by calling it and modifying the returned world state object.
   * 
   * Example:
   * 
   * ```
   * this._changeState().pookies[pookieName].currentAction = { ... };
   */
  private _changeState(): WorldState {
    const worldState = this.getWorldState();
    const stringified = JSON.stringify(worldState);
    const parsed = JSON.parse(stringified);
    if (JSON.stringify(parsed) !== stringified) {
      console.error(worldState);
      throw new Error("JSON.stringify(JSON.parse(JSON.stringify(worldState))) !== JSON.stringify(worldState)!");
    }
    this._worldStateDoNotUseDirectly = parsed;
    this._notifyWorldStateChange();
    return this._worldStateDoNotUseDirectly;
  }

  public sendGuardianAngelMessage(pookieName: string, text: string): "pookie-not-found" | "success" {
    const pookie = this.getWorldState().pookies[pookieName];
    if (!pookie) {
      return "pookie-not-found";
    }
    this._changeState().pookies[pookieName].thoughts.push({
      source: 'guardian-angel',
      text,
      timestampMillis: Date.now(),
    });
    return "success";
  }

  public join(): { pookieName: string } | "max-players-reached" {
    if (Object.keys(this.getWorldState().pookies).length >= this.getWorldState().level.maxPlayers) {
      return "max-players-reached";
    }
    let pookieName = "";
    let i = 0;
    while (pookieName === "" || this.getWorldState().pookies[pookieName]) {
      pookieName = i++ > 100 ? crypto.randomUUID() : POOKIE_NAMES[Math.floor(Math.random() * POOKIE_NAMES.length)];
    }
    this._changeState().pookies[pookieName] = {
      personality: generatePookiePersonality(),
      currentAction: {
        type: 'idle',
        x: Math.random() * this.getWorldState().level.width,
        y: Math.random() * this.getWorldState().level.height,
        minIdleDurationMillis: 3000,
        sinceTimestampMillis: Date.now(),
      },
      inventory: [],
      thoughts: [],
      health: 100,
      food: 100,
    };
    return { pookieName };
  }

  private _calculatePookieLocation(pookie: Pookie, now: number): { x: number, y: number } {
    switch (pookie.currentAction.type) {
      case 'move':
        const t = (now - pookie.currentAction.startTimestampMillis) / (pookie.currentAction.endTimestampMillis - pookie.currentAction.startTimestampMillis);
        return { x: pookie.currentAction.startX + (pookie.currentAction.endX - pookie.currentAction.startX) * t, y: pookie.currentAction.startY + (pookie.currentAction.endY - pookie.currentAction.startY) * t };
      case 'thinking':
      case 'idle':
      case 'dead':
        return { x: pookie.currentAction.x, y: pookie.currentAction.y };
      default:
        throw new Error(`Unknown pookie action type: ${pookie.currentAction.type}`);
    }
  }

  private _tick(): void {
    const now = Date.now();

    // make pookies that are moving, but past their end timestamp, stop moving and be idling at their end x, y
    for (const [pookieName, pookie] of Object.entries(this.getWorldState().pookies)) {
      if (pookie.currentAction.type === 'move') {
        if (now > pookie.currentAction.endTimestampMillis) {
          this._changeState().pookies[pookieName].currentAction = {
            type: 'idle',
            x: pookie.currentAction.endX,
            y: pookie.currentAction.endY,
            sinceTimestampMillis: now,
            minIdleDurationMillis: 3000,
          };
        }
      }
    }

    // make pookies that are idle start an LLM chat to decide their next action
    for (const [pookieName, pookie] of Object.entries(this.getWorldState().pookies)) {
      if (pookie.currentAction.type === 'idle') {
        if (now > pookie.currentAction.sinceTimestampMillis + pookie.currentAction.minIdleDurationMillis) {
          const thisThinkingIndex = this._thinkingCounter++;
          this._changeState().pookies[pookieName].currentAction = {
            type: 'thinking',
            x: pookie.currentAction.x,
            y: pookie.currentAction.y,
            thinkingIndex: thisThinkingIndex,
            sinceTimestampMillis: now,
          };
          
          const thoughtToText = (thought: PookieThought) => {
            switch (thought.source) {
              case 'self':
                return `You ${thought.spokenLoudly ? "said" : "thought"}: "${thought.text}"`;
              case 'guardian-angel':
                return `Your guardian angel said: ${thought.text}`;
              case 'self-action-change':
                return `Action update: ${thought.text}`;
              case 'facility':
                return `Facility update: ${thought.text}`;
              case 'someone-else-said':
                return `${thought.sayerPookieName} said: "${thought.text}"`;
              default: {
                throw new Error(`Unknown thought source: ${thought}`);
              }
            }
          }
          const pookiesWithinSpeechDistance = new Set<string>();
          for (const [otherPookieName, otherPookie] of Object.entries(this.getWorldState().pookies)) {
            if (otherPookieName === pookieName) continue;
            const location = this._calculatePookieLocation(pookie, now);
            const otherPookie = this.getWorldState().pookies[otherPookieName];
            const otherLocation = this._calculatePookieLocation(otherPookie, now);
            const canHear = distance(location.x, location.y, otherLocation.x, otherLocation.y) <= this.getWorldState().level.speechDistance;
            if (canHear) {
              pookiesWithinSpeechDistance.add(otherPookieName);
            }
          } 
          const describeOtherPookie = (otherPookieName: string) => {
            const otherPookie = this.getWorldState().pookies[otherPookieName];
            const otherLocation = this._calculatePookieLocation(otherPookie, now);
            const isDead = otherPookie.currentAction.type === 'dead';
            const canHear = pookiesWithinSpeechDistance.has(otherPookieName);
            return `- ${otherPookieName} is at ${otherLocation.x}, ${otherLocation.y}. ${isDead ? "They are dead." : canHear ? "They can hear you if you say something." : "They are too far away from you to hear you right now."}`;
          }
          const prompt = `

            You are a pookie in the Pookieverse. Your name is ${pookieName}. ${pookie.personality}
            
            Health: ${pookie.health}/100. Food: ${pookie.food}/100.
            
            You are currently idle at ${pookie.currentAction.x}, ${pookie.currentAction.y}.
            
            You have the following inventory: ${pookie.inventory.map(item => `${item.amount}x ${item.id}`).join(', ')}.

            You have a guardian angel. It can see what happens around you and tries to be helpful. No one else can see or hear your guardian angel. Usually you should listen to your guardian angel, but if you feel like your guardian angel has been giving you bad advice, you can start ignoring it.

            Here are all the pookies in the Pookieverse:
            ${Object.keys(this.getWorldState().pookies).map(pookieName => `- ${describeOtherPookie(pookieName)}`).join("\n")}

            Here are all the facilities in the Pookieverse:
            ${Object.entries(this.getWorldState().level.facilities).map(([facilityId, facility]) => `- ${facility.displayName} (id: ${facilityId}) is at ${facility.x}, ${facility.y}. When interacting with it: "${facility.interactionPrompt}". Its variables are as follows: ${JSON.stringify(facility.variables)}`).join("\n")}

            You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in one of these formats:
            - {"type": "idle", "seconds": <number between 1-10>, "thought": "<short reasoning, max 1 sentence>"} - In this case, you will stay idle for a few seconds, and then think again. If a pookie or guardian angel talks to you during this time, you will be interrupted. This is great when you're waiting for something, like a response from another pookie.
            - {"type": "say", "message": "<short message, max 1 sentence>", "thought": "<short reasoning, max 1 sentence>"} - In this case, pookies near you will hear you and be able to interact with you. What you say should be relatively short, 1 sentence maximum
            - {"type": "move-to-facility", "facilityId": "<facility id>", "thought": "<short reasoning, max 1 sentence>"} - to move to a facility
            - {"type": "move-to-pookie", "pookieName": "<pookie name>", "thought": "<short reasoning, max 1 sentence>"} - You can move either to a different pookie or to a facility.
            
            Below is your memory:

            ${pookie.thoughts.map(thought => `- ${thoughtToText(thought)}`).join("\n")}

          `.trim().split("\n").map(line => line.trim()).join("\n");

          runAsynchronously(async () => {
            const now = Date.now();
            
            // Use Gemini to decide what the pookie should do
            const facilityIds = Object.keys(this.getWorldState().level.facilities);
            const otherPookieNames = Object.keys(this.getWorldState().pookies).filter(name => name !== pookieName);
            
            let chosenResponse: PookieResponse;
            try {
              chosenResponse = await askPookie(prompt, facilityIds, otherPookieNames);
              console.log(`Pookie ${pookieName} decided:`, chosenResponse);
            } catch (error) {
              console.error(`Error getting Gemini response for ${pookieName}:`, error);
              chosenResponse = { type: 'idle', seconds: 3 };
            }

            const newPookies = this.getWorldState().pookies;
            const pookie = newPookies[pookieName];
            // Make sure the pookie still exists (hasn't left the world)
            if (pookie) {
              // Make sure the pookie hasn't been interrupted and is thinking about the same thing
              if (
                pookie.currentAction.type === 'thinking' &&
                pookie.currentAction.thinkingIndex === thisThinkingIndex
              ) {
                switch (chosenResponse.type) {
                  case 'idle':
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'idle',
                      x: pookie.currentAction.x,
                      y: pookie.currentAction.y,
                      sinceTimestampMillis: now,
                      minIdleDurationMillis: chosenResponse.seconds * 1000,
                    };
                    break;
                  case 'move-to-facility':
                    const facility = this.getWorldState().level.facilities[chosenResponse.facilityId];
                    const dist = distance(pookie.currentAction.x, pookie.currentAction.y, facility.x, facility.y);
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'move',
                      startX: pookie.currentAction.x,
                      startY: pookie.currentAction.y,
                      startTimestampMillis: now + 1_000,  // Wait 1 second before starting to move so that laggy clients feel less laggy
                      endX: this.getWorldState().level.facilities[chosenResponse.facilityId].x,
                      endY: this.getWorldState().level.facilities[chosenResponse.facilityId].y,
                      endTimestampMillis: now + 1_000 + dist / this.getWorldState().level.walkSpeedPerSecond * 1000,
                    };
                    break;
                  case 'say':
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'self',
                      text: chosenResponse.message,
                      spokenLoudly: true,
                      timestampMillis: now,
                    });
                    for (const otherPookieName of pookiesWithinSpeechDistance) {
                      if (!(otherPookieName in newPookies) || newPookies[otherPookieName].currentAction.type === 'dead') {
                        // Pookie died or left in the meantime, skip them
                        continue;
                      }
                      this._changeState().pookies[otherPookieName].thoughts.push({
                        source: 'someone-else-said',
                        sayerPookieName: pookieName,
                        text: chosenResponse.message,
                        timestampMillis: now,
                      });
                      // interrupt the other pookie in whatever they're doing
                      this._changeState().pookies[otherPookieName].currentAction = {
                        type: 'idle',
                        x: this._calculatePookieLocation(newPookies[otherPookieName], now).x,
                        y: this._calculatePookieLocation(newPookies[otherPookieName], now).y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 500,
                      };
                    }
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'idle',
                      x: pookie.currentAction.x,
                      y: pookie.currentAction.y,
                      sinceTimestampMillis: now,
                      minIdleDurationMillis: 3_000,
                    };
                    break;
                  case 'move-to-pookie':
                    const targetPookie = this.getWorldState().pookies[chosenResponse.pookieName];
                    if (targetPookie) {
                      const targetLocation = this._calculatePookieLocation(targetPookie, now);
                      const distToPookie = distance(pookie.currentAction.x, pookie.currentAction.y, targetLocation.x, targetLocation.y);
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'move',
                        startX: pookie.currentAction.x,
                        startY: pookie.currentAction.y,
                        startTimestampMillis: now + 1_000,
                        endX: targetLocation.x,
                        endY: targetLocation.y,
                        endTimestampMillis: now + 1_000 + distToPookie / this.getWorldState().level.walkSpeedPerSecond * 1000,
                      };
                    } else {
                      // Target pookie no longer exists, just idle
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                    }
                    break;
                  default:
                    const _exhaustiveCheck: never = chosenResponse;
                    throw new Error(`Unknown response: ${JSON.stringify(_exhaustiveCheck)}`);
                }
              }
            }
          });
        }
      }
    }
  }
}
