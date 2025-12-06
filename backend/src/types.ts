import type { WebSocket } from 'ws';

export type PookieThought = 
  | {
      source: 'self';
      text: string;
      spokenLoudly: boolean;
      timestampMillis: number;
    }
  | {
      source: 'guardian-angel';
      imageUrl: string;
      timestampMillis: number;
    }
  | {
      source: 'facility';
      facilityId: string;
      timestampMillis: number;
    }
  | {
      source: 'self-action';
      text: string;
      timestampMillis: number;
    };

export type PookieAction =
  | {
      type: 'idle';
      sinceTimestampMillis: number;
    }
  | {
      type: 'move';
      startX: number;
      startY: number;
      startTimestampMillis: number;
      endX: number;
      endY: number;
      endTimestampMillis: number;
    }
  | {
      type: 'interact-with-facility';
      facilityId: string;
      interactionName: string;
    }
  | {
      type: 'dead';
      timestampMillis: number;
      sinceTimestampMillis: number;
      untilTimestampMillis: number;
    };

export type PookieInventoryItem = {
  id: string;
  amount: number;
};

export type Pookie = {
  currentAction: PookieAction;
  inventory: PookieInventoryItem[];
  thoughts: PookieThought[];
  health: number;
  hunger: number;
};

export type Facility = {
  x: number;
  y: number;
  displayName: string;
  interactionPrompt: string;
  interactionName: string;
  variables: Record<string, string | number | boolean>;
};

export type WorldState = {
  level: {
    backgroundImage: {
      url: string;
      scale: number;
    };
    facilities: Record<string, Facility>;
  };
  startTimestampMillis: number;
  pookies: Record<string, Pookie>;
};

export type World = {
  state: WorldState;
  wsClients: Set<WebSocket>;
};

export type WorldsStore = Record<string, World>;

