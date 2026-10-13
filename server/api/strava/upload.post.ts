export default defineEventHandler(async (event) => {
  const accessToken = await getValidStravaAccessToken(event)
  const parts = await readMultipartFormData(event)

  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Expected multipart form data' })
  }

  const filePart = parts.find((p) => p.name === 'file' && p.data?.length)
  if (!filePart) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file' })
  }

  const dataTypeRaw = parts.find((p) => p.name === 'data_type')?.data?.toString('utf8') || 'fit'
  const dataType = dataTypeRaw.toLowerCase() === 'gpx' ? 'gpx' : 'fit'
  const name = parts.find((p) => p.name === 'name')?.data?.toString('utf8') || undefined
  const filename =
    filePart.filename ||
    `${(name || 'merged').replace(/\s+/g, '_')}.${dataType}`

  const status = await uploadToStrava(
    accessToken,
    filePart.data,
    filename,
    dataType,
    name,
  )

  return {
    uploadId: status.id,
    activityId: status.activity_id,
    activityUrl: status.activity_id
      ? `https://www.strava.com/activities/${status.activity_id}`
      : null,
    status: status.status,
  }
})
