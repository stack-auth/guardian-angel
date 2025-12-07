// Types matching backend world state exactly

export type WorldState = {
  level: CustomLevel;
  startTimestampMillis: number;
  pookies: {
    [pookieName: string]: Pookie;
  };
};

export type CustomLevel = {
  maxPookies: number;
  width: number;
  height: number;
  speechDistance: number;
  facilityInteractionDistance: number;
  walkSpeedPerSecond: number;
  backgroundImage: {
    url: string;
    /** Actual image width in pixels */
    widthPx: number;
    /** Actual image height in pixels */
    heightPx: number;
  };
  itemTypes: {
    [itemTypeId: string]: {
      displayName: string;
      description: string;
      itemSprite: {
        url: string;
      };
    };
  };
  facilities: {
    [facilityId: string]: {
      x: number;
      y: number;
      displayName: string;
      interactionPrompt: string;
      interactionName: string;
      interactionDurationMillis: number;
      variables: Record<string, string | number | boolean>;
    };
  };
};

export type Pookie = {
  personality: string;
  currentAction: PookieAction;
  inventory: PookieInventoryItem[];
  thoughts: PookieThought[];
  health: number;
  food: number;
};

export type PookieThought =
  | {
      source: "self";
      text: string;
      spokenLoudly: boolean;
      timestampMillis: number;
    }
  | {
      source: "guardian-angel";
      text: string;
      timestampMillis: number;
    }
  | {
      source: "facility";
      text: string;
      timestampMillis: number;
    }
  | {
      source: "self-action-change";
      text: string;
      timestampMillis: number;
    }
  | {
      source: "someone-else-said";
      sayerPookieName: string;
      text: string;
      timestampMillis: number;
    }
  | {
      source: "trade-offer-received";
      offerId: string;
      fromPookieName: string;
      itemsOffered: { itemId: string; amount: number }[];
      itemsRequested: { itemId: string; amount: number }[];
      timestampMillis: number;
    }
  | {
      source: "trade-completed";
      withPookieName: string;
      itemsGiven: { itemId: string; amount: number }[];
      itemsReceived: { itemId: string; amount: number }[];
      timestampMillis: number;
    }
  | {
      source: "trade-rejected";
      byPookieName: string;
      timestampMillis: number;
    }
  | {
      source: "got-hit";
      byPookieName: string;
      damage: number;
      timestampMillis: number;
    }
  | {
      source: "hit-someone";
      targetPookieName: string;
      damage: number;
      timestampMillis: number;
    };

export type PookieAction =
  | {
      type: "idle";
      x: number;
      y: number;
      sinceTimestampMillis: number;
      minIdleDurationMillis: number;
    }
  | {
      type: "thinking";
      x: number;
      y: number;
      thinkingIndex: number;
      sinceTimestampMillis: number;
    }
  | {
      type: "move";
      startX: number;
      startY: number;
      startTimestampMillis: number;
      endX: number;
      endY: number;
      endTimestampMillis: number;
    }
  | {
      type: "interact-with-facility";
      x: number;
      y: number;
      facilityId: string;
      interactionName: string;
      sinceTimestampMillis: number;
      untilTimestampMillis: number;
    }
  | {
      type: "dead";
      x: number;
      y: number;
      timestampMillis: number;
      sinceTimestampMillis: number;
      untilTimestampMillis: number;
    };

export type PookieInventoryItem = {
  id: string;
  amount: number;
};
