import { exportPersonData } from './client'

/** Downloads everything kept about the person, to give them. */
export async function downloadPersonData(id: string, name: string): Promise<void> {
  const blob = await exportPersonData(id)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'record'} - data.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
