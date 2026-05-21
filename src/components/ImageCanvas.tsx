import { useEffect, useRef } from 'react'
import OpenSeadragon from 'openseadragon'
import type { CanonicalLine, CanonicalPage, LineEval, Tag } from '../types'

interface Props {
  page: CanonicalPage | null
  imageUrl: string | null
  isFallbackImage: boolean  // true = visualization JPG with overlays already baked in
  selectedLineId: number | null
  showLabels: boolean
  lineEvals: Record<string, LineEval>
  tagBank: Tag[]
  onSelectLine: (id: number | null) => void
}

const LINE_COLOR = 'rgba(180, 60, 255, 0.15)'
const LINE_STROKE = 'rgb(180, 60, 255)'
const SEL_COLOR = 'rgba(220, 100, 255, 0.40)'
const SEL_STROKE = 'rgb(240, 140, 255)'
const LABEL_COLOR = '#e9b8ff'

export function ImageCanvas({ page, imageUrl, isFallbackImage, selectedLineId, showLabels, lineEvals, tagBank, onSelectLine }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null)
  const polyMapRef = useRef<Map<number, SVGPolygonElement>>(new Map())
  const labelMapRef = useRef<Map<number, SVGTextElement>>(new Map())
  const tagDotMapRef = useRef<Map<number, SVGGElement>>(new Map())
  const selRef = useRef<number | null>(selectedLineId)
  const linesRef = useRef<CanonicalLine[]>([])
  const lineEvalsRef = useRef<Record<string, LineEval>>(lineEvals)
  const tagBankRef = useRef<Tag[]>(tagBank)

  // Keep linesRef current so canvas-click handler never uses stale lines
  useEffect(() => {
    linesRef.current = page?.lines ?? []
  }, [page])

  // Keep selRef in sync
  useEffect(() => {
    selRef.current = selectedLineId
    updateStyles()
  }, [selectedLineId])

  // Update polygon colors and tag dots when evals or tags change
  useEffect(() => {
    lineEvalsRef.current = lineEvals
    tagBankRef.current = tagBank
    updateStyles()
    updateTagDots()
    if (viewerRef.current) repositionTagDots(viewerRef.current)
  }, [lineEvals, tagBank])

  function updateStyles() {
    polyMapRef.current.forEach((poly, id) => {
      const sel = id === selRef.current
      if (sel) {
        poly.setAttribute('fill', SEL_COLOR)
        poly.setAttribute('stroke', SEL_STROKE)
        poly.setAttribute('stroke-width', '2.5')
        poly.setAttribute('stroke-dasharray', 'none')
        return
      }
      const eval_ = lineEvalsRef.current[String(id)]
      poly.setAttribute('fill', LINE_COLOR)
      poly.setAttribute('stroke', LINE_STROKE)
      poly.setAttribute('stroke-width', '1.5')
      poly.setAttribute('stroke-dasharray', eval_?.noteworthy ? '6 3' : 'none')
    })
  }

  function updateTagDots() {
    tagDotMapRef.current.forEach((group, id) => {
      while (group.firstChild) group.removeChild(group.firstChild)
      const tagIds = lineEvalsRef.current[String(id)]?.tags ?? []
      tagIds.forEach(tagId => {
        const tag = tagBankRef.current.find(t => t.id === tagId)
        if (!tag) return
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('r', '5')
        circle.setAttribute('fill', tag.color)
        circle.setAttribute('stroke', 'rgba(0,0,0,0.4)')
        circle.setAttribute('stroke-width', '1')
        circle.style.pointerEvents = 'none'
        group.appendChild(circle)
      })
    })
  }

  function repositionTagDots(viewer: OpenSeadragon.Viewer) {
    if (!viewer.viewport) return
    const vp = viewer.viewport
    linesRef.current.forEach(line => {
      if (!line.boundary) return
      const group = tagDotMapRef.current.get(line.id)
      if (!group) return
      const minX = Math.min(...line.boundary.map(([x]) => x))
      const minY = Math.min(...line.boundary.map(([, y]) => y))
      const vpt = vp.imageToViewportCoordinates(new OpenSeadragon.Point(minX, minY))
      const el = vp.viewportToViewerElementCoordinates(vpt)
      const circles = Array.from(group.children) as SVGCircleElement[]
      circles.forEach((circle, i) => {
        circle.setAttribute('cx', String(el.x + 5 + i * 12))
        circle.setAttribute('cy', String(el.y + 5))
      })
    })
  }

  function rebuildOverlay(lines: CanonicalLine[]) {
    const svg = svgRef.current
    if (!svg) return

    while (svg.firstChild) svg.removeChild(svg.firstChild)
    polyMapRef.current.clear()
    labelMapRef.current.clear()
    tagDotMapRef.current.clear()

    lines.forEach(line => {
      if (!line.boundary) return

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
      poly.setAttribute('fill', LINE_COLOR)
      poly.setAttribute('stroke', LINE_STROKE)
      poly.setAttribute('stroke-width', '1.5')
      poly.style.pointerEvents = 'none'
      svg.appendChild(poly)
      polyMapRef.current.set(line.id, poly)

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('font-size', '11')
      label.setAttribute('fill', LABEL_COLOR)
      label.setAttribute('font-family', 'ui-monospace, monospace')
      label.style.pointerEvents = 'none'
      label.style.display = showLabels ? '' : 'none'
      label.textContent = String(line.id)
      svg.appendChild(label)
      labelMapRef.current.set(line.id, label)

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.style.pointerEvents = 'none'
      svg.appendChild(group)
      tagDotMapRef.current.set(line.id, group)
    })
  }

  function repositionOverlay(viewer: OpenSeadragon.Viewer, lines: CanonicalLine[]) {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container || !viewer.viewport) return

    const vp = viewer.viewport
    const rect = container.getBoundingClientRect()
    svg.setAttribute('width', String(rect.width))
    svg.setAttribute('height', String(rect.height))

    lines.forEach(line => {
      if (!line.boundary) return
      const poly = polyMapRef.current.get(line.id)
      if (!poly) return

      const pts = line.boundary
        .map(([x, y]) => {
          const vpt = vp.imageToViewportCoordinates(new OpenSeadragon.Point(x, y))
          const el = vp.viewportToViewerElementCoordinates(vpt)
          return `${el.x},${el.y}`
        })
        .join(' ')
      poly.setAttribute('points', pts)

      const label = labelMapRef.current.get(line.id)
      if (label) {
        // Position label at top-left of boundary bbox
        const first = line.boundary[0]
        const vpt = vp.imageToViewportCoordinates(new OpenSeadragon.Point(first[0], first[1]))
        const el = vp.viewportToViewerElementCoordinates(vpt)
        label.setAttribute('x', String(el.x + 2))
        label.setAttribute('y', String(el.y - 2))
      }
    })

    updateStyles()
    repositionTagDots(viewer)
  }

  // Initialize / reinitialize OSD when image changes
  useEffect(() => {
    if (!containerRef.current || !imageUrl) return

    if (viewerRef.current) {
      viewerRef.current.destroy()
      viewerRef.current = null
    }

    const viewer = OpenSeadragon({
      element: containerRef.current,
      tileSources: { type: 'image', url: imageUrl },
      showNavigationControl: false,
      gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
      gestureSettingsTouch: { clickToZoom: false },
      animationTime: 0.3,
      immediateRender: false,
    })
    viewerRef.current = viewer

    if (!isFallbackImage) {
      rebuildOverlay(linesRef.current)

      viewer.addHandler('open', () => repositionOverlay(viewer, linesRef.current))
      viewer.addHandler('update-viewport', () => repositionOverlay(viewer, linesRef.current))
      viewer.addHandler('resize', () => repositionOverlay(viewer, linesRef.current))

      viewer.addHandler('canvas-click', (event: OpenSeadragon.CanvasClickEvent) => {
        if (!event.quick) return
        const imagePoint = viewer.viewport.viewerElementToImageCoordinates(event.position)
        let clickedId: number | null = null
        for (const line of linesRef.current) {
          if (!line.boundary) continue
          if (pointInPolygon(imagePoint.x, imagePoint.y, line.boundary)) {
            clickedId = line.id
            break
          }
        }
        onSelectLine(clickedId)
      })
    }

    return () => {
      viewer.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl])

  // Update label visibility without reinitializing OSD
  useEffect(() => {
    labelMapRef.current.forEach(label => {
      label.style.display = showLabels ? '' : 'none'
    })
  }, [showLabels])

  if (!imageUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900 text-gray-500 text-sm">
        Select a folio from the panel →
      </div>
    )
  }

  return (
    <div className="flex-1 relative bg-gray-900 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      {!isFallbackImage && (
        <svg
          ref={svgRef}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      )}
      {isFallbackImage && (
        <div className="absolute bottom-3 left-3 bg-gray-900/80 text-yellow-400 text-xs px-2 py-1 rounded">
          PDF folio — showing pre-rendered visualization
        </div>
      )}
    </div>
  )
}

function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}
