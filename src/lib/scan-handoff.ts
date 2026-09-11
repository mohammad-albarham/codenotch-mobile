let currentHandoff: string | null = null;
let listeners: Array<(link: string | null) => void> = [];

export function setScanHandoff(link: string | null) {
  currentHandoff = link;
  for (const listener of listeners) {
    listener(link);
  }
}

export function consumeScanHandoff(): string | null {
  const link = currentHandoff;
  currentHandoff = null;
  return link;
}

export function subscribeScanHandoff(listener: (link: string | null) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
