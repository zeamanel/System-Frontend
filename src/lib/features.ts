import { env } from '../config/env'
import { apiClient } from './api'

/** Optional features switched on the server (no frontend release needed). */
export interface Features {
  designs: boolean
}

const OFF: Features = { designs: false }

export async function fetchFeatures(): Promise<Features> {
  // Demo mode shows everything that is built.
  if (env.dataSource !== 'http') return { designs: true }
  try {
    const features = await apiClient.get<Partial<Features>>('/features', { auth: 'required' })
    return { designs: features.designs === true }
  } catch {
    // An older backend, or offline: optional features stay hidden.
    return OFF
  }
}
