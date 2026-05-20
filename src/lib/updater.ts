export type UpdatePreference = 'ask' | 'auto' | 'never'

const PREF_KEY = 'monet:update-preference'
const LAST_CHECK_KEY = 'monet:update-last-check'
const SKIPPED_KEY = 'monet:update-skipped-version'
const CHECK_INTERVAL = 24 * 60 * 60 * 1000

export function getUpdatePreference(): UpdatePreference {
  return (localStorage.getItem(PREF_KEY) as UpdatePreference) ?? 'ask'
}

export function setUpdatePreference(pref: UpdatePreference): void {
  localStorage.setItem(PREF_KEY, pref)
}

export function getSkippedVersion(): string | null {
  return localStorage.getItem(SKIPPED_KEY)
}

export function setSkippedVersion(version: string): void {
  localStorage.setItem(SKIPPED_KEY, version)
}

export function isCheckDue(): boolean {
  const last = localStorage.getItem(LAST_CHECK_KEY)
  if (!last) return true
  return Date.now() - parseInt(last, 10) > CHECK_INTERVAL
}

export function recordCheck(): void {
  localStorage.setItem(LAST_CHECK_KEY, Date.now().toString())
}

export function isMandatory(body: string | null | undefined): boolean {
  return !!(body && body.includes('[MANDATORY]'))
}
