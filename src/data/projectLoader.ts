import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { EvalStore } from '../types'
import { emptyStore } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl as string

export interface ProjectHandle {
  dirHandle: FileSystemDirectoryHandle
  folioStems: string[]   // sorted list of stems that have _kraken.json
}

/** Open a folder picker and scan for Kraken segmentation JSON files. */
export async function openProjectFolder(): Promise<ProjectHandle> {
  const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
  return loadProject(dirHandle)
}

export async function loadProject(dirHandle: FileSystemDirectoryHandle): Promise<ProjectHandle> {
  const stems: string[] = []

  try {
    const outputsHandle = await dirHandle.getDirectoryHandle('outputs')
    const krakenHandle = await outputsHandle.getDirectoryHandle('kraken_blla')
    const segHandle = await krakenHandle.getDirectoryHandle('segmentation')

    for await (const [name] of (segHandle as any).entries()) {
      if (name.endsWith('_kraken.json')) {
        stems.push(name.slice(0, -'_kraken.json'.length))
      }
    }
  } catch {
    // outputs/kraken_blla/segmentation doesn't exist yet
  }

  stems.sort()
  return { dirHandle, folioStems: stems }
}

/** Read a specific _kraken.json file. */
export async function readSegmentationJson(
  dirHandle: FileSystemDirectoryHandle,
  stem: string,
): Promise<unknown> {
  const outputsHandle = await dirHandle.getDirectoryHandle('outputs')
  const krakenHandle = await outputsHandle.getDirectoryHandle('kraken_blla')
  const segHandle = await krakenHandle.getDirectoryHandle('segmentation')
  const fileHandle = await segHandle.getFileHandle(`${stem}_kraken.json`)
  const file = await fileHandle.getFile()
  return JSON.parse(await file.text())
}

/** Try to load the folio image from data/folios/. Returns a blob URL. */
export async function loadImageUrl(
  dirHandle: FileSystemDirectoryHandle,
  stem: string,
): Promise<string> {
  const EXTS = ['jpg', 'jpeg', 'png', 'tif', 'tiff']

  try {
    const dataHandle = await dirHandle.getDirectoryHandle('data')
    const foliosHandle = await dataHandle.getDirectoryHandle('folios')

    for (const ext of EXTS) {
      try {
        const fh = await foliosHandle.getFileHandle(`${stem}.${ext}`)
        const file = await fh.getFile()
        return URL.createObjectURL(file)
      } catch {
        // try next extension
      }
    }
  } catch {
    // data/folios not found
  }

  // Fallback: the annotated visualization JPG (overlays pre-drawn)
  try {
    const outputsHandle = await dirHandle.getDirectoryHandle('outputs')
    const krakenHandle = await outputsHandle.getDirectoryHandle('kraken_blla')
    const fh = await krakenHandle.getFileHandle(`${stem}_kraken.jpg`)
    const file = await fh.getFile()
    return URL.createObjectURL(file)
  } catch {
    throw new Error(`Could not find image for folio: ${stem}`)
  }
}

/** Load evaluations.json from the project root, or return an empty store. */
export async function loadEvaluations(
  dirHandle: FileSystemDirectoryHandle,
): Promise<EvalStore> {
  try {
    const fh = await dirHandle.getFileHandle('evaluations.json')
    const file = await fh.getFile()
    return JSON.parse(await file.text()) as EvalStore
  } catch {
    return emptyStore(dirHandle.name)
  }
}

/** Write evaluations.json to the project root. */
export async function saveEvaluations(
  dirHandle: FileSystemDirectoryHandle,
  store: EvalStore,
): Promise<void> {
  const fh = await dirHandle.getFileHandle('evaluations.json', { create: true })
  const writable = await (fh as any).createWritable()
  await writable.write(JSON.stringify(store, null, 2))
  await writable.close()
}

export function isFsaSupported(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function'
}

/** Render an uploaded image or PDF file to a blob URL + pixel dimensions. */
export async function renderImageFile(
  file: File,
): Promise<{ url: string; width: number; height: number }> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    const pdfPage = await pdf.getPage(1)
    const viewport = pdfPage.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await pdfPage.render({ canvas, viewport }).promise
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve({ url: URL.createObjectURL(blob), width: viewport.width, height: viewport.height })
        else reject(new Error('Canvas toBlob failed'))
      }, 'image/png')
    })
  } else {
    const url = URL.createObjectURL(file)
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ url, width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
      img.src = url
    })
  }
}
