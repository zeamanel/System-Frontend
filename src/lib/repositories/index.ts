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
/**
 * Production builds configured for the live backend can never use demo data:
 * this build-time constant lets the bundler drop the demo repository and its
 * sample data from the download entirely.
 */
const DEMO_DATA_POSSIBLE = import.meta.env.DEV || import.meta.env.VITE_DATA_SOURCE !== 'http'

export function getRepositories(): Repositories {
  if (!cached) {
    cached =
      DEMO_DATA_POSSIBLE && env.dataSource === 'fixtures'
        ? createFixtureRepositories()
        : createHttpRepositories()
  }
  return cached
}

/** True when the app is serving clearly-labeled development fixtures. */
export function isFixtureDataSource(): boolean {
  return env.dataSource === 'fixtures'
}
