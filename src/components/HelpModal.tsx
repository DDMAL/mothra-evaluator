interface Props {
  onClose: () => void
}

const SHORTCUTS = [
  { key: '[ / ]', desc: 'Previous / next folio' },
  { key: '↑ / ↓  or  k / j', desc: 'Previous / next line' },
  { key: 'T', desc: 'Focus tag filter input' },
  { key: 'n  or  *', desc: 'Toggle noteworthy on selected line' },
  { key: 'C', desc: 'Mark / unmark page complete' },
  { key: 'Escape', desc: 'Deselect current line' },
  { key: 'L', desc: 'Toggle line ID labels' },
  { key: 'Cmd/Ctrl + Z', desc: 'Undo' },
  { key: 'Cmd/Ctrl + Shift + Z', desc: 'Redo' },
  { key: 'Scroll wheel', desc: 'Zoom image' },
  { key: 'Click + drag', desc: 'Pan image' },
  { key: 'Double-click', desc: 'Zoom in to point' },
]

export function HelpModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-600 rounded-lg w-96 max-h-[80vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100">Keyboard shortcuts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-xs">
            <tbody>
              {SHORTCUTS.map(({ key, desc }) => (
                <tr key={key} className="border-b border-gray-700 last:border-0">
                  <td className="py-2 pr-4 font-mono text-purple-300 whitespace-nowrap">{key}</td>
                  <td className="py-2 text-gray-300">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400 space-y-1.5">
            <p>
              <strong className="text-gray-200">Opening a project:</strong> Click "Open folder" and
              select your <code className="bg-gray-700 px-1 rounded">mothra-text</code> directory.
              The app reads segmentation JSON from{' '}
              <code className="bg-gray-700 px-1 rounded">outputs/kraken_blla/segmentation/</code>.
            </p>
            <p>
              <strong className="text-gray-200">Saving:</strong> Changes auto-save to{' '}
              <code className="bg-gray-700 px-1 rounded">evaluations.json</code> in your project
              folder. You can push this file to GitHub alongside your other outputs.
            </p>
            <p>
              <strong className="text-gray-200">Browser support:</strong> Chrome or Edge required
              (File System Access API). Safari is not supported.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
