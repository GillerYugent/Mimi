import { useEffect, useMemo, useRef, useState } from 'react'
import type { Block, DocPage, ID } from '@/types'
import { useDocs } from '@/store/docStore'
import { useAuth } from '@/store/authStore'
import { BlockEditor } from './BlockEditor'
import { IconChevronDown, IconChevronRight, IconFile, IconHistory, IconPlus, IconSearch, IconTrash } from '@/components/ui/Icon'
import { Modal, Confirm } from '@/components/ui/Modal'
import { formatRelative } from '@/utils/date'

interface Props {
  scope: { projectId?: ID; mySpaceId?: ID }
}

export function DocsPane({ scope }: Props) {
  const user = useAuth((s) => s.user)
  const rootPages = useDocs((s) => s.rootPages(scope))
  const loadRoots = useDocs((s) => s.loadRoots)
  const createPage = useDocs((s) => s.createPage)

  const [selectedId, setSelectedId] = useState<ID | null>(null)
  const [search, setSearch] = useState('')

  // Загружаем корни при первом открытии scope.
  useEffect(() => {
    void loadRoots(scope)
  }, [scope.projectId, scope.mySpaceId])

  // Автоселект первой страницы.
  useEffect(() => {
    if (!selectedId && rootPages[0]) setSelectedId(rootPages[0].id)
  }, [rootPages.length, selectedId])

  const searchResults = useDocs((s) => (search.trim() ? s.searchPages(search, scope) : []))

  const effectiveId = selectedId && useDocs.getState().getPage(selectedId) ? selectedId : rootPages[0]?.id ?? null

  const onCreateRoot = async () => {
    if (!user) return
    const p = await createPage({ createdBy: user.id, title: 'Новая страница', ...scope })
    setSelectedId(p.id)
  }

  return (
    <div className="flex h-full">
      {/* Tree */}
      <div className="flex w-64 shrink-0 flex-col border-r border-line bg-paper-soft">
        <div className="border-b border-line p-2">
          <div className="relative">
            <IconSearch
              size={12}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-lighter"
            />
            <input
              className="input py-1.5 pl-7 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск заметок..."
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-1 py-2">
          {search.trim() ? (
            <div className="space-y-0.5">
              <div className="px-2 text-[11px] uppercase text-ink-lighter">Найдено: {searchResults.length}</div>
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`sidebar-item ${effectiveId === p.id ? 'active' : ''}`}
                >
                  <span>{p.icon || <IconFile size={12} />}</span>
                  <span className="truncate">{p.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {rootPages.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-ink-lighter">Нет заметок</div>
              )}
              {rootPages.map((p) => (
                <TreeNode key={p.id} page={p} selectedId={effectiveId} onSelect={setSelectedId} depth={0} />
              ))}
            </>
          )}
        </div>
        <div className="border-t border-line p-2">
          <button className="btn btn-ghost w-full justify-start text-xs" onClick={onCreateRoot}>
            <IconPlus size={12} /> Новая страница
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        {effectiveId ? <PageEditor pageId={effectiveId} onAfterDelete={() => setSelectedId(null)} /> : <EmptyDocs />}
      </div>
    </div>
  )
}

interface TreeNodeProps {
  page: DocPage
  selectedId: ID | null
  onSelect: (id: ID) => void
  depth: number
}

function TreeNode({ page, selectedId, onSelect, depth }: TreeNodeProps) {
  const children = useDocs((s) => s.childPages(page.id))
  const loadChildren = useDocs((s) => s.loadChildren)
  const user = useAuth((s) => s.user)
  const createPage = useDocs((s) => s.createPage)
  const [open, setOpen] = useState(true)
  const [hasLoadedChildren, setHasLoadedChildren] = useState(false)

  // Загружаем потомков при первом открытии (только если open).
  useEffect(() => {
    if (open && !hasLoadedChildren) {
      setHasLoadedChildren(true)
      void loadChildren(page.id)
    }
  }, [open, hasLoadedChildren, page.id])

  const addChild = async () => {
    if (!user) return
    const child = await createPage({
      createdBy: user.id,
      title: 'Новая подстраница',
      parentPageId: page.id,
      projectId: page.projectId,
      mySpaceId: page.mySpaceId,
    })
    onSelect(child.id)
    setOpen(true)
  }

  return (
    <div>
      <div className="group flex items-stretch">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-lighter hover:bg-paper-hover"
          style={{ marginLeft: `${depth * 10}px` }}
          aria-label={open ? 'Свернуть' : 'Развернуть'}
        >
          {children.length > 0 ? open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} /> : null}
        </button>
        <button
          onClick={() => onSelect(page.id)}
          className={`flex flex-1 items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-sm transition-colors ${
            selectedId === page.id ? 'bg-paper-active text-ink' : 'text-ink-light hover:bg-paper-hover hover:text-ink'
          }`}
        >
          <span className="shrink-0">{page.icon || <IconFile size={12} />}</span>
          <span className="truncate">{page.title || 'Без названия'}</span>
        </button>
        <button
          onClick={addChild}
          className="shrink-0 rounded p-1 text-ink-lighter opacity-0 hover:bg-paper-hover hover:text-ink group-hover:opacity-100"
          aria-label="Добавить подстраницу"
        >
          <IconPlus size={12} />
        </button>
      </div>
      {open && children.length > 0 && (
        <div>
          {children.map((c) => (
            <TreeNode key={c.id} page={c} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function PageEditor({ pageId, onAfterDelete }: { pageId: ID; onAfterDelete: () => void }) {
  const page = useDocs((s) => s.getPage(pageId))
  const loadPage = useDocs((s) => s.loadPage)
  const user = useAuth((s) => s.user)
  const renamePage = useDocs((s) => s.renamePage)
  const updateBlocks = useDocs((s) => s.updateBlocks)
  const updateIcon = useDocs((s) => s.updateIcon)
  const deletePage = useDocs((s) => s.deletePage)
  const saveVersion = useDocs((s) => s.saveVersion)
  const versions = useDocs((s) => s.versionsByPage(pageId))
  const loadVersions = useDocs((s) => s.loadVersions)
  const restoreVersion = useDocs((s) => s.restoreVersion)

  const [showHistory, setShowHistory] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savedHint, setSavedHint] = useState<'saving' | 'saved' | null>(null)

  // Локальная копия для оптимистичного UI, чтобы инпуты ходили без задержки.
  const [localTitle, setLocalTitle] = useState(page?.title ?? '')
  const [localIcon, setLocalIcon] = useState(page?.icon ?? '')
  const [localBlocks, setLocalBlocks] = useState<Block[]>(page?.blocks ?? [])

  // Sync с серверной копией (если page обновили на бэке).
  useEffect(() => {
    if (!page) return
    setLocalTitle(page.title)
    setLocalIcon(page.icon ?? '')
    setLocalBlocks(page.blocks)
  }, [pageId, page?.updatedAt])

  // На случай если страница ещё не загружена — подтягиваем.
  useEffect(() => {
    if (!page) void loadPage(pageId)
  }, [pageId])

  // Debounced autosave для блоков.
  const blocksTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveBlocksDebounced = (blocks: Block[]) => {
    setLocalBlocks(blocks)
    setSavedHint('saving')
    if (blocksTimer.current) clearTimeout(blocksTimer.current)
    blocksTimer.current = setTimeout(async () => {
      await updateBlocks(pageId, blocks)
      setSavedHint('saved')
      setTimeout(() => setSavedHint(null), 1500)
    }, 600)
  }

  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTitleDebounced = (title: string) => {
    setLocalTitle(title)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => {
      void renamePage(pageId, title)
    }, 400)
  }

  const parentChain = useMemo(() => {
    if (!page) return []
    const chain: DocPage[] = []
    let current: DocPage | undefined = page
    while (current) {
      chain.unshift(current)
      current = current.parentPageId ? useDocs.getState().getPage(current.parentPageId) : undefined
    }
    return chain
  }, [page])

  if (!page || !user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-light">
        Загрузка...
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-8 py-6">
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-ink-lighter">
        {parentChain.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            <span>{p.icon || ''}</span>
            <span className={i === parentChain.length - 1 ? 'text-ink' : ''}>{p.title || 'Без названия'}</span>
            {i < parentChain.length - 1 && <span className="mx-1 text-ink-lighter">/</span>}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {savedHint && (
            <span className="mr-2 text-[11px] text-ink-lighter">
              {savedHint === 'saving' ? 'Сохранение…' : 'Сохранено'}
            </span>
          )}
          <button
            className="btn btn-ghost text-xs"
            onClick={() => saveVersion(page.id, user.id)}
            title="Сохранить версию"
          >
            Сохранить версию
          </button>
          <button
            className="btn btn-ghost text-xs"
            onClick={() => {
              setShowHistory(true)
              void loadVersions(page.id)
            }}
          >
            <IconHistory size={12} /> История ({versions.length})
          </button>
          <button className="btn btn-danger text-xs" onClick={() => setConfirmDelete(true)}>
            <IconTrash size={12} /> Удалить
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <input
          className="w-12 border-none bg-transparent text-center text-4xl outline-none"
          value={localIcon}
          onChange={(e) => {
            const v = e.target.value.slice(0, 2)
            setLocalIcon(v)
            void updateIcon(page.id, v)
          }}
          maxLength={2}
          placeholder="📄"
        />
        <input
          className="title-serif w-full border-none bg-transparent text-4xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-lighter"
          value={localTitle}
          onChange={(e) => saveTitleDebounced(e.target.value)}
          placeholder="Без названия"
        />
      </div>

      <div className="flex-1">
        <BlockEditor blocks={localBlocks} onChange={saveBlocksDebounced} />
      </div>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="История изменений" width="md">
        {versions.length === 0 ? (
          <div className="py-6 text-center text-sm text-ink-light">Версии не сохранены</div>
        ) : (
          <div className="space-y-1">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-md border border-line px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-ink">{v.title}</div>
                  <div className="text-xs text-ink-light">
                    Сохранено {formatRelative(v.savedAt)}
                  </div>
                </div>
                <button
                  className="btn btn-outline text-xs"
                  onClick={async () => {
                    if (confirm('Восстановить эту версию? Текущее состояние будет заменено.')) {
                      await restoreVersion(v.id)
                      setShowHistory(false)
                    }
                  }}
                >
                  Восстановить
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deletePage(page.id)
          onAfterDelete()
        }}
        title="Удалить страницу?"
        message="Эта страница и все вложенные подстраницы будут безвозвратно удалены."
        confirmText="Удалить"
        destructive
      />
    </div>
  )
}

function EmptyDocs() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-xs text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-paper-soft text-ink-light">
          <IconFile size={20} />
        </div>
        <h3 className="text-base font-semibold text-ink">Пустой раздел Docs</h3>
        <p className="mt-1 text-sm text-ink-light">
          Создайте первую страницу слева, чтобы начать вести документацию.
        </p>
      </div>
    </div>
  )
}
