export interface CanonicalLine {
  id: number
  baseline: [number, number][] | null
  boundary: [number, number][] | null
}

export interface CanonicalPage {
  folio: string
  imageWidth: number
  imageHeight: number
  lines: CanonicalLine[]
  modelName: string
  runDate: string
}

export interface Tag {
  id: string
  name: string
  color: string
  archived: boolean
}

export interface LineEval {
  tags: string[]         // tag IDs
  comment: string
  noteworthy: boolean
  evaluatedAt: string | null
}

export interface PageEval {
  status: 'untouched' | 'in_progress' | 'complete'
  comment: string
  completedAt: string | null
  lines: Record<string, LineEval>  // key = line id as string
}

export interface EvalStore {
  schemaVersion: 1
  project: string
  tagBank: Tag[]
  pages: Record<string, PageEval>  // key = folio stem
}

export function emptyLineEval(): LineEval {
  return { tags: [], comment: '', noteworthy: false, evaluatedAt: null }
}

export function emptyPageEval(): PageEval {
  return { status: 'untouched', comment: '', completedAt: null, lines: {} }
}

export function emptyStore(project = ''): EvalStore {
  return { schemaVersion: 1, project, tagBank: [], pages: {} }
}

export function getLineEval(store: EvalStore, folio: string, lineId: number): LineEval {
  return store.pages[folio]?.lines[String(lineId)] ?? emptyLineEval()
}

export function getPageEval(store: EvalStore, folio: string): PageEval {
  return store.pages[folio] ?? emptyPageEval()
}
