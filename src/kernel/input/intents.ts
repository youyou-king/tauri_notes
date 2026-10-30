export type InputSource =
  | "mouse"
  | "keyboard"
  | "touch"
  | "pen"
  | "programmatic";

export type Intent = {
  name: string;
  source: InputSource;
  payload?: Record<string, unknown>;
  target?: string;
};

export type IntentHandler = (intent: Intent) => boolean | void;

const handlers = new Map<string, Set<IntentHandler>>();

export function createIntent(
  name: string,
  source: InputSource,
  payload?: Record<string, unknown>,
): Intent {
  return { name, source, payload };
}

export function registerIntentHandler(
  name: string,
  handler: IntentHandler,
): () => void {
  const bucket = handlers.get(name) ?? new Set<IntentHandler>();
  bucket.add(handler);
  handlers.set(name, bucket);
  return () => {
    bucket.delete(handler);
    if (bucket.size === 0) {
      handlers.delete(name);
    }
  };
}

export function dispatchIntent(intent: Intent): boolean {
  const bucket = handlers.get(intent.name);
  if (!bucket || bucket.size === 0) {
    return false;
  }
  let handled = false;
  for (const handler of bucket) {
    if (handler(intent) === true) {
      handled = true;
      break;
    }
  }
  return handled;
}
