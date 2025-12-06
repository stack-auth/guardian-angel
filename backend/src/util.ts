export function runAsynchronously<T>(arg: Promise<T> | (() => Promise<T>)): void {
  if (typeof arg === 'function') {
    arg = arg();
  }
  arg.catch(error => {
    console.error("Error running asynchronously: ", error);
  });
}

export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

/** Returns a random point within the given radius of the target point */
export function randomPointWithinRadius(targetX: number, targetY: number, radius: number): { x: number; y: number } {
  // Use polar coordinates to get uniform distribution within circle
  const angle = Math.random() * 2 * Math.PI;
  const r = Math.sqrt(Math.random()) * radius; // sqrt for uniform distribution
  return {
    x: targetX + r * Math.cos(angle),
    y: targetY + r * Math.sin(angle),
  };
}
