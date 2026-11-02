export type SharePort = {
  shareLibrary(path: string): Promise<boolean>;
};