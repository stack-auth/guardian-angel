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
    /** 1.0 means 1 pixel is 1 unit, 0.5 means 2 pixels are 1 unit, 10.0 means 1 pixel is 10 units, etc. Usually < 1.0 */
    scale: number;
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
      interactionId: string;
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
