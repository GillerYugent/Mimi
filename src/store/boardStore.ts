import { create } from 'zustand'
import type { Canvas, CanvasElement } from '@/types'
import { boardsApi } from '@/api/boards'
import { uid } from '@/utils/id'

interface Scope {
  projectId?: string
  mySpaceId?: string
}

interface BoardState {
  canvases: Record<string, Canvas>
  byScope: Record<string, string[]>

  loadList: (scope: Scope) => Promise<Canvas[]>
  loadOne: (id: string) => Promise<Canvas | undefined>

  createCanvas: (input: { title?: string; projectId?: string; mySpaceId?: string }) => Promise<Canvas>
  renameCanvas: (id: string, title: string) => Promise<void>
  deleteCanvas: (id: string) => Promise<void>

  // Element operations: optimistic + debounced PATCH целого elements-массива.
  addElement: (canvasId: string, element: Omit<CanvasElement, 'id'>) => CanvasElement
  updateElement: (canvasId: string, elementId: string, updates: Partial<CanvasElement>) => void
  deleteElement: (canvasId: string, elementId: string) => void
  setElements: (canvasId: string, elements: CanvasElement[]) => void

  // Принудительный сохранитель — полезен на blur / unmount.
  flush: (canvasId: string) => Promise<void>

  // Selectors
  getCanvas: (id: string) => Canvas | undefined
  list: (scope: Scope) => Canvas[]

  reset: () => void
}

const SAVE_DEBOUNCE_MS = 600

function scopeKey(s: Scope): string {
  return s.projectId ? `p:${s.projectId}` : s.mySpaceId ? `m:${s.mySpaceId}` : 'none'
}

const pendingTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const pendingElements: Record<string, CanvasElement[]> = {}

export const useBoards = create<BoardState>((set, get) => {
  async function flushNow(canvasId: string) {
    const elements = pendingElements[canvasId]
    if (!elements) return
    delete pendingElements[canvasId]
    clearTimeout(pendingTimers[canvasId])
    delete pendingTimers[canvasId]
    try {
      await boardsApi.update(canvasId, { elements })
    } catch {
      // оставляем локальные изменения; пользователь не теряет данных
    }
  }

  function scheduleSave(canvasId: string, elements: CanvasElement[]) {
    pendingElements[canvasId] = elements
    clearTimeout(pendingTimers[canvasId])
    pendingTimers[canvasId] = setTimeout(() => {
      void flushNow(canvasId)
    }, SAVE_DEBOUNCE_MS)
  }

  return {
    canvases: {},
    byScope: {},

    loadList: async (scope) => {
      const list = await boardsApi.list({ projectId: scope.projectId, mySpaceId: scope.mySpaceId })
      const next = { ...get().canvases }
      for (const c of list) next[c.id] = c
      set({
        canvases: next,
        byScope: { ...get().byScope, [scopeKey(scope)]: list.map((c) => c.id) },
      })
      return list
    },

    loadOne: async (id) => {
      try {
        const c = await boardsApi.byId(id)
        set({ canvases: { ...get().canvases, [c.id]: c } })
        return c
      } catch {
        return undefined
      }
    },

    createCanvas: async ({ title, projectId, mySpaceId }) => {
      const c = await boardsApi.create({
        title: title || 'Новый канвас',
        projectId,
        mySpaceId,
        elements: [],
      })
      set({ canvases: { ...get().canvases, [c.id]: c } })
      const sk = scopeKey({ projectId, mySpaceId })
      const ids = get().byScope[sk]
      if (ids) set({ byScope: { ...get().byScope, [sk]: [c.id, ...ids] } })
      return c
    },

    renameCanvas: async (id, title) => {
      const c = await boardsApi.update(id, { title: title || 'Без названия' })
      set({ canvases: { ...get().canvases, [id]: c } })
    },

    deleteCanvas: async (id) => {
      await boardsApi.delete(id)
      const next = { ...get().canvases }
      delete next[id]
      const byScope: Record<string, string[]> = {}
      for (const [k, ids] of Object.entries(get().byScope)) {
        byScope[k] = ids.filter((x) => x !== id)
      }
      set({ canvases: next, byScope })
    },

    addElement: (canvasId, element) => {
      const c = get().canvases[canvasId]
      const newEl: CanvasElement = { id: uid('e'), ...element }
      if (!c) return newEl
      const next = { ...c, elements: [...c.elements, newEl] }
      set({ canvases: { ...get().canvases, [canvasId]: next } })
      scheduleSave(canvasId, next.elements)
      return newEl
    },

    updateElement: (canvasId, elementId, updates) => {
      const c = get().canvases[canvasId]
      if (!c) return
      const next = {
        ...c,
        elements: c.elements.map((e) => (e.id === elementId ? { ...e, ...updates } : e)),
      }
      set({ canvases: { ...get().canvases, [canvasId]: next } })
      scheduleSave(canvasId, next.elements)
    },

    deleteElement: (canvasId, elementId) => {
      const c = get().canvases[canvasId]
      if (!c) return
      const next = {
        ...c,
        elements: c.elements.filter(
          (e) => e.id !== elementId && e.fromId !== elementId && e.toId !== elementId
        ),
      }
      set({ canvases: { ...get().canvases, [canvasId]: next } })
      scheduleSave(canvasId, next.elements)
    },

    setElements: (canvasId, elements) => {
      const c = get().canvases[canvasId]
      if (!c) return
      const next = { ...c, elements }
      set({ canvases: { ...get().canvases, [canvasId]: next } })
      scheduleSave(canvasId, elements)
    },

    flush: (canvasId) => flushNow(canvasId),

    getCanvas: (id) => get().canvases[id],
    list: (scope) => {
      const ids = get().byScope[scopeKey(scope)]
      if (!ids) return []
      return ids.map((id) => get().canvases[id]).filter(Boolean)
    },

    reset: () => set({ canvases: {}, byScope: {} }),
  }
})
