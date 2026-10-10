import { env } from '../../config/env'
import { createFixtureRepositories } from './fixture-repositories'
import { createHttpRepositories } from './http-repositories'
import type { Repositories } from './types'

export type * from './types'
export { DocumentConflictError, ExportUnavailableError } from './errors'

let cached: Repositories | null = null

/**
 * Composition root for the data layer. The active implementation is chosen
 * once from VITE_DATA_SOURCE and shared app-wide — components and hooks
 * must depend on these interfaces, never on a concrete implementation.
 */
export function getRepositories(): Repositories {
  if (!cached) {
    cached =
      env.dataSource === 'fixtures'
        ? createFixtureRepositories()
        : createHttpRepositories()
  }
  return cached
}

/** True when the app is serving clearly-labeled development fixtures. */
export function isFixtureDataSource(): boolean {
  return env.dataSource === 'fixtures'
}
