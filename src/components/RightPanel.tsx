import { useState, useRef, useEffect } from 'react'
import type { CanonicalPage, EvalStore, Tag, LineEval, PageEval } from '../types'
import { getLineEval, getPageEval, emptyLineEval } from '../types'

interface Props {
  folioStems: string[]
  currentIdx: number
  page: CanonicalPage | null
  store: EvalStore
  selectedLineIds: number[]
  onGoto: (idx: number) => void
  onClearSelection: () => void
  onUpdateLineEval: (lineId: number, patch: Partial<LineEval>) => void
  onUpdatePageComment: (comment: string) => void
  onMarkComplete: () => void
  onExportCSV: () => void
  onExportJSON: () => void
}

export function RightPanel({
  folioStems,
  currentIdx,
  page,
  store,
  selectedLineIds,
  onGoto,
  onClearSelection,
  onUpdateLineEval,
  onUpdatePageComment,
  onMarkComplete,
  onExportCSV,
  onExportJSON,
}: Props) {
  const folio = page?.folio ?? null
  const pageEval: PageEval = folio ? getPageEval(store, folio) : { status: 'untouched', comment: '', completedAt: null, lines: {} }

  const singleId = selectedLineIds.length === 1 ? selectedLineIds[0] : null
  const lineEval: LineEval = (folio && singleId !== null) ? getLineEval(store, folio, singleId) : emptyLineEval()

  const totalLines = page?.lines.length ?? 0
  const evaluatedCount = Object.values(pageEval.lines).filter(l => l.tags.length > 0 || l.comment).length

  // Tags present on ALL selected lines (intersection) — used for multi-select TagPicker
  const commonTagIds: string[] = folio && selectedLineIds.length > 1
    ? store.tagBank
        .filter(t => !t.archived)
        .map(t => t.id)
        .filter(id => selectedLineIds.every(lid => getLineEval(store, folio, lid).tags.includes(id)))
    : []

  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const el = listRef.current?.children[currentIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [currentIdx])

  const statusColor = (stem: string) => {
    const s = store.pages[stem]?.status
    if (s === 'complete') return 'text-green-400'
    if (s === 'in_progress') return 'text-yellow-400'
    return 'text-gray-500'
  }

  return (
    <div className="w-72 flex flex-col bg-gray-800 border-l border-gray-700 shrink-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Page navigator */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Folio</h3>
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => onGoto(Math.max(0, currentIdx - 1))}
              disabled={currentIdx <= 0}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-gray-200 rounded"
            >
              ‹
            </button>
            <span className="flex-1 text-center text-xs text-gray-300 truncate px-1">
              {folioStems[currentIdx] ?? '—'}
            </span>
            <button
              onClick={() => onGoto(Math.min(folioStems.length - 1, currentIdx + 1))}
              disabled={currentIdx >= folioStems.length - 1}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-gray-200 rounded"
            >
              ›
            </button>
          </div>
          <ul ref={listRef} className="max-h-48 overflow-y-auto rounded border border-gray-600 bg-gray-700 divide-y divide-gray-600/50">
            {folioStems.map((stem, i) => {
              const s = store.pages[stem]?.status
              const dotColor = s === 'complete' ? '#4ade80' : s === 'in_progress' ? '#facc15' : '#6b7280'
              const icon = s === 'complete' ? '✓' : s === 'in_progress' ? '•' : '○'
              const isCurrent = i === currentIdx
              return (
                <li key={stem}>
                  <button
                    onClick={() => onGoto(i)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                      isCurrent
                        ? 'bg-purple-700/50 text-gray-100'
                        : 'text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="flex-1 text-xs truncate">{stem}</span>
                    <span className="text-xs shrink-0" style={{ color: dotColor }}>{icon}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Line judgment panel */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Line judgment
            {singleId !== null && (
              <span className="ml-1 text-gray-500 normal-case font-normal">
                — line {singleId}
              </span>
            )}
            {selectedLineIds.length > 1 && (
              <span className="ml-1 text-gray-500 normal-case font-normal">
                — {selectedLineIds.length} lines
              </span>
            )}
          </h3>

          {selectedLineIds.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Click a line on the image to evaluate it.</p>
          ) : selectedLineIds.length === 1 ? (
            <div className="space-y-2">
              <TagPicker
                tags={store.tagBank.filter(t => !t.archived)}
                selected={lineEval.tags}
                onChange={tags => onUpdateLineEval(singleId!, { tags })}
              />

              <textarea
                value={lineEval.comment}
                onChange={e => onUpdateLineEval(singleId!, { comment: e.target.value })}
                placeholder="Comment on this line…"
                rows={3}
                className="w-full text-xs bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1.5 resize-none placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />

              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={lineEval.noteworthy}
                  onChange={e => onUpdateLineEval(singleId!, { noteworthy: e.target.checked })}
                  className="accent-purple-400"
                />
                Noteworthy ★
              </label>

              <button
                onClick={onClearSelection}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Deselect line
              </button>
            </div>
          ) : (
            // Multi-select panel: tags only, applied to all selected lines
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Tags highlighted below are on <em>all</em> selected lines. Clicking a tag adds or removes it from all.
              </p>
              <TagPicker
                tags={store.tagBank.filter(t => !t.archived)}
                selected={commonTagIds}
                onChange={newCommon => {
                  const added = newCommon.find(t => !commonTagIds.includes(t))
                  const removed = commonTagIds.find(t => !newCommon.includes(t))
                  selectedLineIds.forEach(lid => {
                    const cur = getLineEval(store, folio!, lid).tags
                    if (added && !cur.includes(added)) {
                      onUpdateLineEval(lid, { tags: [...cur, added] })
                    } else if (removed) {
                      onUpdateLineEval(lid, { tags: cur.filter(t => t !== removed) })
                    }
                  })
                }}
              />
              <button
                onClick={onClearSelection}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}
        </section>

        {/* Page comment */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Page comment</h3>
          <textarea
            value={pageEval.comment}
            onChange={e => onUpdatePageComment(e.target.value)}
            placeholder="Notes about this page…"
            rows={3}
            className="w-full text-xs bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1.5 resize-none placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </section>

        {/* Page summary */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Page summary</h3>
          <div className="space-y-1 text-xs text-gray-300 mb-3">
            <div className="flex justify-between">
              <span>Lines evaluated</span>
              <span>{evaluatedCount} / {totalLines}</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className={statusColor(folio ?? '')}>
                {pageEval.status}
              </span>
            </div>
            {/* Tag breakdown */}
            {store.tagBank.filter(t => !t.archived).map(tag => {
              const count = Object.values(pageEval.lines).filter(l => l.tags.includes(tag.id)).length
              if (count === 0) return null
              return (
                <div key={tag.id} className="flex justify-between">
                  <span style={{ color: tag.color }}>{tag.name}</span>
                  <span>{count}</span>
                </div>
              )
            })}
          </div>

          <button
            onClick={onMarkComplete}
            className={`w-full py-1.5 text-xs rounded font-medium transition-colors ${
              pageEval.status === 'complete'
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
            }`}
          >
            {pageEval.status === 'complete' ? '✓ Completed' : 'Mark page complete (C)'}
          </button>
        </section>

      </div>

      {/* Export footer */}
      <div className="p-3 border-t border-gray-700 space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Export</h3>
        <div className="flex gap-2">
          <button
            onClick={onExportCSV}
            className="flex-1 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            Download CSV
          </button>
          <button
            onClick={onExportJSON}
            className="flex-1 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            Download JSON
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TagPicker ─────────────────────────────────────────────────────────────────

interface TagPickerProps {
  tags: Tag[]
  selected: string[]
  onChange: (ids: string[]) => void
}

function TagPicker({ tags, selected, onChange }: TagPickerProps) {
  const [input, setInput] = useState('')

  const filtered = tags.filter(t =>
    !input || t.name.toLowerCase().includes(input.toLowerCase()),
  )

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {filtered.map(tag => (
          <button
            key={tag.id}
            onClick={() => toggle(tag.id)}
            className={`px-2 py-0.5 rounded text-xs border transition-colors ${
              selected.includes(tag.id)
                ? 'border-transparent text-white'
                : 'border-gray-600 text-gray-400 bg-gray-700 hover:border-gray-500'
            }`}
            style={selected.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
          >
            {tag.name}
          </button>
        ))}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && input.trim()) {
            // Creating new tags is handled via the tag bank manager
            setInput('')
          }
        }}
        placeholder="Filter tags…"
        className="w-full text-xs bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 placeholder-gray-500 focus:outline-none focus:border-purple-500"
      />
      {input && filtered.length === 0 && (
        <p className="text-xs text-gray-500 mt-1">No tags match. Open Tags to create one.</p>
      )}
    </div>
  )
}
