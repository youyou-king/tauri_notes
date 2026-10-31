export type MigrationStep<T> = {
  version: number;
  migrate: (value: T) => T;
};

/**
 * One ordered migration runner for browser-side records. Native stores keep
 * their own transactional ledgers (SQLite schema_migrations, IndexedDB
 * upgrade), but every store has an explicit current version.
 */
export function runMigrations<T>(
  value: T,
  currentVersion: number,
  targetVersion: number,
  steps: ReadonlyArray<MigrationStep<T>>,
): T {
  if (currentVersion > targetVersion) {
    return value;
  }
  return steps.reduce(
    (current, step) =>
      currentVersion < step.version ? step.migrate(current) : current,
    value,
  );
}
