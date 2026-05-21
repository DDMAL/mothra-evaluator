interface Props {
  folio: string | null
  saveStatus: 'saved' | 'saving' | 'unsaved'
  showLabels: boolean
  onOpenProject: () => void
  onToggleLabels: () => void
  onOpenTagBank: () => void
  onOpenHelp: () => void
  onExportCSV: () => void
  onExportJSON: () => void
}

export function TopBar({
  folio,
  saveStatus,
  showLabels,
  onOpenProject,
  onToggleLabels,
  onOpenTagBank,
  onOpenHelp,
  onExportCSV,
  onExportJSON,
}: Props) {
  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved' : 'Saved'
  const saveColor =
    saveStatus === 'saving'
      ? 'text-yellow-400'
      : saveStatus === 'unsaved'
        ? 'text-red-400'
        : 'text-green-400'

  return (
    <div className="h-12 flex items-center gap-3 px-4 bg-gray-800 border-b border-gray-700 shrink-0 select-none">
      {/* Wordmark */}
      <span className="text-sm font-semibold text-gray-100 tracking-wide mr-1">
        mothra-evaluator
      </span>

      <div className="h-4 w-px bg-gray-600" />

      {/* Open project */}
      <button
        onClick={onOpenProject}
        className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
      >
        Open folder
      </button>

      {/* Current folio */}
      {folio && (
        <span className="text-xs text-gray-400 truncate max-w-xs" title={folio}>
          {folio}
        </span>
      )}

      <div className="flex-1" />

      {/* Labels toggle */}
      <button
        onClick={onToggleLabels}
        title="Toggle line labels (L)"
        className={`px-2 py-1 text-xs rounded transition-colors ${
          showLabels
            ? 'bg-purple-700 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
      >
        Labels
      </button>

      {/* Tag bank */}
      <button
        onClick={onOpenTagBank}
        className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
      >
        Tags
      </button>

      {/* Export */}
      <div className="flex gap-1">
        <button
          onClick={onExportCSV}
          className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
        >
          Export CSV
        </button>
        <button
          onClick={onExportJSON}
          className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
        >
          Export JSON
        </button>
      </div>

      {/* Save status */}
      <span className={`text-xs font-medium min-w-14 text-right ${saveColor}`}>
        {saveLabel}
      </span>

      {/* Help */}
      <button
        onClick={onOpenHelp}
        className="w-6 h-6 flex items-center justify-center text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
        title="Help & keyboard shortcuts"
      >
        ?
      </button>
    </div>
  )
}
