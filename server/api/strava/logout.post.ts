export default defineEventHandler((event) => {
  clearStravaCookies(event)
  return { ok: true }
})
