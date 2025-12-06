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
