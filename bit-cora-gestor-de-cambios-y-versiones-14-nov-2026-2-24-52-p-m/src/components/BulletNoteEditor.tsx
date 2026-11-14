import React, { useEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  CornerDownRight,
  IndentDecrease,
  IndentIncrease,
  List,
  ListOrdered,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import {
  BULLET_STYLE_OPTIONS,
  BulletFamily,
  BulletItem,
  BulletStyleType,
  MAX_BULLET_INDENT,
  applyFamilyToAllItems,
  canIndentBullet,
  findParentBulletIndex,
  getDefaultStyleForLevel,
  getDisplayMarker,
  getFamilyFromStyle,
  getLevelLabel,
  indentBulletItem,
  outdentBulletItem,
  parseBulletLines,
  serializeBulletLines,
} from '../utils/bulletNotes';

interface BulletNoteEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  ariaLabel: string;
  minHeightClass?: string;
}

export const BulletNoteEditor: React.FC<BulletNoteEditorProps> = ({
  value,
  onChange,
  ariaLabel,
  minHeightClass = 'min-h-[380px]',
}) => {
  const [items, setItems] = useState<BulletItem[]>(() => parseBulletLines(value));
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const lastSerializedRef = useRef<string>(serializeBulletLines(parseBulletLines(value)));
  const inputRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const pendingFocusIndexRef = useRef<number | null>(null);

  // Sync external updates (e.g. switching module, copying base, applying diff)
  useEffect(() => {
    if (value === lastSerializedRef.current) return;
    const parsed = parseBulletLines(value);
    setItems(parsed);
    lastSerializedRef.current = value;
    setActiveIndex((prev) => Math.min(prev, Math.max(0, parsed.length - 1)));
  }, [value]);

  // Move focus cleanly when items are inserted/deleted via keyboard or toolbar
  useEffect(() => {
    if (pendingFocusIndexRef.current === null) return;
    const targetIdx = Math.max(
      0,
      Math.min(pendingFocusIndexRef.current, items.length - 1),
    );
    pendingFocusIndexRef.current = null;
    const el = inputRefs.current[targetIdx];
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [items]);

  // Keep textarea heights matched to wrapped text
  useEffect(() => {
    inputRefs.current.forEach((el) => {
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(28, el.scrollHeight)}px`;
    });
  }, [items]);

  const commitItems = (nextItems: BulletItem[], focusIndex?: number) => {
    const safeItems =
      nextItems.length > 0
        ? nextItems
        : [
            {
              id: `bi-${Date.now()}`,
              indent: 0,
              style: 'disc' as BulletStyleType,
              text: '',
            },
          ];
    setItems(safeItems);
    const serialized = serializeBulletLines(safeItems);
    lastSerializedRef.current = serialized;
    onChange(serialized);
    if (focusIndex !== undefined) {
      const clamped = Math.max(0, Math.min(focusIndex, safeItems.length - 1));
      setActiveIndex(clamped);
      pendingFocusIndexRef.current = clamped;
    }
  };

  const safeActiveIndex = Math.max(0, Math.min(activeIndex, items.length - 1));
  const activeItem = items[safeActiveIndex];
  const activeFamily: BulletFamily = activeItem
    ? getFamilyFromStyle(activeItem.style)
    : 'bullet';
  const parentIndex = findParentBulletIndex(items, safeActiveIndex);
  const parentItem = parentIndex !== null ? items[parentIndex] : null;
  const canIndent = canIndentBullet(items, safeActiveIndex);
  const canOutdent = Boolean(activeItem && activeItem.indent > 0);

  const handleTextChange = (index: number, nextText: string) => {
    const cleanText = nextText.replace(/\r?\n/g, ' ');
    const next = items.map((item, idx) =>
      idx === index ? { ...item, text: cleanText } : item,
    );
    commitItems(next);
  };

  const insertItemAfter = (index: number, indentDelta = 0) => {
    const base = items[index];
    const targetIndent = Math.max(
      0,
      Math.min(MAX_BULLET_INDENT, (base?.indent ?? 0) + indentDelta),
    );
    const family = base ? getFamilyFromStyle(base.style) : 'bullet';
    const nextStyle =
      family === 'checklist'
        ? 'checkbox-open'
        : getDefaultStyleForLevel(family, targetIndent);

    const created: BulletItem = {
      id: `bi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      indent: targetIndent,
      style: nextStyle,
      text: '',
    };
    const next = [
      ...items.slice(0, index + 1),
      created,
      ...items.slice(index + 1),
    ];
    commitItems(next, index + 1);
  };

  const removeItemAt = (index: number) => {
    if (items.length <= 1) {
      commitItems([{ ...items[0], indent: 0, text: '' }], 0);
      return;
    }
    const next = items.filter((_, idx) => idx !== index);
    commitItems(next, Math.max(0, index - 1));
  };

  const handleIndent = (index: number) => {
    const next = indentBulletItem(items, index);
    if (next !== items) {
      commitItems(next, index);
    }
  };

  const handleOutdent = (index: number) => {
    const next = outdentBulletItem(items, index);
    if (next !== items) {
      commitItems(next, index);
    }
  };

  const handleSetFamily = (family: BulletFamily) => {
    if (!activeItem) return;
    const nextStyle =
      family === 'checklist' && activeItem.style === 'checkbox-done'
        ? 'checkbox-done'
        : getDefaultStyleForLevel(family, activeItem.indent);
    const next = items.map((item, idx) =>
      idx === safeActiveIndex ? { ...item, style: nextStyle } : item,
    );
    commitItems(next, safeActiveIndex);
  };

  const handleApplyFamilyToAll = (family: BulletFamily) => {
    const next = applyFamilyToAllItems(items, family);
    commitItems(next, safeActiveIndex);
  };

  const handleSetExplicitStyle = (style: BulletStyleType) => {
    const next = items.map((item, idx) =>
      idx === safeActiveIndex ? { ...item, style } : item,
    );
    commitItems(next, safeActiveIndex);
  };

  const handleToggleChecklist = (index: number) => {
    const target = items[index];
    if (!target) return;
    const toggled: BulletStyleType =
      target.style === 'checkbox-done' ? 'checkbox-open' : 'checkbox-done';
    const next = items.map((item, idx) =>
      idx === index ? { ...item, style: toggled } : item,
    );
    commitItems(next);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number,
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      insertItemAfter(index, 0);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        handleOutdent(index);
      } else {
        handleIndent(index);
      }
      return;
    }
    if (e.key === 'Backspace' && items[index].text === '') {
      e.preventDefault();
      if (items[index].indent > 0) {
        handleOutdent(index);
      } else if (items.length > 1) {
        removeItemAt(index);
      }
      return;
    }
    if (e.key === 'ArrowUp' && index > 0) {
      const el = inputRefs.current[index - 1];
      if (el) {
        e.preventDefault();
        setActiveIndex(index - 1);
        el.focus();
      }
      return;
    }
    if (e.key === 'ArrowDown' && index < items.length - 1) {
      const el = inputRefs.current[index + 1];
      if (el) {
        e.preventDefault();
        setActiveIndex(index + 1);
        el.focus();
      }
    }
  };

  return (
    <div
      className="flex flex-1 flex-col bg-white"
      role="region"
      aria-label={ariaLabel}
    >
      {/* Bullet & Indentation Formatting Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/70 px-2.5 py-2 sm:px-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Family buttons */}
          <div
            className="flex flex-wrap items-center rounded border border-zinc-200 bg-white p-0.5"
            role="group"
            aria-label="Tipo de lista"
          >
            <button
              type="button"
              onClick={() => handleSetFamily('bullet')}
              aria-pressed={activeFamily === 'bullet'}
              title="Formato con viñetas (•, ◦, ▪, ▸)"
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                activeFamily === 'bullet'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <List className="h-3 w-3" />
              Viñetas
            </button>
            <button
              type="button"
              onClick={() => handleSetFamily('numeric')}
              aria-pressed={activeFamily === 'numeric'}
              title="Formato numérico jerárquico (1., 1.1., a), i))"
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                activeFamily === 'numeric'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <ListOrdered className="h-3 w-3" />
              Numérico
            </button>
            <button
              type="button"
              onClick={() => handleSetFamily('checklist')}
              aria-pressed={activeFamily === 'checklist'}
              title="Formato de tareas con checkbox"
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                activeFamily === 'checklist'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <CheckSquare className="h-3 w-3" />
              Checklist
            </button>
          </div>

          {/* Explicit sub-bullet / marker selector */}
          <select
            aria-label="Estilo de viñeta o sub-viñeta"
            value={
              activeItem?.style === 'checkbox-done'
                ? 'checkbox-open'
                : activeItem?.style ?? 'disc'
            }
            onChange={(e) =>
              handleSetExplicitStyle(e.target.value as BulletStyleType)
            }
            className="max-w-full rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 focus:border-blue-600 focus:outline-none"
          >
            {BULLET_STYLE_OPTIONS.map((opt) => (
              <option key={opt.style} value={opt.style}>
                {opt.preview} {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => handleApplyFamilyToAll(activeFamily)}
            title="Aplicar el estilo activo a toda la nota manteniendo la sangría"
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 whitespace-nowrap"
          >
            Aplicar a todo
          </button>
        </div>

        {/* Indentation + Insert Sub-bullet controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleOutdent(safeActiveIndex)}
            disabled={!canOutdent}
            aria-label="Reducir sangría"
            title="Reducir sangría (Shift + Tab)"
            className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
          >
            <IndentDecrease className="h-3 w-3" />
            Sangría -
          </button>
          <button
            type="button"
            onClick={() => handleIndent(safeActiveIndex)}
            disabled={!canIndent}
            aria-label="Aumentar sangría y vincular sub-viñeta"
            title="Vincular como sub-viñeta del elemento superior (Tab)"
            className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
          >
            <IndentIncrease className="h-3 w-3" />
            Sangría +
          </button>
          <button
            type="button"
            onClick={() => insertItemAfter(safeActiveIndex, 0)}
            aria-label="Agregar nueva viñeta"
            className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 whitespace-nowrap"
          >
            <Plus className="h-3 w-3" />
            Viñeta
          </button>
          <button
            type="button"
            onClick={() => insertItemAfter(safeActiveIndex, 1)}
            disabled={!activeItem || activeItem.indent >= MAX_BULLET_INDENT}
            aria-label="Agregar sub-viñeta anidada"
            className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50/70 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100/70 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
          >
            <CornerDownRight className="h-3 w-3" />
            Sub-viñeta
          </button>
        </div>
      </div>

      {/* Hierarchy Breadcrumb Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-white px-3 py-1.5 text-[11px] text-zinc-500 sm:px-4">
        <span className="truncate">
          Nivel activo:{' '}
          <strong className="font-medium text-zinc-800">
            {getLevelLabel(activeItem?.indent ?? 0)}
          </strong>
          {parentItem && (
            <>
              {' · '}
              Vinculada a:{' '}
              <span className="font-mono text-zinc-700">
                {parentItem.text.slice(0, 42) || 'Viñeta principal'}
                {parentItem.text.length > 42 ? '…' : ''}
              </span>
            </>
          )}
        </span>
        <span className="hidden font-mono text-[10px] text-zinc-400 sm:inline whitespace-nowrap">
          Enter: nueva · Tab / Shift+Tab: sangría
        </span>
      </div>

      {/* Interactive Bulleted Paper Surface */}
      <div
        className={`notebook-paper flex-1 px-2.5 py-3 sm:px-4 ${minHeightClass}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const lastIdx = Math.max(0, items.length - 1);
            setActiveIndex(lastIdx);
            inputRefs.current[lastIdx]?.focus();
          }
        }}
      >
        <ul
          className="space-y-0.5 [--indent-step:14px] sm:[--indent-step:22px]"
          role="list"
        >
          {items.map((item, idx) => {
            const isSelected = idx === safeActiveIndex;
            const isLinkedToActiveParent =
              parentIndex !== null && idx === parentIndex;
            const marker = getDisplayMarker(items, idx);
            const isCheckbox =
              item.style === 'checkbox-open' || item.style === 'checkbox-done';
            const isDone = item.style === 'checkbox-done';

            return (
              <li
                key={item.id}
                data-indent={item.indent}
                className={`group relative flex items-start rounded transition-colors ${
                  isSelected
                    ? 'bg-blue-50/45'
                    : isLinkedToActiveParent
                      ? 'bg-zinc-100/70'
                      : 'hover:bg-zinc-50/70'
                }`}
                style={{ paddingLeft: `calc(var(--indent-step) * ${item.indent})` }}
              >
                {/* Vertical tree guide connectors linking sub-bullets to parent bullets */}
                {Array.from({ length: item.indent }).map((_, levelIdx) => (
                  <span
                    key={levelIdx}
                    aria-hidden="true"
                    className={`pointer-events-none absolute top-0 bottom-0 border-l ${
                      levelIdx === item.indent - 1 && isSelected
                        ? 'border-blue-400'
                        : 'border-zinc-300/80'
                    }`}
                    style={{ left: `calc(var(--indent-step) * ${levelIdx} + 8px)` }}
                  />
                ))}

                {/* Marker / Interactive Checkbox */}
                <div className="flex h-7 min-w-[2.1rem] shrink-0 items-center justify-center pr-1.5 pt-0.5 select-none">
                  {isCheckbox ? (
                    <button
                      type="button"
                      onClick={() => handleToggleChecklist(idx)}
                      aria-label={
                        isDone
                          ? `Marcar como pendiente: ${item.text}`
                          : `Marcar como completado: ${item.text}`
                      }
                      className={`flex h-4 w-4 items-center justify-center rounded transition-colors ${
                        isDone
                          ? 'text-emerald-600 hover:text-emerald-700'
                          : 'text-zinc-400 hover:text-blue-600'
                      }`}
                    >
                      {isDone ? (
                        <CheckSquare className="h-3.5 w-3.5" />
                      ) : (
                        <Square className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <span
                      className={`font-mono text-xs font-semibold ${
                        item.indent === 0
                          ? 'text-zinc-900'
                          : item.indent === 1
                            ? 'text-blue-700'
                            : item.indent === 2
                              ? 'text-teal-700'
                              : 'text-amber-700'
                      }`}
                    >
                      {marker}
                    </span>
                  )}
                </div>

                {/* Bullet text input */}
                <textarea
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  rows={1}
                  value={item.text}
                  onFocus={() => setActiveIndex(idx)}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  aria-label={`${ariaLabel} · Ítem ${idx + 1} (${getLevelLabel(item.indent)})`}
                  placeholder={
                    idx === 0 && !item.text
                      ? 'Escribe una nota en formato viñeta...'
                      : item.indent > 0
                        ? 'Sub-viñeta vinculada...'
                        : 'Siguiente viñeta...'
                  }
                  spellCheck={false}
                  className={`min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-1 pr-2 font-mono text-[13px] leading-5 focus:outline-none ${
                    isDone
                      ? 'text-zinc-400 line-through'
                      : item.indent === 0
                        ? 'font-medium text-zinc-900'
                        : 'text-zinc-800'
                  }`}
                />

                {/* Row Delete Action */}
                <button
                  type="button"
                  onClick={() => removeItemAt(idx)}
                  aria-label={`Eliminar ítem ${idx + 1}`}
                  className="mr-1 mt-1 rounded p-1 text-zinc-400 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
