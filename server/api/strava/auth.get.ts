export default defineEventHandler((event) => {
  if (!stravaConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'Strava is not configured. Set NUXT_PUBLIC_STRAVA_CLIENT_ID and NUXT_STRAVA_CLIENT_SECRET.',
    })
  }

  const config = useRuntimeConfig(event)
  const state = randomState()
  setCookie(event, COOKIE_OAUTH_STATE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })

  const params = new URLSearchParams({
    client_id: String(config.public.stravaClientId),
    response_type: 'code',
    redirect_uri: stravaRedirectUri(event),
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES,
    state,
  })

  return sendRedirect(event, `https://www.strava.com/oauth/authorize?${params}`)
})
