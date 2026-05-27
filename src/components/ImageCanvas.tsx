import { useEffect, useRef } from 'react'
import OpenSeadragon from 'openseadragon'
import type { CanonicalLine, CanonicalPage, LineEval, Tag } from '../types'

interface Props {
  page: CanonicalPage | null
  imageUrl: string | null
  isFallbackImage: boolean  // true = visualization JPG with overlays already baked in
  selectedLineIds: number[]
  showLabels: boolean
  lineEvals: Record<string, LineEval>
  tagBank: Tag[]
  onSelectLines: (ids: number[]) => void
}

const LINE_COLOR = 'rgba(180, 60, 255, 0.15)'
const LINE_STROKE = 'rgb(180, 60, 255)'
const SEL_COLOR = 'rgba(220, 100, 255, 0.40)'
const SEL_STROKE = 'rgb(240, 140, 255)'
const LABEL_COLOR = '#e9b8ff'

export function ImageCanvas({ page, imageUrl, isFallbackImage, selectedLineIds, showLabels, lineEvals, tagBank, onSelectLines }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null)
  const polyMapRef = useRef<Map<number, SVGPolygonElement>>(new Map())
  const labelMapRef = useRef<Map<number, SVGTextElement>>(new Map())
  const tagDotMapRef = useRef<Map<number, SVGGElement>>(new Map())
  const selRef = useRef<Set<number>>(new Set())
  const linesRef = useRef<CanonicalLine[]>([])
  const lineEvalsRef = useRef<Record<string, LineEval>>(lineEvals)
  const tagBankRef = useRef<Tag[]>(tagBank)
  const dragAnchorRef = useRef<{ x: number; y: number } | null>(null)
  const rubberBandRef = useRef<SVGRectElement | null>(null)

  // Keep linesRef current so canvas-click handler never uses stale lines
  useEffect(() => {
    linesRef.current = page?.lines ?? []
  }, [page])

  // Keep selRef in sync
  useEffect(() => {
    selRef.current = new Set(selectedLineIds)
    updateStyles()
  }, [selectedLineIds])

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
      const sel = selRef.current.has(id)
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
        circle.setAttribute('opacity', '0.5')
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
        circle.setAttribute('cy', String(el.y - 3))
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

    // Rubber-band selection rectangle (hidden until shift+drag)
    const rb = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rb.setAttribute('fill', 'rgba(180,60,255,0.08)')
    rb.setAttribute('stroke', 'rgb(180,60,255)')
    rb.setAttribute('stroke-width', '1.5')
    rb.setAttribute('stroke-dasharray', '4 3')
    rb.style.display = 'none'
    rb.style.pointerEvents = 'none'
    svg.appendChild(rb)
    rubberBandRef.current = rb
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
      updateTagDots()

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
        onSelectLines(clickedId !== null ? [clickedId] : [])
      })

      // Shift+drag rubber-band multi-select
      const el = containerRef.current!

      const onMouseDown = (e: MouseEvent) => {
        if (!e.shiftKey) return
        e.preventDefault()
        if (!viewer.viewport) return
        const pt = viewer.viewport.viewerElementToImageCoordinates(
          new OpenSeadragon.Point(e.offsetX, e.offsetY)
        )
        dragAnchorRef.current = { x: pt.x, y: pt.y }
        const rb = rubberBandRef.current
        if (rb) {
          rb.style.display = ''
          rb.setAttribute('x', String(e.offsetX))
          rb.setAttribute('y', String(e.offsetY))
          rb.setAttribute('width', '0')
          rb.setAttribute('height', '0')
        }
      }

      const onMouseMove = (e: MouseEvent) => {
        if (!dragAnchorRef.current || !rubberBandRef.current || !viewer.viewport) return
        const anchor = viewer.viewport.imageToViewerElementCoordinates(
          new OpenSeadragon.Point(dragAnchorRef.current.x, dragAnchorRef.current.y)
        )
        const rb = rubberBandRef.current
        const x = Math.min(anchor.x, e.offsetX)
        const y = Math.min(anchor.y, e.offsetY)
        rb.setAttribute('x', String(x))
        rb.setAttribute('y', String(y))
        rb.setAttribute('width', String(Math.abs(e.offsetX - anchor.x)))
        rb.setAttribute('height', String(Math.abs(e.offsetY - anchor.y)))
      }

      const onMouseUp = (e: MouseEvent) => {
        if (!dragAnchorRef.current) return
        const anchor = dragAnchorRef.current
        dragAnchorRef.current = null
        if (rubberBandRef.current) rubberBandRef.current.style.display = 'none'
        if (!viewer.viewport) return

        const pt = viewer.viewport.viewerElementToImageCoordinates(
          new OpenSeadragon.Point(e.offsetX, e.offsetY)
        )
        const x1 = Math.min(anchor.x, pt.x), x2 = Math.max(anchor.x, pt.x)
        const y1 = Math.min(anchor.y, pt.y), y2 = Math.max(anchor.y, pt.y)
        // Ignore tiny drags (treat as clicks, handled by canvas-click)
        if (x2 - x1 < 5 && y2 - y1 < 5) return

        const hit: number[] = []
        for (const line of linesRef.current) {
          if (!line.boundary) continue
          const xs = line.boundary.map(([x]) => x)
          const ys = line.boundary.map(([, y]) => y)
          if (rectsOverlap(x1, y1, x2, y2, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)))
            hit.push(line.id)
        }
        if (hit.length > 0) onSelectLines(hit)
      }

      el.addEventListener('mousedown', onMouseDown)
      el.addEventListener('mousemove', onMouseMove)
      el.addEventListener('mouseup', onMouseUp)

      return () => {
        el.removeEventListener('mousedown', onMouseDown)
        el.removeEventListener('mousemove', onMouseMove)
        el.removeEventListener('mouseup', onMouseUp)
        viewer.destroy()
      }
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

function rectsOverlap(ax1: number, ay1: number, ax2: number, ay2: number, bx1: number, by1: number, bx2: number, by2: number): boolean {
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1
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
