import { useState, useEffect, useCallback, useRef } from 'react'
import type { CanonicalPage, EvalStore, LineEval, Tag } from './types'
import { emptyStore, emptyLineEval, getPageEval } from './types'
import {
  openProjectFolder,
  loadEvaluations,
  saveEvaluations,
  readSegmentationJson,
  loadImageUrl,
  isFsaSupported,
} from './data/projectLoader'
import type { ProjectHandle } from './data/projectLoader'
import { adaptKrakenJson } from './data/segmentationAdapter'
import { toCSV, downloadString } from './data/exportUtils'
import { TopBar } from './components/TopBar'
import { ImageCanvas } from './components/ImageCanvas'
import { RightPanel } from './components/RightPanel'
import { TagBankManager } from './components/TagBankManager'
import { HelpModal } from './components/HelpModal'

type SaveStatus = 'saved' | 'saving' | 'unsaved'

function genId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export default function App() {
  const [project, setProject] = useState<ProjectHandle | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [page, setPage] = useState<CanonicalPage | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [loading, setLoading] = useState(false)
  const [store, setStore] = useState<EvalStore>(emptyStore())
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null)
  const [showLabels, setShowLabels] = useState(false)
  const [showTagBank, setShowTagBank] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState<string | null>(null)

  const undoStack = useRef<EvalStore[]>([])
  const redoStack = useRef<EvalStore[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevImageUrl = useRef<string | null>(null)

  // ── Save helpers ────────────────────────────────────────────────────────────

  const scheduleSave = useCallback(
    (updatedStore: EvalStore, dirHandle: FileSystemDirectoryHandle) => {
      setSaveStatus('unsaved')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          await saveEvaluations(dirHandle, updatedStore)
          setSaveStatus('saved')
        } catch {
          setSaveStatus('unsaved')
        }
      }, 600)
    },
    [],
  )

  // ── Store mutation helper ────────────────────────────────────────────────────

  const mutateStore = useCallback(
    (updater: (prev: EvalStore) => EvalStore) => {
      setStore(prev => {
        undoStack.current.push(prev)
        if (undoStack.current.length > 50) undoStack.current.shift()
        redoStack.current = []
        const next = updater(prev)
        if (project) scheduleSave(next, project.dirHandle)
        return next
      })
    },
    [project, scheduleSave],
  )

  // ── Open project ─────────────────────────────────────────────────────────────

  const openProject = useCallback(async () => {
    try {
      const handle = await openProjectFolder()
      if (handle.folioStems.length === 0) {
        setError('No Kraken segmentation JSON files found in outputs/kraken_blla/segmentation/. Run run_kraken.py first.')
        return
      }
      const evals = await loadEvaluations(handle.dirHandle)
      setProject(handle)
      setStore(evals)
      setCurrentIdx(0)
      setSelectedLineId(null)
      setError(null)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setError(String(e))
      }
    }
  }, [])

  // ── Navigate to folio ────────────────────────────────────────────────────────

  const gotoFolio = useCallback(
    async (idx: number) => {
      if (!project) return
      const stem = project.folioStems[idx]
      if (!stem) return

      setLoading(true)
      setSelectedLineId(null)

      // Revoke old blob URL
      if (prevImageUrl.current) {
        URL.revokeObjectURL(prevImageUrl.current)
        prevImageUrl.current = null
      }

      try {
        const raw = await readSegmentationJson(project.dirHandle, stem)
        const p = adaptKrakenJson(raw)
        setPage(p)

        const url = await loadImageUrl(project.dirHandle, stem)
        // Detect if we got the fallback (visualization JPG with overlays pre-drawn)
        const fallback = url.startsWith('blob:') && !(await isFolioImageAvailable(project.dirHandle, stem))
        setImageUrl(url)
        setIsFallback(fallback)
        prevImageUrl.current = url
      } catch (e) {
        setError(String(e))
      }

      setCurrentIdx(idx)
      setLoading(false)
    },
    [project],
  )

  // Load first folio when project opens
  useEffect(() => {
    if (project && project.folioStems.length > 0) {
      gotoFolio(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  // ── Evaluation updates ───────────────────────────────────────────────────────

  const updateLineEval = useCallback(
    (lineId: number, patch: Partial<LineEval>) => {
      const folio = page?.folio
      if (!folio) return
      mutateStore(prev => {
        const pageEval = { ...getPageEval(prev, folio) }
        const lineEval = { ...(pageEval.lines[String(lineId)] ?? emptyLineEval()) }
        Object.assign(lineEval, patch)
        lineEval.evaluatedAt = new Date().toISOString()
        pageEval.lines = { ...pageEval.lines, [String(lineId)]: lineEval }
        if (pageEval.status === 'untouched') pageEval.status = 'in_progress'
        return { ...prev, pages: { ...prev.pages, [folio]: pageEval } }
      })
    },
    [page, mutateStore],
  )

  const updatePageComment = useCallback(
    (comment: string) => {
      const folio = page?.folio
      if (!folio) return
      mutateStore(prev => {
        const pageEval = { ...getPageEval(prev, folio), comment }
        if (pageEval.status === 'untouched') pageEval.status = 'in_progress'
        return { ...prev, pages: { ...prev.pages, [folio]: pageEval } }
      })
    },
    [page, mutateStore],
  )

  const markComplete = useCallback(() => {
    const folio = page?.folio
    if (!folio) return
    mutateStore(prev => {
      const pageEval = { ...getPageEval(prev, folio) }
      if (pageEval.status === 'complete') {
        pageEval.status = 'in_progress'
        pageEval.completedAt = null
      } else {
        pageEval.status = 'complete'
        pageEval.completedAt = new Date().toISOString()
      }
      return { ...prev, pages: { ...prev.pages, [folio]: pageEval } }
    })
  }, [page, mutateStore])

  // ── Tag bank mutations ───────────────────────────────────────────────────────

  const addTag = useCallback(
    (name: string, color: string) => {
      mutateStore(prev => ({
        ...prev,
        tagBank: [...prev.tagBank, { id: genId(), name, color, archived: false }],
      }))
    },
    [mutateStore],
  )

  const renameTag = useCallback(
    (id: string, name: string) => {
      mutateStore(prev => ({
        ...prev,
        tagBank: prev.tagBank.map(t => (t.id === id ? { ...t, name } : t)),
      }))
    },
    [mutateStore],
  )

  const archiveTag = useCallback(
    (id: string) => {
      mutateStore(prev => ({
        ...prev,
        tagBank: prev.tagBank.map(t => (t.id === id ? { ...t, archived: true } : t)),
      }))
    },
    [mutateStore],
  )

  const unarchiveTag = useCallback(
    (id: string) => {
      mutateStore(prev => ({
        ...prev,
        tagBank: prev.tagBank.map(t => (t.id === id ? { ...t, archived: false } : t)),
      }))
    },
    [mutateStore],
  )

  const setTagColor = useCallback(
    (id: string, color: string) => {
      mutateStore(prev => ({
        ...prev,
        tagBank: prev.tagBank.map((t: Tag) => (t.id === id ? { ...t, color } : t)),
      }))
    },
    [mutateStore],
  )

  // ── Undo / redo ──────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    setStore(current => {
      redoStack.current.push(current)
      if (project) scheduleSave(prev, project.dirHandle)
      return prev
    })
  }, [project, scheduleSave])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    setStore(current => {
      undoStack.current.push(current)
      if (project) scheduleSave(next, project.dirHandle)
      return next
    })
  }, [project, scheduleSave])

  // ── Export ───────────────────────────────────────────────────────────────────

  const exportCSV = useCallback(() => {
    downloadString(toCSV(store), 'evaluations.csv', 'text/csv')
  }, [store])

  const exportJSON = useCallback(() => {
    downloadString(JSON.stringify(store, null, 2), 'evaluations.json', 'application/json')
  }, [store])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    const stems = project?.folioStems ?? []

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      if (inInput) return

      if (e.key === '[') {
        if (currentIdx > 0) gotoFolio(currentIdx - 1)
      } else if (e.key === ']') {
        if (currentIdx < stems.length - 1) gotoFolio(currentIdx + 1)
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        if (page && selectedLineId !== null) {
          const idx = page.lines.findIndex(l => l.id === selectedLineId)
          if (idx > 0) setSelectedLineId(page.lines[idx - 1].id)
        } else if (page && page.lines.length > 0) {
          setSelectedLineId(page.lines[page.lines.length - 1].id)
        }
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        if (page && selectedLineId !== null) {
          const idx = page.lines.findIndex(l => l.id === selectedLineId)
          if (idx < page.lines.length - 1) setSelectedLineId(page.lines[idx + 1].id)
        } else if (page && page.lines.length > 0) {
          setSelectedLineId(page.lines[0].id)
        }
      } else if (e.key === 'Escape') {
        setSelectedLineId(null)
      } else if (e.key === 'n' || e.key === '*') {
        if (selectedLineId !== null) {
          const folio = page?.folio
          if (folio) {
            const cur = store.pages[folio]?.lines[String(selectedLineId)]?.noteworthy ?? false
            updateLineEval(selectedLineId, { noteworthy: !cur })
          }
        }
      } else if (e.key === 'c' || e.key === 'C') {
        markComplete()
      } else if (e.key === 'l' || e.key === 'L') {
        setShowLabels(v => !v)
      } else if (e.key === '?') {
        setShowHelp(v => !v)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [project, currentIdx, page, selectedLineId, store, gotoFolio, updateLineEval, markComplete, undo, redo])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!isFsaSupported()) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-gray-100 p-8">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-lg font-medium">Browser not supported</p>
          <p className="text-sm text-gray-400">
            mothra-evaluator requires the File System Access API, available in Chrome 86+ and Edge 86+. Safari is not supported.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
      <TopBar
        folio={page?.folio ?? null}
        saveStatus={saveStatus}
        showLabels={showLabels}
        onOpenProject={openProject}
        onToggleLabels={() => setShowLabels(v => !v)}
        onOpenTagBank={() => setShowTagBank(true)}
        onOpenHelp={() => setShowHelp(true)}
        onExportCSV={exportCSV}
        onExportJSON={exportJSON}
      />

      {!project ? (
        <WelcomeScreen onOpen={openProject} error={error} />
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Loading…
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <ImageCanvas
            page={page}
            imageUrl={imageUrl}
            isFallbackImage={isFallback}
            selectedLineId={selectedLineId}
            showLabels={showLabels}
            onSelectLine={setSelectedLineId}
          />
          <RightPanel
            folioStems={project.folioStems}
            currentIdx={currentIdx}
            page={page}
            store={store}
            selectedLineId={selectedLineId}
            onGoto={gotoFolio}
            onSelectLine={setSelectedLineId}
            onUpdateLineEval={updateLineEval}
            onUpdatePageComment={updatePageComment}
            onMarkComplete={markComplete}
            onExportCSV={exportCSV}
            onExportJSON={exportJSON}
          />
        </div>
      )}

      {showTagBank && (
        <TagBankManager
          tags={store.tagBank}
          onClose={() => setShowTagBank(false)}
          onAddTag={addTag}
          onRenameTag={renameTag}
          onArchiveTag={archiveTag}
          onUnarchiveTag={unarchiveTag}
          onSetTagColor={setTagColor}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}

function WelcomeScreen({ onOpen, error }: { onOpen: () => void; error: string | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 gap-6 p-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-gray-100">mothra-evaluator</h1>
        <p className="text-sm text-gray-400 max-w-xs">
          Evaluate Kraken line segmentation on manuscript folios. Open your{' '}
          <code className="bg-gray-700 px-1 rounded text-xs">mothra-text</code> project folder to begin.
        </p>
      </div>
      <button
        onClick={onOpen}
        className="px-6 py-2.5 bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Open project folder
      </button>
      {error && (
        <p className="text-xs text-red-400 max-w-sm text-center">{error}</p>
      )}
      <p className="text-xs text-gray-600 max-w-xs text-center">
        Requires Chrome or Edge. The folder picker will ask for read/write permission
        so evaluations can be saved automatically.
      </p>
    </div>
  )
}

async function isFolioImageAvailable(
  dirHandle: FileSystemDirectoryHandle,
  stem: string,
): Promise<boolean> {
  const EXTS = ['jpg', 'jpeg', 'png', 'tif', 'tiff']
  try {
    const dataHandle = await dirHandle.getDirectoryHandle('data')
    const foliosHandle = await dataHandle.getDirectoryHandle('folios')
    for (const ext of EXTS) {
      try {
        await foliosHandle.getFileHandle(`${stem}.${ext}`)
        return true
      } catch { /* try next */ }
    }
  } catch { /* no data/folios */ }
  return false
}
