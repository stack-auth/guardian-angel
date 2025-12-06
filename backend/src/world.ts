// Note: All x, y, width, height values are in units and can be fractional (use backgroundImage.scale to convert to display pixels).

type WorldState = {
  level: CustomLevel,
  startTimestampMillis: number,
  pookies: {
    [pookieId: string]: Pookie,
  },
}

type Pookie = {
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
    imageUrl: string,
    timestampMillis: number,
  }
  | {
    source: "facility",
    facilityId: string,
    timestampMillis: number,
  }
  | {
    source: "self-action-change",
    from: PookieAction,
    to: PookieAction,
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
    timestampMillis: number,
    sinceTimestampMillis: number,
    untilTimestampMillis: number,
  }
);

type PookieInventoryItem = {
  id: string,
  amount: number,
}




class World {
  /** Note: Do not change this directly. Instead, use _changeState() to change the world state. */
  private _worldStateDoNotUseDirectly: WorldState;
  private _worldStateChangeCallbacks: Map<string, (worldState: WorldState) => void>;
  private _tickInterval: NodeJS.Timeout;

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

  public join(): { pookieId: string } | "max-players-reached" {
    if (Object.keys(this.getWorldState().pookies).length >= this.getWorldState().level.maxPlayers) {
      return "max-players-reached";
    }
    const pookieId = crypto.randomUUID();
    this._changeState().pookies[pookieId] = {
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
    this._notifyWorldStateChange();
    return { pookieId };
  }

  private _tick(): void {
    const now = Date.now();

    // make pookies that are moving, but past their end timestamp, stop moving and be idling at their end x, y
    for (const [pookieId, pookie] of Object.entries(this.getWorldState().pookies)) {
      if (pookie.currentAction.type === 'move') {
        if (now > pookie.currentAction.endTimestampMillis) {
          this._changeState().pookies[pookieId].currentAction = {
            type: 'idle',
            x: pookie.currentAction.endX,
            y: pookie.currentAction.endY,
            sinceTimestampMillis: now,
            minIdleDurationMillis: 3000,
          };
          this._notifyWorldStateChange();
        }
      }
    }

    // make pookies that are idle start an LLM chat to decide their next action
    for (const [pookieId, pookie] of Object.entries(this.getWorldState().pookies)) {
      if (pookie.currentAction.type === 'idle') {
        if (now > pookie.currentAction.sinceTimestampMillis + pookie.currentAction.minIdleDurationMillis) {
        const thoughtToText = (thought: PookieThought) => {
          switch (thought.source) {
            case 'self':
              return `You thought: "${thought.text}"`;
            case 'guardian-angel':
              return `Your guardian angel said: ${thought.imageUrl}`;
            default: {
              throw new Error(`Unknown thought source: ${thought.source}`);
            }
          }
        }
        const prompt = `

          You are a pookie in the Pookieverse. 
          
          Health: ${pookie.health}/100. Food: ${pookie.food}/100.
          
          You are currently idle at ${pookie.currentAction.x}, ${pookie.currentAction.y}.
          
          You have the following inventory: ${pookie.inventory.map(item => `${item.amount}x ${item.id}`).join(', ')}.

          You have a guardian angel. It can see what happens around you and tries to be helpful. No one else can see or hear your guardian angel. Usually you should listen to your guardian angel, but if you feel like your guardian angel has been giving you bad advice, you can start ignoring it.

          You have multiple things you can do:
           - Idle. In this case, you will stay idle for a few seconds, and then think again. If a pookie or guardian angel talks to you during this time, you will be interrupted. This is great when you're waiting for something, like a response from another pookie.
           - Talk. In this case, pookies near you will hear you and be able to interact with you.
           - Interact with a facility. 
          
          Below is your memory:

          ${pookie.thoughts.map(thought => `- ${thoughtToText(thought)}`).join("\n")}

        `.trim().split("\n").map(line => line.trim()).join("\n");
      }
    }
  }
}
