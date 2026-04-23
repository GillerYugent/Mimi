import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Block, DocPage, DocVersion, ID } from '@/types'
import { uid } from '@/utils/id'

function emptyBlock(): Block {
  return { id: uid('b'), type: 'paragraph', content: '' }
}

interface DocState {
  pages: DocPage[]
  versions: DocVersion[]
  createPage: (input: Partial<DocPage> & { createdBy: ID; title?: string }) => DocPage
  renamePage: (id: ID, title: string) => void
  updateBlocks: (id: ID, blocks: Block[]) => void
  updateIcon: (id: ID, icon: string) => void
  deletePage: (id: ID) => void
  getPage: (id: ID) => DocPage | undefined
  // Tree navigation
  rootPages: (scope: { projectId?: ID; mySpaceOwnerId?: ID }) => DocPage[]
  childPages: (parentId: ID) => DocPage[]
  saveVersion: (id: ID, savedBy: ID) => void
  versionsByPage: (pageId: ID) => DocVersion[]
  restoreVersion: (versionId: ID) => void
  searchPages: (query: string, scope: { projectId?: ID; mySpaceOwnerId?: ID }) => DocPage[]
}

export const useDocs = create<DocState>()(
  persist(
    (set, get) => ({
      pages: [],
      versions: [],

      createPage: ({ title, projectId, mySpaceOwnerId, parentPageId, createdBy, icon }) => {
        const now = new Date().toISOString()
        const page: DocPage = {
          id: uid('d'),
          title: title || 'Без названия',
          icon: icon,
          projectId,
          mySpaceOwnerId,
          parentPageId,
          blocks: [emptyBlock()],
          createdAt: now,
          updatedAt: now,
          createdBy,
        }
        set({ pages: [...get().pages, page] })
        return page
      },

      renamePage: (id, title) => {
        set({
          pages: get().pages.map((p) =>
            p.id === id ? { ...p, title: title || 'Без названия', updatedAt: new Date().toISOString() } : p
          ),
        })
      },

      updateBlocks: (id, blocks) => {
        set({
          pages: get().pages.map((p) =>
            p.id === id ? { ...p, blocks, updatedAt: new Date().toISOString() } : p
          ),
        })
      },

      updateIcon: (id, icon) => {
        set({
          pages: get().pages.map((p) => (p.id === id ? { ...p, icon, updatedAt: new Date().toISOString() } : p)),
        })
      },

      deletePage: (id) => {
        // Cascade: delete all descendants.
        const ids = new Set<ID>([id])
        let changed = true
        while (changed) {
          changed = false
          for (const p of get().pages) {
            if (p.parentPageId && ids.has(p.parentPageId) && !ids.has(p.id)) {
              ids.add(p.id)
              changed = true
            }
          }
        }
        set({
          pages: get().pages.filter((p) => !ids.has(p.id)),
          versions: get().versions.filter((v) => !ids.has(v.pageId)),
        })
      },

      getPage: (id) => get().pages.find((p) => p.id === id),

      rootPages: ({ projectId, mySpaceOwnerId }) =>
        get()
          .pages.filter(
            (p) =>
              !p.parentPageId &&
              (projectId ? p.projectId === projectId : p.mySpaceOwnerId === mySpaceOwnerId)
          )
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

      childPages: (parentId) =>
        get()
          .pages.filter((p) => p.parentPageId === parentId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

      saveVersion: (id, savedBy) => {
        const page = get().getPage(id)
        if (!page) return
        const v: DocVersion = {
          id: uid('v'),
          pageId: id,
          title: page.title,
          blocks: JSON.parse(JSON.stringify(page.blocks)),
          savedAt: new Date().toISOString(),
          savedBy,
        }
        set({ versions: [v, ...get().versions] })
      },

      versionsByPage: (pageId) =>
        get()
          .versions.filter((v) => v.pageId === pageId)
          .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),

      restoreVersion: (versionId) => {
        const v = get().versions.find((x) => x.id === versionId)
        if (!v) return
        const now = new Date().toISOString()
        set({
          pages: get().pages.map((p) =>
            p.id === v.pageId ? { ...p, title: v.title, blocks: JSON.parse(JSON.stringify(v.blocks)), updatedAt: now } : p
          ),
        })
      },

      searchPages: (query, scope) => {
        const q = query.toLowerCase().trim()
        if (!q) return []
        return get()
          .pages.filter(
            (p) =>
              (scope.projectId ? p.projectId === scope.projectId : p.mySpaceOwnerId === scope.mySpaceOwnerId) &&
              (p.title.toLowerCase().includes(q) ||
                p.blocks.some((b) => b.content.toLowerCase().includes(q)))
          )
          .slice(0, 20)
      },
    }),
    { name: 'mimi.docs' }
  )
)
