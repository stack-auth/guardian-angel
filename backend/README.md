## Getting Started

Port 3001.

Endpoints:

- POST /worlds: Creates a new world
- POST /worlds/[world-id]/join: Tries to join the world. If it has reached the maximum number of pookies, returns a 400 saying that it has reached the maximum number of pookies. Otherwise, returns a 200 and the pookie's id.
- GET /worlds/[world-id]/state: Returns the world state as a JSON.
- WebSocket /worlds/[world-id]/state/listen: WebSocket connection that sends the most recent world state whenever it changes.
- POST /worlds/[world-id]/pookies/[pookie-id]/guardian-angel/chat: Sends a message to the pookie from its guardian angel. Returns a 200 once sent.


World state object: See world.ts
