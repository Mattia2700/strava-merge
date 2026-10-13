/** Turn API / HTML-ish messages into safe plain text for UI display. */
export function sanitizeMessage(input: string): string {
  let s = input

  // <a href="…">label</a> → label (absolute-url)
  s = s.replace(
    /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, label: string) => {
      const text = stripTags(label).trim() || href
      const url = absolutizeHref(href)
      return url && url !== text ? `${text} (${url})` : text
    },
  )

  s = stripTags(s)
  s = decodeEntities(s)
  return s.replace(/\s+/g, ' ').trim()
}

function absolutizeHref(href: string): string {
  const h = href.trim()
  if (!h) return ''
  if (/^https?:\/\//i.test(h)) return h
  if (h.startsWith('/')) return `https://www.strava.com${h}`
  return h
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
}
