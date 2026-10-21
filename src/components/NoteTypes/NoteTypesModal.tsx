import { useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, Trash, X } from '@phosphor-icons/react'
import { useConfirm } from '../../hooks/useConfirm'
import {
  MAX_PROPERTY_NAME,
  MAX_TYPE_NAME,
  newSelectOption,
  type NoteTypesRegistry,
} from '../../hooks/useNoteTypes'
import { hasMetadataValue, METADATA_TYPE_LABEL, NOTE_PROPERTY_TYPES } from '../../lib/metadata'
import { MAX_LIST_PROPERTIES, typeDefs } from '../../lib/noteTypes'
import { normalizeName } from '../../lib/tasks'
import type { MetadataDef, MetadataType, Note, NoteType, SelectOption } from '../../types'
import { ColorDots } from '../TasksView/ColorDots'
import { TYPE_ICON_GROUPS, TypeIcon } from './TypeIcon'
import styles from '../TasksView/StatusManagerModal.module.css'
import own from './NoteTypesModal.module.css'

// "Note types": tipos globais (nome, ícone, cor, ordem, template) e as
// propriedades de cada um (nome, tipo de dado fixo após criar, "show in list",
// ordem, opções do select). Sem relação, fórmula, multi-select nem troca de
// tipo de dado (travas do §4.2 do estudo). Built-in não é renomeado nem excluído.
interface NoteTypesModalProps {
  onClose: () => void
  // Tipo selecionado ao abrir ("Edit type" no menu do tipo da nota).
  focusTypeId: string | null
  // Aberto por "Reorder types…" (ordenação da lista de notas): destaca as
  // setas da lista de tipos.
  reorder?: boolean
  registry: NoteTypesRegistry
  // Contagens das confirmações de exclusão.
  notes: Note[]
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Esc no campo descarta o rascunho (o blur que segue não grava).
function draftKeys(cancelRef: { current: boolean }) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') {
      cancelRef.current = true
      e.currentTarget.blur()
    }
  }
}

export function NoteTypesModal({ onClose, focusTypeId, reorder = false, registry, notes }: NoteTypesModalProps) {
  const { types, defs } = registry
  const { confirm, modal } = useConfirm()
  const [selectedId, setSelectedId] = useState<string | null>(focusTypeId)
  const [error, setError] = useState<string | null>(null)
  const [newTypeName, setNewTypeName] = useState('')
  const [newPropName, setNewPropName] = useState('')
  const [newPropType, setNewPropType] = useState<MetadataType>('text')
  const [iconQuery, setIconQuery] = useState('')
  // Contagens recalculadas no momento do confirm (não as do render).
  const notesRef = useRef(notes)
  notesRef.current = notes
  const cancelRef = useRef(false)
  const onDraftKeys = draftKeys(cancelRef)

  const selected = types.find((t) => t.id === selectedId) ?? types[0] ?? null
  const selectedDefs = selected ? typeDefs(defs, selected.id) : []

  // Busca de ícone: pelo nome (espaço vale como "-") ou pelo nome do grupo.
  const query = iconQuery.trim().toLowerCase()
  const iconGroups = TYPE_ICON_GROUPS.map((g) => ({
    label: g.label,
    names: Object.keys(g.icons).filter(
      (name) => !query || g.label.toLowerCase().includes(query) || name.includes(query.replace(/\s+/g, '-'))
    ),
  })).filter((g) => g.names.length > 0)

  async function run(op: () => Promise<unknown>): Promise<boolean> {
    try {
      await op()
      setError(null)
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    }
  }

  // Commit de um campo de texto no blur: Esc ou valor igual não gravam; em
  // erro, o campo volta ao valor salvo.
  function commitText(input: HTMLInputElement | HTMLTextAreaElement, saved: string, save: (v: string) => Promise<unknown>) {
    if (cancelRef.current) {
      cancelRef.current = false
      input.value = saved
      return
    }
    if (input.value.trim() === saved.trim()) return
    void run(() => save(input.value)).then((ok) => {
      if (!ok) input.value = saved
    })
  }

  async function handleCreateType() {
    if (await run(async () => setSelectedId((await registry.createType(newTypeName)).id))) setNewTypeName('')
  }

  function moveType(index: number, delta: number) {
    const ids = types.map((t) => t.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + delta, 0, id)
    void run(() => registry.reorderTypes(ids))
  }

  async function handleRemoveType(t: NoteType) {
    const count = notesRef.current.filter((n) => n.typeId === t.id).length
    const message =
      count > 0
        ? `Delete type "${t.name}"? ${count} note${count === 1 ? '' : 's'} lose the type and its property values.`
        : `Delete type "${t.name}"?`
    const ok = await confirm(message, { title: 'Delete type', confirmLabel: 'Delete', destructive: true })
    if (ok) void run(() => registry.removeType(t.id))
  }

  async function handleCreateProp() {
    if (!selected) return
    if (await run(() => registry.createDef(selected.id, newPropName, newPropType))) {
      setNewPropName('')
      setNewPropType('text')
    }
  }

  function moveProp(index: number, delta: number) {
    if (!selected) return
    const ids = selectedDefs.map((d) => d.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + delta, 0, id)
    void run(() => registry.reorderDefs(selected.id, ids))
  }

  async function handleRemoveProp(d: MetadataDef) {
    const count = notesRef.current.filter((n) => {
      const v = n.properties?.[d.id]
      return v !== undefined && hasMetadataValue(v)
    }).length
    const message =
      count > 0
        ? `Delete property "${d.name}"? It is set on ${count} note${count === 1 ? '' : 's'}; those values will be removed.`
        : `Delete property "${d.name}"?`
    const ok = await confirm(message, { title: 'Delete property', confirmLabel: 'Delete', destructive: true })
    if (ok) void run(() => registry.removeDef(d.id))
  }

  // Opções do select: nome obrigatório e único na propriedade (a troca de tipo
  // casa as opções pelo nome).
  function saveOptions(d: MetadataDef, options: SelectOption[]) {
    return registry.updateDef(d.id, { options })
  }

  function validOptionName(d: MetadataDef, name: string, exceptId: string | null): string {
    const trimmed = name.trim().slice(0, MAX_PROPERTY_NAME)
    if (!trimmed) throw new Error('Option name is required.')
    const wanted = normalizeName(trimmed)
    if ((d.options ?? []).some((o) => o.id !== exceptId && normalizeName(o.name) === wanted)) {
      throw new Error('This property already has an option with this name.')
    }
    return trimmed
  }

  function renderOptions(d: MetadataDef) {
    const options = d.options ?? []
    return (
      <div className={own.options}>
        {options.map((o) => (
          <div key={o.id} className={styles.row}>
            <input
              className={styles.nameInput}
              key={o.name}
              defaultValue={o.name}
              maxLength={MAX_PROPERTY_NAME}
              aria-label={`rename option ${o.name}`}
              onBlur={(e) =>
                commitText(e.currentTarget, o.name, async (v) => {
                  const name = validOptionName(d, v, o.id)
                  await saveOptions(d, options.map((x) => (x.id === o.id ? { ...x, name } : x)))
                })
              }
              onKeyDown={onDraftKeys}
            />
            <ColorDots
              value={o.color}
              onChange={(color) =>
                void run(() => saveOptions(d, options.map((x) => (x.id === o.id ? { ...x, color } : x))))
              }
              label={`${o.name} color`}
              allowNone
            />
            <button
              type="button"
              className={styles.delete}
              onClick={() => void run(() => saveOptions(d, options.filter((x) => x.id !== o.id)))}
              aria-label={`delete option ${o.name}`}
              title="Delete option"
            >
              <X size={13} aria-hidden />
            </button>
          </div>
        ))}
        <input
          className={styles.nameInput}
          maxLength={MAX_PROPERTY_NAME}
          placeholder="New option… (Enter)"
          aria-label={`new option of ${d.name}`}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            const input = e.currentTarget
            void run(() =>
              saveOptions(d, [...options, newSelectOption(validOptionName(d, input.value, null), null)])
            ).then((ok) => {
              if (ok) input.value = ''
            })
          }}
        />
      </div>
    )
  }

  function renderDetail(t: NoteType) {
    const listCount = selectedDefs.filter((d) => d.showInList).length
    return (
      <div className={own.detail}>
        <div className={own.field}>
          <span className={own.label}>Name</span>
          {t.builtin ? (
            <span className={styles.name}>{t.name}</span>
          ) : (
            <input
              className={styles.nameInput}
              key={`${t.id}:${t.name}`}
              defaultValue={t.name}
              maxLength={MAX_TYPE_NAME}
              aria-label="type name"
              onBlur={(e) => commitText(e.currentTarget, t.name, (v) => registry.updateType(t.id, { name: v }))}
              onKeyDown={onDraftKeys}
            />
          )}
          {!t.builtin && (
            <button
              type="button"
              className={styles.delete}
              onClick={() => void handleRemoveType(t)}
              aria-label={`delete type ${t.name}`}
              title="Delete type"
            >
              <Trash size={13} aria-hidden />
            </button>
          )}
        </div>
        <div className={`${own.field} ${own.iconField}`}>
          <span className={own.label}>Icon</span>
          <div className={own.iconPicker}>
            <input
              className={styles.nameInput}
              value={iconQuery}
              onChange={(e) => setIconQuery(e.target.value)}
              placeholder="Search icons"
              aria-label="search icons"
            />
            <div className={own.icons} role="radiogroup" aria-label="type icon">
              {iconGroups.map((g) => (
                <div key={g.label} className={own.iconGroup}>
                  <span className={own.iconGroupLabel}>{g.label}</span>
                  {g.names.map((name) => {
                    const active = (t.icon ?? 'note') === name
                    return (
                      <button
                        key={name}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={name}
                        title={name}
                        className={`${own.iconButton} ${active ? own.iconActive : ''}`}
                        onClick={() => void run(() => registry.updateType(t.id, { icon: name }))}
                      >
                        <TypeIcon name={name} size={14} />
                      </button>
                    )
                  })}
                </div>
              ))}
              {iconGroups.length === 0 && <p className={own.empty}>No icons match.</p>}
            </div>
          </div>
        </div>
        <div className={own.field}>
          <span className={own.label}>Color</span>
          <ColorDots
            value={t.color}
            onChange={(color) => void run(() => registry.updateType(t.id, { color }))}
            label="type color"
            allowNone
          />
        </div>

        <p className={own.section}>Properties</p>
        <div className={own.props}>
          {selectedDefs.length === 0 && <p className={own.empty}>No properties yet.</p>}
          {selectedDefs.map((d, i) => (
            <div key={d.id} className={own.prop}>
              <div className={styles.row}>
                <input
                  className={styles.nameInput}
                  key={d.name}
                  defaultValue={d.name}
                  maxLength={MAX_PROPERTY_NAME}
                  aria-label={`rename ${d.name}`}
                  onBlur={(e) => commitText(e.currentTarget, d.name, (v) => registry.updateDef(d.id, { name: v }))}
                  onKeyDown={onDraftKeys}
                />
                <span className={own.type}>{METADATA_TYPE_LABEL[d.type]}</span>
                <label
                  className={own.inList}
                  title={`Show the value in the notes list (at most ${MAX_LIST_PROPERTIES})`}
                >
                  <input
                    type="checkbox"
                    checked={d.showInList}
                    disabled={!d.showInList && listCount >= MAX_LIST_PROPERTIES}
                    onChange={(e) => void run(() => registry.updateDef(d.id, { showInList: e.target.checked }))}
                  />
                  In list
                </label>
                <button
                  type="button"
                  className={own.action}
                  disabled={i === 0}
                  onClick={() => moveProp(i, -1)}
                  aria-label={`move ${d.name} up`}
                  title="Move up"
                >
                  <ArrowUp size={13} aria-hidden />
                </button>
                <button
                  type="button"
                  className={own.action}
                  disabled={i === selectedDefs.length - 1}
                  onClick={() => moveProp(i, 1)}
                  aria-label={`move ${d.name} down`}
                  title="Move down"
                >
                  <ArrowDown size={13} aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => void handleRemoveProp(d)}
                  aria-label={`delete ${d.name}`}
                  title="Delete property"
                >
                  <Trash size={13} aria-hidden />
                </button>
              </div>
              {d.type === 'select' && renderOptions(d)}
            </div>
          ))}
          <div className={styles.create}>
            <input
              className={styles.nameInput}
              value={newPropName}
              maxLength={MAX_PROPERTY_NAME}
              placeholder="New property…"
              aria-label="new property name"
              onChange={(e) => setNewPropName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateProp()
              }}
            />
            <select
              className={own.select}
              value={newPropType}
              onChange={(e) => setNewPropType(e.target.value as MetadataType)}
              aria-label="new property type"
            >
              {NOTE_PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {METADATA_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
            <button type="button" className={styles.add} onClick={() => void handleCreateProp()}>
              Add
            </button>
          </div>
        </div>

        <p className={own.section}>Template</p>
        <textarea
          className={own.template}
          key={`${t.id}:${t.template ?? ''}`}
          defaultValue={t.template ?? ''}
          placeholder="Markdown applied to empty notes and to “New note of this type”."
          aria-label="type template"
          onBlur={(e) =>
            commitText(e.currentTarget, t.template ?? '', (v) =>
              registry.updateType(t.id, { template: v.trim() ? v : null })
            )
          }
        />
      </div>
    )
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${styles.card} ${own.card}`}
        role="dialog"
        aria-modal="true"
        aria-label="Note types"
        onKeyDown={(e) => {
          if (
            e.key === 'Escape' &&
            !(e.target instanceof HTMLInputElement) &&
            !(e.target instanceof HTMLTextAreaElement)
          ) {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <div className={styles.header}>
          <p className={styles.title}>Note types</p>
          <button type="button" className={styles.close} onClick={onClose}>
            Done
          </button>
        </div>
        <div className={own.columns}>
          <div className={own.types}>
            {reorder && (
              <p className={own.reorderHint}>Use ↑/↓ to set the order of “By type” in the notes list.</p>
            )}
            {types.map((t, i) => (
              <div key={t.id} className={`${own.typeRow} ${t.id === selected?.id ? own.typeRowActive : ''}`}>
                <button
                  type="button"
                  className={own.typeButton}
                  style={{ color: t.color ?? undefined }}
                  onClick={() => setSelectedId(t.id)}
                  aria-pressed={t.id === selected?.id}
                >
                  <TypeIcon name={t.icon} />
                  <span className={own.typeName}>{t.name}</span>
                </button>
                <button
                  type="button"
                  className={own.action}
                  disabled={i === 0}
                  onClick={() => moveType(i, -1)}
                  aria-label={`move ${t.name} up`}
                  title="Move up"
                >
                  <ArrowUp size={12} aria-hidden />
                </button>
                <button
                  type="button"
                  className={own.action}
                  disabled={i === types.length - 1}
                  onClick={() => moveType(i, 1)}
                  aria-label={`move ${t.name} down`}
                  title="Move down"
                >
                  <ArrowDown size={12} aria-hidden />
                </button>
              </div>
            ))}
            <div className={styles.create}>
              <input
                className={styles.nameInput}
                value={newTypeName}
                maxLength={MAX_TYPE_NAME}
                placeholder="New type…"
                aria-label="new type name"
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateType()
                }}
              />
              <button type="button" className={styles.add} onClick={() => void handleCreateType()}>
                Add
              </button>
            </div>
          </div>
          {selected ? (
            renderDetail(selected)
          ) : (
            <p className={own.empty}>No types yet. Create one to give notes properties and a template.</p>
          )}
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {modal}
      </div>
    </div>,
    document.body
  )
}
