declare module 'sqlite-vec' {
  /**
   * Load the sqlite-vec extension into the given database handle.
   */
  export function load(db: unknown): void;

  /**
   * Return the filesystem path to the loadable sqlite-vec extension binary.
   */
  export function getLoadablePath(): string;
}
