export default defineEventHandler((event) => {
  return getStravaConnection(event)
})
