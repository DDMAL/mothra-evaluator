import type { EvalStore, Tag } from '../types'

function tagNames(tagIds: string[], tagBank: Tag[]): string {
  return tagIds
    .map(id => tagBank.find(t => t.id === id)?.name ?? id)
    .join('; ')
}

/** Export all evaluations as a CSV string. */
export function toCSV(store: EvalStore): string {
  const header = 'folio,line_id,tags,comment,noteworthy,evaluated_at,page_status,page_comment'
  const rows: string[] = [header]

  for (const [folio, pageEval] of Object.entries(store.pages)) {
    for (const [lineId, lineEval] of Object.entries(pageEval.lines)) {
      const tags = tagNames(lineEval.tags, store.tagBank)
      const row = [
        folio,
        lineId,
        tags,
        lineEval.comment.replace(/"/g, '""'),
        lineEval.noteworthy ? 'true' : 'false',
        lineEval.evaluatedAt ?? '',
        pageEval.status,
        pageEval.comment.replace(/"/g, '""'),
      ]
        .map(v => (v.includes(',') || v.includes('"') ? `"${v}"` : v))
        .join(',')
      rows.push(row)
    }
  }

  return rows.join('\n')
}

export function downloadString(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
