export type LifecyclePort = {
  /**
   * Registers a callback for the App being hidden/backgrounded. Returns an
   * unsubscribe function.
   */
  onBackground(handler: () => void): () => void;
};