## Getting Started

Port 3001.

Endpoints:

- POST /worlds/[world-id]/join: Tries to join the world. If it has reached the maximum number of pookies, returns a 400 saying that it has reached the maximum number of pookies. Otherwise, returns a 200 and the pookie's id.
- GET /worlds/[world-id]/state: Returns the world state as a JSON.
- WebSocket /worlds/[world-id]/state/listen: WebSocket connection that sends the most recent world state whenever it changes.
- POST /worlds/[world-id]/pookies/[pookie-id]/guardian-angel/chat: Sends a message to the pookie from its guardian angel. Returns a 200 once sent.


World state object:

```ts
type WorldState = {
  level: {
    backgroundImage: {
      url: string,
      /** 1.0 means 1 pixel is 1 unit, 0.5 means 2 pixels are 1 unit, 10.0 means 1 pixel is 10 units, etc. Usually < 1.0 */
      scale: number,
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
  },
  startTimestampMillis: number,
  pookies: {
    [pookieId: string]: {
      currentAction: PookieAction,
      inventory: PookieInventoryItem[],
      thoughts: PookieThought[],
      health: number,
      hunger: number,
    }
  },
}

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
    type: "idle",
    sinceTimestampMillis: number,
  }
  | {
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
