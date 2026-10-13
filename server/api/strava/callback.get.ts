export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const error = typeof query.error === 'string' ? query.error : null
  if (error) {
    return sendRedirect(event, `/?strava=error&reason=${encodeURIComponent(error)}`)
  }

  const code = typeof query.code === 'string' ? query.code : null
  const state = typeof query.state === 'string' ? query.state : null
  const expected = getCookie(event, COOKIE_OAUTH_STATE)

  if (!code || !state || !expected || state !== expected) {
    return sendRedirect(event, '/?strava=error&reason=invalid_state')
  }

  deleteCookie(event, COOKIE_OAUTH_STATE, { path: '/' })

  try {
    const tokens = await exchangeStravaCode(event, code)
    const scopes = String(query.scope || '')
    if (!scopes.split(/[\s,]+/).includes('activity:write')) {
      clearStravaCookies(event)
      return sendRedirect(event, '/?strava=error&reason=missing_activity_write')
    }
    setStravaTokenCookies(event, tokens)
    return sendRedirect(event, '/?strava=connected')
  } catch {
    return sendRedirect(event, '/?strava=error&reason=token_exchange')
  }
})
