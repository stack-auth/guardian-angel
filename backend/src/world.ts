// Note: All x, y, width, height values are in game units. Use backgroundImage.widthPx/heightPx for actual image dimensions.

import { distance, randomElement, randomPointWithinRadius, runAsynchronously } from "./util.js";
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
  maxPookies: number,
  worldPrompt: string,
  width: number,
  height: number,
  speechDistance: number,
  facilityInteractionDistance: number,
  walkSpeedPerSecond: number,
  backgroundImage: {
    url: string,
    /** Actual image width in pixels */
    widthPx: number,
    /** Actual image height in pixels */
    heightPx: number,
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
      interactionDurationMillis: number,
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
  | {
    source: "trade-offer-received",
    offerId: string,
    fromPookieName: string,
    itemsOffered: { itemId: string; amount: number }[],
    itemsRequested: { itemId: string; amount: number }[],
    timestampMillis: number,
  }
  | {
    source: "trade-completed",
    withPookieName: string,
    itemsGiven: { itemId: string; amount: number }[],
    itemsReceived: { itemId: string; amount: number }[],
    timestampMillis: number,
  }
  | {
    source: "trade-rejected",
    byPookieName: string,
    timestampMillis: number,
  }
  | {
    source: "got-hit",
    byPookieName: string,
    damage: number,
    timestampMillis: number,
  }
  | {
    source: "hit-someone",
    targetPookieName: string,
    damage: number,
    timestampMillis: number,
  }
);

type TradeOffer = {
  id: string,
  fromPookieName: string,
  toPookieName: string,
  itemsOffered: { itemId: string; amount: number }[],
  itemsRequested: { itemId: string; amount: number }[],
  timestampMillis: number,
};

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
    sinceTimestampMillis: number,
    untilTimestampMillis: number,
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
    "hilarious",
    "talkative",
    "lazy",
    "quiet",
    "greedy",
    "selfish",
    "arrogant",
    "liar",
    "honest",
  ];
  const goals = [
    "to find a friend",
    "to have as many items as possible in your inventory",
    "to have as much food as possible",
    "to fall in love",
    "to get revenge on a bully",
    "to make sure that there is no violence in the world",
    "to save the world from a disaster that you are 100% sure exists, and let everyone know about it.",
    "to be mean to other pookies for no reason (you use insults such as 'pestlepuff' or 'stinkybun')",
  ];

  return `You are a ${randomElement(adjectives)} and ${randomElement(adjectives)} pookie who wants ${randomElement(goals)}.`;
}


export type { WorldState, CustomLevel, Pookie, PookieThought, PookieAction, PookieInventoryItem, TradeOffer };

export class World {
  /** Note: Do not change this directly. Instead, use _changeState() to change the world state. */
  private _worldStateDoNotUseDirectly: WorldState;
  private _worldStateChangeCallbacks: Map<string, (worldState: WorldState) => void>;
  private _tickInterval: NodeJS.Timeout;
  private _thinkingCounter: number = 0;
  private _pendingTradeOffers: Map<string, TradeOffer> = new Map();

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
    const now = Date.now();
    
    // Add the guardian angel message to thoughts
    this._changeState().pookies[pookieName].thoughts.push({
      source: 'guardian-angel',
      text,
      timestampMillis: now,
    });
    
    // Interrupt whatever the pookie was doing by setting them to idle
    // This makes them immediately process the guardian angel's message on the next tick
    const currentLocation = this._calculatePookieLocation(pookie, now);
    this._changeState().pookies[pookieName].currentAction = {
      type: 'idle',
      x: currentLocation.x,
      y: currentLocation.y,
      sinceTimestampMillis: now,
      minIdleDurationMillis: 0, // No minimum idle time - respond immediately
    };
    
    return "success";
  }

  public join(): { pookieName: string } | "max-players-reached" {
    if (Object.keys(this.getWorldState().pookies).length >= this.getWorldState().level.maxPookies) {
      return "max-players-reached";
    }
    let pookieName = "";
    let i = 0;
    while (pookieName === "" || this.getWorldState().pookies[pookieName]) {
      pookieName = i++ > 100 ? crypto.randomUUID() : POOKIE_NAMES[Math.floor(Math.random() * POOKIE_NAMES.length)];
    }
    // Give the pookie 1 of every item type
    const startingInventory: PookieInventoryItem[] = Object.keys(this.getWorldState().level.itemTypes).map(itemId => ({
      id: itemId,
      amount: 1,
    }));
    
    this._changeState().pookies[pookieName] = {
      personality: generatePookiePersonality(),
      currentAction: {
        type: 'idle',
        x: Math.random() * this.getWorldState().level.width,
        y: Math.random() * this.getWorldState().level.height,
        minIdleDurationMillis: 3000,
        sinceTimestampMillis: Date.now(),
      },
      inventory: startingInventory,
      thoughts: [],
      health: 100,
      food: 100,
    };
    return { pookieName };
  }

  public getPendingTradeOffersForPookie(pookieName: string): TradeOffer[] {
    const now = Date.now();
    const offers: TradeOffer[] = [];
    for (const offer of this._pendingTradeOffers.values()) {
      // Only include offers that are less than 60 seconds old
      if (offer.toPookieName === pookieName && now - offer.timestampMillis < 60_000) {
        offers.push(offer);
      }
    }
    return offers;
  }

  private _hasEnoughItems(pookieName: string, items: { itemId: string; amount: number }[]): boolean {
    const pookie = this.getWorldState().pookies[pookieName];
    if (!pookie) return false;
    
    for (const item of items) {
      const inventoryItem = pookie.inventory.find(i => i.id === item.itemId);
      if (!inventoryItem || inventoryItem.amount < item.amount) {
        return false;
      }
    }
    return true;
  }

  private _removeItems(pookieName: string, items: { itemId: string; amount: number }[]): void {
    for (const item of items) {
      const inventoryItem = this._changeState().pookies[pookieName].inventory.find(i => i.id === item.itemId);
      if (inventoryItem) {
        inventoryItem.amount -= item.amount;
      }
    }
    // Remove items with 0 or negative amounts
    this._changeState().pookies[pookieName].inventory = this.getWorldState().pookies[pookieName].inventory.filter(i => i.amount > 0);
  }

  private _addItems(pookieName: string, items: { itemId: string; amount: number }[]): void {
    for (const item of items) {
      const inventoryItem = this._changeState().pookies[pookieName].inventory.find(i => i.id === item.itemId);
      if (inventoryItem) {
        inventoryItem.amount += item.amount;
      } else {
        this._changeState().pookies[pookieName].inventory.push({ id: item.itemId, amount: item.amount });
      }
    }
  }

  private _calculatePookieLocation(pookie: Pookie, now: number): { x: number, y: number } {
    switch (pookie.currentAction.type) {
      case 'move':
        const t = Math.min(1, Math.max(0, (now - pookie.currentAction.startTimestampMillis) / (pookie.currentAction.endTimestampMillis - pookie.currentAction.startTimestampMillis)));
        return { x: pookie.currentAction.startX + (pookie.currentAction.endX - pookie.currentAction.startX) * t, y: pookie.currentAction.startY + (pookie.currentAction.endY - pookie.currentAction.startY) * t };
      case 'thinking':
      case 'idle':
      case 'dead':
      case 'interact-with-facility':
        return { x: pookie.currentAction.x, y: pookie.currentAction.y };
      default:
        const _exhaustiveCheck: never = pookie.currentAction;
        throw new Error(`Unknown pookie action type: ${_exhaustiveCheck}`);
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

    // make pookies that are interacting with facilities, but past their end timestamp, complete the interaction and give them a random item
    for (const [pookieName, pookie] of Object.entries(this.getWorldState().pookies)) {
      if (pookie.currentAction.type === 'interact-with-facility') {
        if (now > pookie.currentAction.untilTimestampMillis) {
          const facility = this.getWorldState().level.facilities[pookie.currentAction.facilityId];
          
          // Give the pookie a random item from the level's item types
          const itemTypes = Object.keys(this.getWorldState().level.itemTypes);
          if (itemTypes.length > 0) {
            const randomItemId = randomElement(itemTypes);
            this._addItems(pookieName, [{ itemId: randomItemId, amount: 1 }]);
            
            this._changeState().pookies[pookieName].thoughts.push({
              source: 'facility',
              text: `You received 1x ${randomItemId} from ${facility.displayName}!`,
              timestampMillis: now,
            });
          }
          
          // Return to idle state
          this._changeState().pookies[pookieName].currentAction = {
            type: 'idle',
            x: pookie.currentAction.x,
            y: pookie.currentAction.y,
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
              case 'trade-offer-received':
                return `Trade offer (ID: ${thought.offerId}) from ${thought.fromPookieName}: They offer ${thought.itemsOffered.map(i => `${i.amount}x ${i.itemId}`).join(', ')} for your ${thought.itemsRequested.map(i => `${i.amount}x ${i.itemId}`).join(', ')}`;
              case 'trade-completed':
                return `Trade completed with ${thought.withPookieName}: You gave ${thought.itemsGiven.map(i => `${i.amount}x ${i.itemId}`).join(', ')} and received ${thought.itemsReceived.map(i => `${i.amount}x ${i.itemId}`).join(', ')}`;
              case 'trade-rejected':
                return `${thought.byPookieName} rejected your trade offer`;
              case 'got-hit':
                return `${thought.byPookieName} hit you for ${thought.damage} damage! Ouch!`;
              case 'hit-someone':
                return `You hit ${thought.targetPookieName} for ${thought.damage} damage!`;
              default: {
                const _exhaustiveCheck: never = thought;
                throw new Error(`Unknown thought source: ${_exhaustiveCheck}`);
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
            return `- ${otherPookieName} is at ${otherLocation.x.toFixed(1)}, ${otherLocation.y.toFixed(1)}. ${isDead ? "They are dead." : canHear ? "They can hear you if you say something, and you can trade with them." : "They are too far away from you to hear you or trade right now."}`;
          }
          
          // Get pending trade offers for this pookie
          const pendingOffers = this.getPendingTradeOffersForPookie(pookieName);
          const pendingOffersText = pendingOffers.length === 0 
            ? "You have no pending trade offers."
            : `You have the following pending trade offers:\n${pendingOffers.map(offer => 
                `- Offer ID "${offer.id}" from ${offer.fromPookieName}: They offer ${offer.itemsOffered.map(i => `${i.amount}x ${i.itemId}`).join(', ')} for your ${offer.itemsRequested.map(i => `${i.amount}x ${i.itemId}`).join(', ')}`
              ).join('\n')}`;
          
          const prompt = `

            You are a pookie in the Pookieverse. Your name is ${pookieName}. ${pookie.personality}

            ${this.getWorldState().level.worldPrompt}
            
            Health: ${pookie.health}/100. Food: ${pookie.food}/100.
            
            You are currently idle at ${pookie.currentAction.x}, ${pookie.currentAction.y}.
            
            You have the following inventory: ${pookie.inventory.map(item => `${item.amount}x ${item.id}`).join(', ')}.

            You have a guardian angel. It can see what happens around you and tries to be helpful. No one else can see or hear your guardian angel. Usually you should listen to your guardian angel, but if you feel like your guardian angel has been giving you bad advice, you can start ignoring it. It will be clear when your guardian angel is talking to you; don't hallucinate it.

            Here are all the pookies in the Pookieverse:
            ${Object.keys(this.getWorldState().pookies).map(pookieName => `- ${describeOtherPookie(pookieName)}`).join("\n")}

            Here are all the facilities in the Pookieverse:
            ${Object.entries(this.getWorldState().level.facilities).map(([facilityId, facility]) => {
              const pookieLocation = this._calculatePookieLocation(pookie, now);
              const distToFacility = distance(pookieLocation.x, pookieLocation.y, facility.x, facility.y);
              const facilityInteractionDist = this.getWorldState().level.facilityInteractionDistance;
              const canInteract = distToFacility <= facilityInteractionDist;
              return `- ${facility.displayName} (id: ${facilityId}) is at ${facility.x.toFixed(1)}, ${facility.y.toFixed(1)} (${distToFacility.toFixed(1)} units away). ${canInteract ? "✓ You can interact with it now!" : "Too far - move closer first."} Interaction: "${facility.interactionPrompt}"`;
            }).join("\n")}

            ${pendingOffersText}

            You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in one of these formats:
            - {"type": "idle", "seconds": <number between 5-20>, "thought": "<short reasoning, max 1 sentence>"} - In this case, you will stay idle for a few seconds, and then think again. If a pookie or guardian angel talks to you during this time, you will be interrupted. This is great when you're waiting for something, like a response from another pookie. You almost never want to just randomly idle. Instead, it's better to walk around or talk to other pookies.
            - {"type": "say", "message": "<short message, max 1 sentence>", "thought": "<short reasoning, max 1 sentence>"} - In this case, pookies near you will hear you and be able to interact with you. What you say should be relatively short, 1 sentence maximum
            - {"type": "move-to-facility", "facilityId": "<facility id>", "thought": "<short reasoning, max 1 sentence>"} - to move to a facility
            - {"type": "move-to-pookie", "pookieName": "<pookie name>", "thought": "<short reasoning, max 1 sentence>"} - You can move either to a different pookie or to a facility.
            - {"type": "interact-with-facility", "facilityId": "<facility id>", "thought": "<short reasoning, max 1 sentence>"} - Interact with a nearby facility. You must be within facilityInteractionDistance of the facility. After interacting, you will receive a random item!
            - {"type": "hit-pookie", "targetPookieName": "<pookie name>", "thought": "<short reasoning, max 1 sentence>"} - Hit another pookie within speech distance! They will take damage. Only do this if you have a very good reason (they insulted you, stole from you, or you're just feeling mean).
            - {"type": "offer-trade", "targetPookieName": "<pookie name>", "itemsOffered": [{"itemId": "<item>", "amount": <num>}], "itemsRequested": [{"itemId": "<item>", "amount": <num>}], "thought": "<reasoning>"} - Offer a trade to a pookie within speech distance. You must have the items you're offering.
            - {"type": "accept-offer", "offerId": "<offer id>", "thought": "<reasoning>"} - Accept a pending trade offer. You must have the items requested.
            - {"type": "reject-offer", "offerId": "<offer id>", "thought": "<reasoning>"} - Reject a pending trade offer.

            IMPORTANT: If you are close enough to a facility (marked with ✓), you should strongly consider using "interact-with-facility" to interact with it and get a free item! Moving around and interacting with facilities is very valuable. If there are many Pookies nearby, you might want to walk somewhere else (you don't like crowds). However, if someone actively talks to you, you should respond.

            If you have previously thought or said something already, don't repeat yourself. Say something new, or try something different.
            
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
              chosenResponse = { type: 'idle', seconds: 3, thought: "Guess I thought something that didn't make sense. Pookieverse glitch!" };
            }

            this._changeState().pookies[pookieName].thoughts.push({
              source: 'self',
              text: chosenResponse.thought,
              spokenLoudly: false,
              timestampMillis: now,
            });

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
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'self-action-change',
                      text: `Idling for ${chosenResponse.seconds} seconds.`,
                      timestampMillis: now,
                    });
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'idle',
                      x: pookie.currentAction.x,
                      y: pookie.currentAction.y,
                      sinceTimestampMillis: now,
                      minIdleDurationMillis: chosenResponse.seconds * 1000,
                    };
                    break;
                  case 'move-to-facility': {
                    const facility = this.getWorldState().level.facilities[chosenResponse.facilityId];
                    const facilityInteractionDist = this.getWorldState().level.facilityInteractionDistance;
                    const targetFacilityPoint = randomPointWithinRadius(facility.x, facility.y, facilityInteractionDist);
                    const distToFacility = distance(pookie.currentAction.x, pookie.currentAction.y, targetFacilityPoint.x, targetFacilityPoint.y);
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'self-action-change',
                      text: `Moving towards facility ${facility.displayName}`,
                      timestampMillis: now,
                    });
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'move',
                      startX: pookie.currentAction.x,
                      startY: pookie.currentAction.y,
                      startTimestampMillis: now + 1_000,  // Wait 1 second before starting to move so that laggy clients feel less laggy
                      endX: targetFacilityPoint.x,
                      endY: targetFacilityPoint.y,
                      endTimestampMillis: now + 1_000 + distToFacility / this.getWorldState().level.walkSpeedPerSecond * 1000,
                    };
                    break;
                  }
                  
                  case 'interact-with-facility': {
                    const facility = this.getWorldState().level.facilities[chosenResponse.facilityId];
                    const facilityInteractionDist = this.getWorldState().level.facilityInteractionDistance;
                    const distToFacility = distance(pookie.currentAction.x, pookie.currentAction.y, facility.x, facility.y);
                    
                    // Check if pookie is within interaction distance
                    if (distToFacility > facilityInteractionDist) {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't interact with ${facility.displayName} - too far away. Need to move closer first.`,
                        timestampMillis: now,
                      });
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'self-action-change',
                      text: `Interacting with ${facility.displayName}...`,
                      timestampMillis: now,
                    });
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'interact-with-facility',
                      x: pookie.currentAction.x,
                      y: pookie.currentAction.y,
                      facilityId: chosenResponse.facilityId,
                      interactionName: facility.interactionName,
                      sinceTimestampMillis: now,
                      untilTimestampMillis: now + facility.interactionDurationMillis,
                    };
                    break;
                  }
                  
                  case 'hit-pookie': {
                    const targetPookieName = chosenResponse.targetPookieName;
                    
                    // Check if target pookie is within speech distance
                    if (!pookiesWithinSpeechDistance.has(targetPookieName)) {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't hit ${targetPookieName} - they're too far away.`,
                        timestampMillis: now,
                      });
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    const targetPookieObj = this.getWorldState().pookies[targetPookieName];
                    if (!targetPookieObj || targetPookieObj.currentAction.type === 'dead') {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't hit ${targetPookieName} - they're already dead or gone.`,
                        timestampMillis: now,
                      });
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    // Deal random damage between 25-50
                    const damage = Math.floor(Math.random() * 26) + 25;
                    const newHealth = targetPookieObj.health - damage;
                    
                    // Add thoughts for both pookies
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'hit-someone',
                      targetPookieName,
                      damage,
                      timestampMillis: now,
                    });
                    
                    this._changeState().pookies[targetPookieName].thoughts.push({
                      source: 'got-hit',
                      byPookieName: pookieName,
                      damage,
                      timestampMillis: now,
                    });
                    
                    // Apply damage
                    this._changeState().pookies[targetPookieName].health = newHealth;
                    
                    // Check if the target pookie died
                    if (newHealth <= 0) {
                      const targetLocation = this._calculatePookieLocation(targetPookieObj, now);
                      this._changeState().pookies[targetPookieName].currentAction = {
                        type: 'dead',
                        x: targetLocation.x,
                        y: targetLocation.y,
                        timestampMillis: now,
                        sinceTimestampMillis: now,
                        untilTimestampMillis: now + 60_000, // Dead for 60 seconds
                      };
                      this._changeState().pookies[targetPookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `You died! You were killed by ${pookieName}.`,
                        timestampMillis: now,
                      });
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `You killed ${targetPookieName}!`,
                        timestampMillis: now,
                      });
                    } else {
                      // Interrupt the target pookie
                      const targetLocation = this._calculatePookieLocation(targetPookieObj, now);
                      this._changeState().pookies[targetPookieName].currentAction = {
                        type: 'idle',
                        x: targetLocation.x,
                        y: targetLocation.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 0, // Immediately think about what happened
                      };
                    }
                    
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'idle',
                      x: pookie.currentAction.x,
                      y: pookie.currentAction.y,
                      sinceTimestampMillis: now,
                      minIdleDurationMillis: 5_000,
                    };
                    break;
                  }
                  
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
                        minIdleDurationMillis: 7_000,
                      };
                    }
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'idle',
                      x: pookie.currentAction.x,
                      y: pookie.currentAction.y,
                      sinceTimestampMillis: now,
                      minIdleDurationMillis: 12_000,
                    };
                    break;
                  case 'move-to-pookie': {
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'self-action-change',
                      text: `Moving towards pookie ${chosenResponse.pookieName}`,
                      timestampMillis: now,
                    });
                    const targetPookie = this.getWorldState().pookies[chosenResponse.pookieName];
                    if (targetPookie) {
                      const targetLocation = this._calculatePookieLocation(targetPookie, now);
                      const speechDist = this.getWorldState().level.speechDistance;
                      const targetPookiePoint = randomPointWithinRadius(targetLocation.x, targetLocation.y, speechDist);
                      const distToPookie = distance(pookie.currentAction.x, pookie.currentAction.y, targetPookiePoint.x, targetPookiePoint.y);
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'move',
                        startX: pookie.currentAction.x,
                        startY: pookie.currentAction.y,
                        startTimestampMillis: now + 1_000,
                        endX: targetPookiePoint.x,
                        endY: targetPookiePoint.y,
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
                  }
                  
                  case 'offer-trade': {
                    const targetPookieName = chosenResponse.targetPookieName;
                    const itemsOffered = chosenResponse.itemsOffered;
                    const itemsRequested = chosenResponse.itemsRequested;
                    
                    // Check if target pookie is within speech distance
                    if (!pookiesWithinSpeechDistance.has(targetPookieName)) {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't trade with ${targetPookieName} - they're too far away.`,
                        timestampMillis: now,
                      });
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    // Check if pookie has enough items to offer
                    if (!this._hasEnoughItems(pookieName, itemsOffered)) {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't make this trade offer - I don't have enough items.`,
                        timestampMillis: now,
                      });
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    // Create the trade offer
                    const offerId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                    const offer: TradeOffer = {
                      id: offerId,
                      fromPookieName: pookieName,
                      toPookieName: targetPookieName,
                      itemsOffered,
                      itemsRequested,
                      timestampMillis: now,
                    };
                    this._pendingTradeOffers.set(offerId, offer);
                    
                    // Say the trade offer out loud
                    const offerMessage = `${targetPookieName}, I will offer you ${itemsOffered.map(i => `${i.amount}x ${i.itemId}`).join(', ')} for ${itemsRequested.map(i => `${i.amount}x ${i.itemId}`).join(', ')}`;
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'self',
                      text: offerMessage,
                      spokenLoudly: true,
                      timestampMillis: now,
                    });
                    
                    // Notify the target pookie
                    if (targetPookieName in newPookies && newPookies[targetPookieName].currentAction.type !== 'dead') {
                      this._changeState().pookies[targetPookieName].thoughts.push({
                        source: 'trade-offer-received',
                        offerId,
                        fromPookieName: pookieName,
                        itemsOffered,
                        itemsRequested,
                        timestampMillis: now,
                      });
                      // Also add as speech so they hear it
                      this._changeState().pookies[targetPookieName].thoughts.push({
                        source: 'someone-else-said',
                        sayerPookieName: pookieName,
                        text: offerMessage,
                        timestampMillis: now,
                      });
                      // Interrupt them
                      this._changeState().pookies[targetPookieName].currentAction = {
                        type: 'idle',
                        x: this._calculatePookieLocation(newPookies[targetPookieName], now).x,
                        y: this._calculatePookieLocation(newPookies[targetPookieName], now).y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 0,
                      };
                    }
                    
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'idle',
                      x: pookie.currentAction.x,
                      y: pookie.currentAction.y,
                      sinceTimestampMillis: now,
                      minIdleDurationMillis: 5_000,
                    };
                    break;
                  }
                  
                  case 'accept-offer': {
                    const offerId = chosenResponse.offerId;
                    const offer = this._pendingTradeOffers.get(offerId);
                    
                    // Check if offer exists and is for this pookie
                    if (!offer || offer.toPookieName !== pookieName) {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't accept offer - it doesn't exist or isn't for me.`,
                        timestampMillis: now,
                      });
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    // Check if offer is expired (older than 60 seconds)
                    if (now - offer.timestampMillis > 60_000) {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't accept offer - it has expired.`,
                        timestampMillis: now,
                      });
                      this._pendingTradeOffers.delete(offerId);
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    // Check if this pookie has enough items to fulfill the trade
                    if (!this._hasEnoughItems(pookieName, offer.itemsRequested)) {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't accept offer - I don't have enough items.`,
                        timestampMillis: now,
                      });
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    // Check if the offering pookie still has their items
                    if (!this._hasEnoughItems(offer.fromPookieName, offer.itemsOffered)) {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't accept offer - ${offer.fromPookieName} no longer has the items.`,
                        timestampMillis: now,
                      });
                      this._pendingTradeOffers.delete(offerId);
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    // Execute the trade
                    this._removeItems(pookieName, offer.itemsRequested);
                    this._removeItems(offer.fromPookieName, offer.itemsOffered);
                    this._addItems(pookieName, offer.itemsOffered);
                    this._addItems(offer.fromPookieName, offer.itemsRequested);
                    
                    // Remove the offer
                    this._pendingTradeOffers.delete(offerId);
                    
                    // Say acceptance out loud
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'self',
                      text: "OK, let's trade!",
                      spokenLoudly: true,
                      timestampMillis: now,
                    });
                    
                    // Add trade completion thoughts to both pookies
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'trade-completed',
                      withPookieName: offer.fromPookieName,
                      itemsGiven: offer.itemsRequested,
                      itemsReceived: offer.itemsOffered,
                      timestampMillis: now,
                    });
                    
                    if (offer.fromPookieName in newPookies) {
                      this._changeState().pookies[offer.fromPookieName].thoughts.push({
                        source: 'someone-else-said',
                        sayerPookieName: pookieName,
                        text: "OK, let's trade!",
                        timestampMillis: now,
                      });
                      this._changeState().pookies[offer.fromPookieName].thoughts.push({
                        source: 'trade-completed',
                        withPookieName: pookieName,
                        itemsGiven: offer.itemsOffered,
                        itemsReceived: offer.itemsRequested,
                        timestampMillis: now,
                      });
                    }
                    
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'idle',
                      x: pookie.currentAction.x,
                      y: pookie.currentAction.y,
                      sinceTimestampMillis: now,
                      minIdleDurationMillis: 5_000,
                    };
                    break;
                  }
                  
                  case 'reject-offer': {
                    const offerId = chosenResponse.offerId;
                    const offer = this._pendingTradeOffers.get(offerId);
                    
                    // Check if offer exists and is for this pookie
                    if (!offer || offer.toPookieName !== pookieName) {
                      this._changeState().pookies[pookieName].thoughts.push({
                        source: 'self-action-change',
                        text: `Can't reject offer - it doesn't exist or isn't for me.`,
                        timestampMillis: now,
                      });
                      this._changeState().pookies[pookieName].currentAction = {
                        type: 'idle',
                        x: pookie.currentAction.x,
                        y: pookie.currentAction.y,
                        sinceTimestampMillis: now,
                        minIdleDurationMillis: 3_000,
                      };
                      break;
                    }
                    
                    // Remove the offer
                    this._pendingTradeOffers.delete(offerId);
                    
                    // Say rejection out loud
                    this._changeState().pookies[pookieName].thoughts.push({
                      source: 'self',
                      text: "I don't want that",
                      spokenLoudly: true,
                      timestampMillis: now,
                    });
                    
                    // Notify the offering pookie
                    if (offer.fromPookieName in newPookies) {
                      this._changeState().pookies[offer.fromPookieName].thoughts.push({
                        source: 'someone-else-said',
                        sayerPookieName: pookieName,
                        text: "I don't want that",
                        timestampMillis: now,
                      });
                      this._changeState().pookies[offer.fromPookieName].thoughts.push({
                        source: 'trade-rejected',
                        byPookieName: pookieName,
                        timestampMillis: now,
                      });
                    }
                    
                    this._changeState().pookies[pookieName].currentAction = {
                      type: 'idle',
                      x: pookie.currentAction.x,
                      y: pookie.currentAction.y,
                      sinceTimestampMillis: now,
                      minIdleDurationMillis: 5_000,
                    };
                    break;
                  }
                  
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
