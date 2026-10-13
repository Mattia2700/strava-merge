import type { ActivityStream } from './activity'
import { parseFitFile } from './parseFit'
import { parseGpxFile } from './parseGpx'

export async function parseActivityFile(
  file: File,
  sourceLabel?: string,
): Promise<ActivityStream> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.gpx')) return parseGpxFile(file, sourceLabel)
  if (name.endsWith('.fit')) return parseFitFile(file, sourceLabel)
  throw new Error(`Unsupported file type: ${file.name}`)
}
