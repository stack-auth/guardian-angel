// Types matching backend world state

export type WorldState = {
  level: CustomLevel;
  startTimestampMillis: number;
  pookies: {
    [pookieName: string]: Pookie;
  };
};

export type CustomLevel = {
  maxPlayers: number;
  width: number;
  height: number;
  speechDistance: number;
  walkSpeedPerSecond: number;
  backgroundImage: {
    url: string;
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
      variables: Record<string, string | number | boolean>;
    };
  };
};

export type Pookie = {
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
