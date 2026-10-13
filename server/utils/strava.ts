import type { H3Event } from 'h3'
import { createError, deleteCookie, getCookie, getRequestURL, setCookie } from 'h3'

export const STRAVA_SCOPES = 'read,activity:write'

const COOKIE_ACCESS = 'strava_at'
const COOKIE_REFRESH = 'strava_rt'
const COOKIE_EXPIRES = 'strava_exp'
const COOKIE_ATHLETE = 'strava_athlete'
export const COOKIE_OAUTH_STATE = 'strava_oauth_state'

export type StravaTokenResponse = {
  token_type: string
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
  athlete?: {
    id: number
    firstname?: string
    lastname?: string
    username?: string
  }
}

export type StravaUploadStatus = {
  id: number
  external_id: string | null
  error: string | null
  status: string
  activity_id: number | null
}

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export function stravaConfigured() {
  const config = useRuntimeConfig()
  return Boolean(config.public.stravaClientId && config.stravaClientSecret)
}

export function stravaRedirectUri(event: H3Event) {
  const config = useRuntimeConfig(event)
  if (config.stravaRedirectUri) return String(config.stravaRedirectUri)
  const url = getRequestURL(event)
  return `${url.origin}/api/strava/callback`
}

export function setStravaTokenCookies(event: H3Event, tokens: StravaTokenResponse) {
  setCookie(event, COOKIE_ACCESS, tokens.access_token, cookieOpts(60 * 60 * 6))
  setCookie(event, COOKIE_REFRESH, tokens.refresh_token, cookieOpts(60 * 60 * 24 * 365))
  setCookie(event, COOKIE_EXPIRES, String(tokens.expires_at), cookieOpts(60 * 60 * 24 * 365))

  if (tokens.athlete) {
    const name =
      [tokens.athlete.firstname, tokens.athlete.lastname].filter(Boolean).join(' ') ||
      tokens.athlete.username ||
      `Athlete ${tokens.athlete.id}`
    setCookie(event, COOKIE_ATHLETE, name, cookieOpts(60 * 60 * 24 * 365))
  }
}

export function clearStravaCookies(event: H3Event) {
  for (const name of [
    COOKIE_ACCESS,
    COOKIE_REFRESH,
    COOKIE_EXPIRES,
    COOKIE_ATHLETE,
    COOKIE_OAUTH_STATE,
  ]) {
    deleteCookie(event, name, { path: '/' })
  }
}

export function getStravaConnection(event: H3Event) {
  const refresh = getCookie(event, COOKIE_REFRESH)
  const athlete = getCookie(event, COOKIE_ATHLETE) || null
  return {
    configured: stravaConfigured(),
    connected: Boolean(refresh),
    athlete,
  }
}

export async function exchangeStravaCode(event: H3Event, code: string) {
  const config = useRuntimeConfig(event)
  return await $fetch<StravaTokenResponse>('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: {
      client_id: config.public.stravaClientId,
      client_secret: config.stravaClientSecret,
      code,
      grant_type: 'authorization_code',
    },
  })
}

export async function getValidStravaAccessToken(event: H3Event): Promise<string> {
  const config = useRuntimeConfig(event)
  if (!stravaConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Strava is not configured on this server' })
  }

  const access = getCookie(event, COOKIE_ACCESS)
  const refresh = getCookie(event, COOKIE_REFRESH)
  const expiresAt = Number(getCookie(event, COOKIE_EXPIRES) || 0)

  if (!refresh) {
    throw createError({ statusCode: 401, statusMessage: 'Connect Strava first' })
  }

  const now = Math.floor(Date.now() / 1000)
  if (access && expiresAt > now + 60) return access

  try {
    const tokens = await $fetch<StravaTokenResponse>('https://www.strava.com/oauth/token', {
      method: 'POST',
      body: {
        client_id: config.public.stravaClientId,
        client_secret: config.stravaClientSecret,
        grant_type: 'refresh_token',
        refresh_token: refresh,
      },
    })
    setStravaTokenCookies(event, tokens)
    return tokens.access_token
  } catch {
    clearStravaCookies(event)
    throw createError({
      statusCode: 401,
      statusMessage: 'Strava session expired — connect again',
    })
  }
}

export async function uploadToStrava(
  accessToken: string,
  file: Buffer | Uint8Array,
  filename: string,
  dataType: 'fit' | 'gpx',
  name?: string,
) {
  const form = new FormData()
  const bytes = Uint8Array.from(file)
  form.append(
    'file',
    new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
      type: dataType === 'fit' ? 'application/octet-stream' : 'application/gpx+xml',
    }),
    filename,
  )
  form.append('data_type', dataType)
  form.append('external_id', filename)
  if (name) form.append('name', name)

  const upload = await $fetch<StravaUploadStatus>('https://www.strava.com/api/v3/uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  })

  return pollUpload(accessToken, upload.id)
}

async function pollUpload(accessToken: string, uploadId: number): Promise<StravaUploadStatus> {
  const started = Date.now()
  const timeoutMs = 90_000

  while (Date.now() - started < timeoutMs) {
    const status = await $fetch<StravaUploadStatus>(
      `https://www.strava.com/api/v3/uploads/${uploadId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )

    if (status.activity_id) return status
    if (status.error) {
      throw createError({
        statusCode: 422,
        statusMessage: status.error || status.status || 'Strava upload failed',
      })
    }

    await new Promise((r) => setTimeout(r, 1000))
  }

  throw createError({
    statusCode: 504,
    statusMessage: 'Timed out waiting for Strava to process the upload',
  })
}

export function randomState() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
