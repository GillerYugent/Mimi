import { KeyboardEvent, useRef } from 'react'
import type { Block, BlockType } from '@/types'
import { uid } from '@/utils/id'
import { IconCheck, IconPlus, IconTrash } from '@/components/ui/Icon'

interface Props {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  readOnly?: boolean
}

const PLACEHOLDERS: Record<BlockType, string> = {
  paragraph: "Введите '/' для команд, или просто начните писать...",
  heading_1: 'Заголовок 1',
  heading_2: 'Заголовок 2',
  heading_3: 'Заголовок 3',
  bulleted_list: 'Элемент списка',
  numbered_list: 'Элемент списка',
  todo: 'Задача',
  quote: 'Цитата',
  divider: '',
  code: 'Код',
  table: 'Ячейка | Ячейка | Ячейка',
  image: 'URL изображения',
}

const BLOCK_CLASSES: Record<BlockType, string> = {
  paragraph: 'text-[15px] leading-relaxed',
  heading_1: 'title-serif text-3xl font-bold mt-6 mb-1',
  heading_2: 'title-serif text-2xl font-semibold mt-5 mb-1',
  heading_3: 'text-xl font-semibold mt-4 mb-1',
  bulleted_list: 'text-[15px] leading-relaxed pl-1',
  numbered_list: 'text-[15px] leading-relaxed pl-1',
  todo: 'text-[15px] leading-relaxed',
  quote: 'border-l-4 border-ink pl-4 italic text-ink-light',
  divider: '',
  code: 'font-mono text-sm bg-paper-soft rounded p-3 whitespace-pre-wrap',
  table: 'font-mono text-sm',
  image: 'text-xs text-ink-lighter',
}

export function BlockEditor({ blocks, onChange, readOnly }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const update = (id: string, patch: Partial<Block>) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  const insertAfter = (id: string, type: BlockType = 'paragraph') => {
    const idx = blocks.findIndex((b) => b.id === id)
    const newBlock: Block = { id: uid('b'), type, content: '' }
    const next = [...blocks]
    next.splice(idx + 1, 0, newBlock)
    onChange(next)
    // Focus the new block after render
    setTimeout(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-block-id="${newBlock.id}"] [contenteditable]`)
      el?.focus()
    }, 0)
  }

  const remove = (id: string) => {
    const next = blocks.filter((b) => b.id !== id)
    onChange(next.length ? next : [{ id: uid('b'), type: 'paragraph', content: '' }])
  }

  const changeType = (id: string, type: BlockType) => {
    update(id, { type, checked: type === 'todo' ? false : undefined })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, block: Block) => {
    if (readOnly) return

    // Enter -> new block (paragraph by default, inherit list types)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      let nextType: BlockType = 'paragraph'
      if (block.type === 'bulleted_list' || block.type === 'numbered_list' || block.type === 'todo') {
        // Empty list item -> break out of list
        if (!block.content.trim()) {
          changeType(block.id, 'paragraph')
          return
        }
        nextType = block.type
      }
      insertAfter(block.id, nextType)
      return
    }

    // Backspace on empty block removes it and focuses previous
    if (e.key === 'Backspace' && !block.content) {
      const idx = blocks.findIndex((b) => b.id === block.id)
      if (idx > 0) {
        e.preventDefault()
        const prev = blocks[idx - 1]
        remove(block.id)
        setTimeout(() => {
          const el = containerRef.current?.querySelector<HTMLElement>(`[data-block-id="${prev.id}"] [contenteditable]`)
          el?.focus()
          // Put caret at end
          if (el) {
            const range = document.createRange()
            range.selectNodeContents(el)
            range.collapse(false)
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
        }, 0)
      }
      return
    }

    // Markdown-like shortcuts at the start of a line
    if (e.key === ' ') {
      const content = block.content
      const newType = mdShortcut(content)
      if (newType && block.type !== newType) {
        e.preventDefault()
        update(block.id, { type: newType, content: '' })
      }
    }
  }

  return (
    <div ref={containerRef} className="space-y-1">
      {blocks.map((block) => (
        <BlockRow
          key={block.id}
          block={block}
          readOnly={readOnly}
          onChangeContent={(c) => update(block.id, { content: c })}
          onToggleCheck={() => update(block.id, { checked: !block.checked })}
          onChangeType={(t) => changeType(block.id, t)}
          onKeyDown={onKeyDown}
          onRemove={() => remove(block.id)}
          onInsertAfter={() => insertAfter(block.id)}
        />
      ))}
    </div>
  )
}

function mdShortcut(content: string): BlockType | null {
  if (content === '#') return 'heading_1'
  if (content === '##') return 'heading_2'
  if (content === '###') return 'heading_3'
  if (content === '-' || content === '*') return 'bulleted_list'
  if (content === '1.') return 'numbered_list'
  if (content === '[]' || content === '[ ]') return 'todo'
  if (content === '>') return 'quote'
  if (content === '```') return 'code'
  if (content === '---') return 'divider'
  return null
}

interface RowProps {
  block: Block
  readOnly?: boolean
  onChangeContent: (s: string) => void
  onToggleCheck: () => void
  onChangeType: (t: BlockType) => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>, b: Block) => void
  onRemove: () => void
  onInsertAfter: () => void
}

function BlockRow({
  block,
  readOnly,
  onChangeContent,
  onToggleCheck,
  onChangeType,
  onKeyDown,
  onRemove,
  onInsertAfter,
}: RowProps) {
  if (block.type === 'divider') {
    return (
      <div className="group relative py-3" data-block-id={block.id}>
        <div className="h-px bg-line" />
        {!readOnly && <RowControls onRemove={onRemove} onInsertAfter={onInsertAfter} onChangeType={onChangeType} currentType={block.type} />}
      </div>
    )
  }

  const editable = !readOnly

  const prefix = (() => {
    if (block.type === 'bulleted_list') return <span className="select-none pr-2 text-ink">•</span>
    if (block.type === 'numbered_list') return <span className="select-none pr-2 text-ink">1.</span>
    if (block.type === 'todo')
      return (
        <button
          onClick={onToggleCheck}
          className={`mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            block.checked ? 'border-ink bg-ink text-paper' : 'border-line'
          }`}
        >
          {block.checked && <IconCheck size={10} />}
        </button>
      )
    return null
  })()

  return (
    <div className="group relative flex items-start gap-1" data-block-id={block.id}>
      {!readOnly && (
        <div className="flex w-6 shrink-0 items-center justify-center pt-1 opacity-0 transition-opacity group-hover:opacity-100">
          <TypeChangerTrigger currentType={block.type} onChangeType={onChangeType} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 items-start">
        {prefix}
        <div
          contentEditable={editable}
          suppressContentEditableWarning
          className={`block flex-1 outline-none ${BLOCK_CLASSES[block.type]} ${
            block.type === 'todo' && block.checked ? 'text-ink-lighter line-through' : ''
          }`}
          data-placeholder={PLACEHOLDERS[block.type]}
          onBlur={(e) => onChangeContent(e.currentTarget.textContent || '')}
          onKeyDown={(e) => onKeyDown(e, block)}
        >
          {block.content}
        </div>
      </div>
    </div>
  )
}

function RowControls({
  onInsertAfter,
  onRemove,
  onChangeType,
  currentType,
}: {
  onInsertAfter: () => void
  onRemove: () => void
  onChangeType: (t: BlockType) => void
  currentType: BlockType
}) {
  return (
    <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
      <TypeChangerTrigger currentType={currentType} onChangeType={onChangeType} />
      <button onClick={onInsertAfter} className="ml-1 rounded p-0.5 text-ink-light hover:bg-paper-hover" aria-label="После">
        <IconPlus size={12} />
      </button>
      <button onClick={onRemove} className="ml-1 rounded p-0.5 text-ink-light hover:bg-paper-hover" aria-label="Удалить">
        <IconTrash size={12} />
      </button>
    </div>
  )
}

const TYPE_OPTIONS: Array<{ value: BlockType; label: string }> = [
  { value: 'paragraph', label: 'Текст' },
  { value: 'heading_1', label: 'Заголовок 1' },
  { value: 'heading_2', label: 'Заголовок 2' },
  { value: 'heading_3', label: 'Заголовок 3' },
  { value: 'bulleted_list', label: 'Список' },
  { value: 'numbered_list', label: 'Нумерованный' },
  { value: 'todo', label: 'Чек-лист' },
  { value: 'quote', label: 'Цитата' },
  { value: 'code', label: 'Код' },
  { value: 'divider', label: 'Разделитель' },
]

function TypeChangerTrigger({
  currentType,
  onChangeType,
}: {
  currentType: BlockType
  onChangeType: (t: BlockType) => void
}) {
  return (
    <select
      value={currentType}
      onChange={(e) => onChangeType(e.target.value as BlockType)}
      className="h-5 w-5 cursor-pointer rounded bg-paper-hover text-xs outline-none"
      title="Тип блока"
      style={{ appearance: 'none' }}
    >
      {TYPE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
