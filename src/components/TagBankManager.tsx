import { useState } from 'react'
import type { Tag } from '../types'

interface Props {
  tags: Tag[]
  onClose: () => void
  onAddTag: (name: string, color: string) => void
  onRenameTag: (id: string, name: string) => void
  onArchiveTag: (id: string) => void
  onUnarchiveTag: (id: string) => void
  onSetTagColor: (id: string, color: string) => void
}

const PRESET_COLORS = [
  '#a855f7', '#22c55e', '#3b82f6', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
]

export function TagBankManager({ tags, onClose, onAddTag, onRenameTag, onArchiveTag, onUnarchiveTag, onSetTagColor }: Props) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const active = tags.filter(t => !t.archived)
  const archived = tags.filter(t => t.archived)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-600 rounded-lg w-96 max-h-[80vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100">Tag bank</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Add new tag */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">New tag</h3>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newName.trim()) {
                    onAddTag(newName.trim(), newColor)
                    setNewName('')
                  }
                }}
                placeholder="Tag name…"
                className="flex-1 text-xs bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1.5 placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={() => {
                  if (newName.trim()) {
                    onAddTag(newName.trim(), newColor)
                    setNewName('')
                  }
                }}
                className="px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 text-white rounded"
              >
                Add
              </button>
            </div>
            {/* Color picker */}
            <div className="flex gap-1.5 mt-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    newColor === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Active tags */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Tags ({active.length})
            </h3>
            {active.length === 0 && (
              <p className="text-xs text-gray-500 italic">No tags yet.</p>
            )}
            <ul className="space-y-1">
              {active.map(tag => (
                <li key={tag.id} className="flex items-center gap-2">
                  {/* Color dot */}
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />

                  {editingId === tag.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => {
                        if (editName.trim()) onRenameTag(tag.id, editName.trim())
                        setEditingId(null)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (editName.trim()) onRenameTag(tag.id, editName.trim())
                          setEditingId(null)
                        }
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 text-xs bg-gray-600 border border-purple-500 text-gray-100 rounded px-2 py-0.5 focus:outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 text-xs text-gray-200 cursor-pointer hover:text-white"
                      onClick={() => { setEditingId(tag.id); setEditName(tag.name) }}
                    >
                      {tag.name}
                    </span>
                  )}

                  {/* Color change */}
                  <div className="flex gap-0.5">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => onSetTagColor(tag.id, c)}
                        className={`w-3 h-3 rounded-full border ${
                          tag.color === c ? 'border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => onArchiveTag(tag.id)}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                    title="Archive tag"
                  >
                    Archive
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Archived tags */}
          {archived.length > 0 && (
            <div>
              <button
                onClick={() => setShowArchived(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showArchived ? '▾' : '▸'} Archived ({archived.length})
              </button>
              {showArchived && (
                <ul className="mt-2 space-y-1">
                  {archived.map(tag => (
                    <li key={tag.id} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full opacity-40 shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 text-xs text-gray-500 line-through">{tag.name}</span>
                      <button
                        onClick={() => onUnarchiveTag(tag.id)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
