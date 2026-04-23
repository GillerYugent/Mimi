import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Canvas, CanvasElement, ID } from '@/types'
import { uid } from '@/utils/id'

interface BoardState {
  canvases: Canvas[]
  createCanvas: (input: { title?: string; projectId?: ID; mySpaceOwnerId?: ID }) => Canvas
  renameCanvas: (id: ID, title: string) => void
  deleteCanvas: (id: ID) => void
  getCanvas: (id: ID) => Canvas | undefined
  list: (scope: { projectId?: ID; mySpaceOwnerId?: ID }) => Canvas[]
  addElement: (canvasId: ID, element: Omit<CanvasElement, 'id'>) => CanvasElement
  updateElement: (canvasId: ID, elementId: ID, updates: Partial<CanvasElement>) => void
  deleteElement: (canvasId: ID, elementId: ID) => void
  setElements: (canvasId: ID, elements: CanvasElement[]) => void
}

export const useBoards = create<BoardState>()(
  persist(
    (set, get) => ({
      canvases: [],

      createCanvas: ({ title, projectId, mySpaceOwnerId }) => {
        const now = new Date().toISOString()
        const c: Canvas = {
          id: uid('c'),
          title: title || 'Новый канвас',
          projectId,
          mySpaceOwnerId,
          elements: [],
          createdAt: now,
          updatedAt: now,
        }
        set({ canvases: [...get().canvases, c] })
        return c
      },

      renameCanvas: (id, title) => {
        set({
          canvases: get().canvases.map((c) =>
            c.id === id ? { ...c, title: title || 'Без названия', updatedAt: new Date().toISOString() } : c
          ),
        })
      },

      deleteCanvas: (id) => set({ canvases: get().canvases.filter((c) => c.id !== id) }),

      getCanvas: (id) => get().canvases.find((c) => c.id === id),

      list: ({ projectId, mySpaceOwnerId }) =>
        get()
          .canvases.filter((c) =>
            projectId ? c.projectId === projectId : c.mySpaceOwnerId === mySpaceOwnerId
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

      addElement: (canvasId, element) => {
        const e: CanvasElement = { id: uid('e'), ...element }
        set({
          canvases: get().canvases.map((c) =>
            c.id === canvasId
              ? { ...c, elements: [...c.elements, e], updatedAt: new Date().toISOString() }
              : c
          ),
        })
        return e
      },

      updateElement: (canvasId, elementId, updates) => {
        set({
          canvases: get().canvases.map((c) =>
            c.id === canvasId
              ? {
                  ...c,
                  elements: c.elements.map((el) => (el.id === elementId ? { ...el, ...updates } : el)),
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        })
      },

      deleteElement: (canvasId, elementId) => {
        set({
          canvases: get().canvases.map((c) =>
            c.id === canvasId
              ? { ...c, elements: c.elements.filter((e) => e.id !== elementId && e.fromId !== elementId && e.toId !== elementId), updatedAt: new Date().toISOString() }
              : c
          ),
        })
      },

      setElements: (canvasId, elements) => {
        set({
          canvases: get().canvases.map((c) =>
            c.id === canvasId ? { ...c, elements, updatedAt: new Date().toISOString() } : c
          ),
        })
      },
    }),
    { name: 'mimi.boards' }
  )
)
