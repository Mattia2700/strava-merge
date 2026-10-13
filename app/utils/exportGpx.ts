import type { ActivityStream, TrackPoint } from './activity'

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function iso(t: number): string {
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function fmtCoord(n: number): string {
  return n.toFixed(7)
}

function fmtEle(n: number): string {
  return n.toFixed(1)
}

function pointXml(p: TrackPoint): string {
  const ele =
    typeof p.ele === 'number' ? `    <ele>${fmtEle(p.ele)}</ele>\n` : ''

  const tpeParts: string[] = []
  if (typeof p.hr === 'number') tpeParts.push(`      <gpxtpx:hr>${Math.round(p.hr)}</gpxtpx:hr>`)
  if (typeof p.cad === 'number') {
    tpeParts.push(`      <gpxtpx:cad>${Math.round(p.cad)}</gpxtpx:cad>`)
  }
  if (typeof p.temp === 'number') {
    tpeParts.push(`      <gpxtpx:atemp>${p.temp.toFixed(1)}</gpxtpx:atemp>`)
  }

  const hasPower = typeof p.power === 'number'
  const hasTpe = tpeParts.length > 0

  let extensions = ''
  if (hasPower || hasTpe) {
    const powerLine = hasPower
      ? `     <power>${Math.round(p.power!)}</power>\n`
      : ''
    const tpeBlock = hasTpe
      ? `     <gpxtpx:TrackPointExtension>\n${tpeParts.join('\n')}\n     </gpxtpx:TrackPointExtension>\n`
      : ''
    extensions = `    <extensions>\n${powerLine}${tpeBlock}    </extensions>\n`
  }

  return `   <trkpt lat="${fmtCoord(p.lat!)}" lon="${fmtCoord(p.lon!)}">
${ele}    <time>${iso(p.t)}</time>
${extensions}   </trkpt>`
}

export function exportGpx(stream: ActivityStream): string {
  const start = stream.points[0]?.t ?? Date.now()
  const body = stream.points.map(pointXml).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="strava-merge" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3">
 <metadata>
  <time>${iso(start)}</time>
 </metadata>
 <trk>
  <name>${esc(stream.name)}</name>
  <type>${esc(stream.sport)}</type>
  <trkseg>
${body}
  </trkseg>
 </trk>
</gpx>
`
}

export function downloadGpx(stream: ActivityStream, filename?: string): void {
  const xml = exportGpx(stream)
  const blob = new Blob([xml], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${stream.name.replace(/\s+/g, '_')}_merged.gpx`
  a.click()
  URL.revokeObjectURL(url)
}
