import type { CanonicalLine, CanonicalPage } from '../types'

/** Parse a Kraken _kraken.json file into the canonical page schema. */
export function adaptKrakenJson(raw: unknown): CanonicalPage {
  const r = raw as Record<string, unknown>

  const lines: CanonicalLine[] = ((r.lines as unknown[]) ?? []).map((l: unknown) => {
    const line = l as Record<string, unknown>
    return {
      id: line.id as number,
      baseline: (line.baseline ?? null) as [number, number][] | null,
      boundary: (line.boundary ?? null) as [number, number][] | null,
    }
  })

  return {
    folio: r.folio as string,
    imageWidth: r.image_width as number,
    imageHeight: r.image_height as number,
    lines,
    modelName: (r.model_name as string | undefined) ?? 'kraken_blla',
    runDate: (r.run_date as string | undefined) ?? '',
  }
}
