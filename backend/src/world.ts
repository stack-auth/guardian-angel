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
    source: "self-action",
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
  /** Note: Whenever you update this, make sure that you call _notifyWorldStateChange() to notify subscribers. */
  private _worldState: WorldState;
  private _worldStateChangeCallbacks: Map<string, (worldState: WorldState) => void>;
  private _tickInterval: NodeJS.Timeout;

  constructor(levelState: CustomLevel) {
    this._worldState = {
      level: levelState,
      startTimestampMillis: Date.now(),
      pookies: {},
    };
    this._worldStateChangeCallbacks = new Map();
    this._tickInterval = setInterval(() => this._tick(), 1000);
  }

  public getWorldState(): WorldState {
    return this._worldState;
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
      this._worldStateChangeCallbacks.forEach(callback => callback(this._worldState));
    }, 10);
  }

  public join(): { pookieId: string } | "max-players-reached" {
    if (Object.keys(this._worldState.pookies).length >= this._worldState.level.maxPlayers) {
      return "max-players-reached";
    }
    const pookieId = crypto.randomUUID();
    this._worldState.pookies[pookieId] = {
      currentAction: {
        type: 'idle',
        x: Math.random() * this._worldState.level.width,
        y: Math.random() * this._worldState.level.height,
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
    for (const [pookieId, pookie] of Object.entries(this._worldState.pookies)) {
      if (pookie.currentAction.type === 'move') {
        if (now > pookie.currentAction.endTimestampMillis) {
          this._worldState.pookies[pookieId].currentAction = {
            type: 'idle',
            x: pookie.currentAction.endX,
            y: pookie.currentAction.endY,
            sinceTimestampMillis: now,
          };
          this._notifyWorldStateChange();
        }
      }
    }
  }
}
