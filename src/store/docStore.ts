import { create } from 'zustand'
import type { Block, DocPage, DocVersion } from '@/types'
import { docsApi } from '@/api/docs'

interface Scope {
  projectId?: string
  mySpaceId?: string
}

interface DocState {
  pages: Record<string, DocPage>
  versions: Record<string, DocVersion[]>
  // Кэш списка id'шников детей у каждой страницы.
  childrenIds: Record<string, string[]>
  // Кэш id корневых страниц по scope-ключу.
  rootIds: Record<string, string[]>

  // Loaders
  loadRoots: (scope: Scope) => Promise<DocPage[]>
  loadPage: (id: string) => Promise<DocPage | undefined>
  loadChildren: (parentId: string) => Promise<DocPage[]>
  searchPagesRemote: (scope: Scope, q: string) => Promise<DocPage[]>

  // Mutations
  createPage: (input: Partial<DocPage> & { createdBy: string; title?: string }) => Promise<DocPage>
  renamePage: (id: string, title: string) => Promise<void>
  updateBlocks: (id: string, blocks: Block[]) => Promise<void>
  updateIcon: (id: string, icon: string) => Promise<void>
  deletePage: (id: string) => Promise<void>
  saveVersion: (id: string, savedBy: string) => Promise<void>
  loadVersions: (pageId: string) => Promise<DocVersion[]>
  restoreVersion: (versionId: string) => Promise<void>

  // Selectors
  getPage: (id: string) => DocPage | undefined
  rootPages: (scope: Scope) => DocPage[]
  childPages: (parentId: string) => DocPage[]
  versionsByPage: (pageId: string) => DocVersion[]
  searchPages: (q: string, scope: Scope) => DocPage[]

  reset: () => void
}

function scopeKey(s: Scope): string {
  return s.projectId ? `p:${s.projectId}` : s.mySpaceId ? `m:${s.mySpaceId}` : 'none'
}

export const useDocs = create<DocState>((set, get) => ({
  pages: {},
  versions: {},
  childrenIds: {},
  rootIds: {},

  loadRoots: async (scope) => {
    const list = await docsApi.list({ projectId: scope.projectId, mySpaceId: scope.mySpaceId })
    const next = { ...get().pages }
    for (const p of list) next[p.id] = p
    set({
      pages: next,
      rootIds: { ...get().rootIds, [scopeKey(scope)]: list.map((p) => p.id) },
    })
    return list
  },

  loadPage: async (id) => {
    try {
      const p = await docsApi.byId(id)
      set({ pages: { ...get().pages, [p.id]: p } })
      return p
    } catch {
      return undefined
    }
  },

  loadChildren: async (parentId) => {
    const list = await docsApi.children(parentId)
    const next = { ...get().pages }
    for (const p of list) next[p.id] = p
    set({
      pages: next,
      childrenIds: { ...get().childrenIds, [parentId]: list.map((p) => p.id) },
    })
    return list
  },

  searchPagesRemote: (scope, q) => docsApi.search({ projectId: scope.projectId, mySpaceId: scope.mySpaceId }, q),

  createPage: async ({ title, projectId, mySpaceId, parentPageId, icon }) => {
    const page = await docsApi.create({
      title: title || 'Без названия',
      projectId: parentPageId ? undefined : projectId, // scope наследуется от parent
      mySpaceId: parentPageId ? undefined : mySpaceId,
      parentPageId,
      icon,
    })
    set({ pages: { ...get().pages, [page.id]: page } })
    if (parentPageId) {
      const ids = get().childrenIds[parentPageId]
      if (ids) {
        set({ childrenIds: { ...get().childrenIds, [parentPageId]: [...ids, page.id] } })
      }
    } else {
      const sk = scopeKey({ projectId, mySpaceId })
      const ids = get().rootIds[sk]
      if (ids) set({ rootIds: { ...get().rootIds, [sk]: [...ids, page.id] } })
    }
    return page
  },

  renamePage: async (id, title) => {
    const p = await docsApi.update(id, { title: title || 'Без названия' })
    set({ pages: { ...get().pages, [id]: p } })
  },

  updateBlocks: async (id, blocks) => {
    const p = await docsApi.update(id, { blocks })
    set({ pages: { ...get().pages, [id]: p } })
  },

  updateIcon: async (id, icon) => {
    const p = await docsApi.update(id, { icon })
    set({ pages: { ...get().pages, [id]: p } })
  },

  deletePage: async (id) => {
    await docsApi.delete(id)
    const page = get().pages[id]
    const next = { ...get().pages }
    // Каскадно чистим локальное дерево.
    const toDelete = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const p of Object.values(next)) {
        if (p.parentPageId && toDelete.has(p.parentPageId) && !toDelete.has(p.id)) {
          toDelete.add(p.id)
          changed = true
        }
      }
    }
    for (const x of toDelete) delete next[x]

    const childrenIds = { ...get().childrenIds }
    if (page?.parentPageId) {
      const arr = childrenIds[page.parentPageId]
      if (arr) childrenIds[page.parentPageId] = arr.filter((x) => x !== id)
    }
    for (const x of toDelete) delete childrenIds[x]

    const rootIds: Record<string, string[]> = {}
    for (const [k, ids] of Object.entries(get().rootIds)) {
      rootIds[k] = ids.filter((x) => !toDelete.has(x))
    }

    set({ pages: next, childrenIds, rootIds })
  },

  saveVersion: async (id) => {
    const v = await docsApi.saveVersion(id)
    set({ versions: { ...get().versions, [id]: [v, ...(get().versions[id] || [])] } })
  },

  loadVersions: async (pageId) => {
    const list = await docsApi.versions(pageId)
    set({ versions: { ...get().versions, [pageId]: list } })
    return list
  },

  restoreVersion: async (versionId) => {
    const p = await docsApi.restoreVersion(versionId)
    set({ pages: { ...get().pages, [p.id]: p } })
  },

  getPage: (id) => get().pages[id],
  rootPages: (scope) => {
    const ids = get().rootIds[scopeKey(scope)]
    if (!ids) return []
    return ids.map((id) => get().pages[id]).filter(Boolean)
  },
  childPages: (parentId) => {
    const ids = get().childrenIds[parentId]
    if (ids) return ids.map((id) => get().pages[id]).filter(Boolean)
    // Запасной путь: фильтр по всем загруженным страницам.
    return Object.values(get().pages)
      .filter((p) => p.parentPageId === parentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },
  versionsByPage: (pageId) => get().versions[pageId] || [],

  searchPages: (q, scope) => {
    const ql = q.toLowerCase().trim()
    if (!ql) return []
    return Object.values(get().pages)
      .filter(
        (p) =>
          (scope.projectId ? p.projectId === scope.projectId : p.mySpaceId === scope.mySpaceId) &&
          (p.title.toLowerCase().includes(ql) ||
            p.blocks.some((b) => b.content.toLowerCase().includes(ql)))
      )
      .slice(0, 20)
  },

  reset: () => set({ pages: {}, versions: {}, childrenIds: {}, rootIds: {} }),
}))
