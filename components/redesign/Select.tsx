"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type SelectHTMLAttributes } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import styles from './select.module.css';

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'>;
type Option = { value: string; label: string; disabled: boolean };

/** A single-value select. The native field preserves forms, labels and change events;
 * the visible combobox owns the themed menu and keyboard navigation. */
export function Select({ children, className, style, onChange, onInvalid, ...props }: Props) {
  const uid = useId(), field = useRef<HTMLSelectElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<Option[]>([]), [selected, setSelected] = useState(''), [label, setLabel] = useState('');
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const search = useRef({ text: '', time: 0 });

  useLayoutEffect(() => {
    const native = field.current!;
    const next = Array.from(native.options, o => ({ value: o.value, label: o.label, disabled: o.disabled || (o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled) }));
    setOptions(prior => JSON.stringify(prior) === JSON.stringify(next) ? prior : next);
    setSelected(native.value);
    const name = Array.from(native.labels || [], l => { const clone = l.cloneNode(true) as HTMLElement; clone.querySelectorAll('select,button,[data-hive-select-menu]').forEach(e => e.remove()); return clone.textContent?.trim() || ''; }).join(' ');
    setLabel(name);
  }, [children, props.value, props.defaultValue]);

  useLayoutEffect(() => {
    const native = field.current!, form = native.form;
    const reset = () => requestAnimationFrame(() => { setSelected(native.value); setOpen(false); });
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, []);

  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const popup = menu.current, button = trigger.current;
    const position = () => {
      const r = button.getBoundingClientRect(), viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
      const below = top + height - r.bottom - 12, above = r.top - top - 12;
      const up = below < 240 && above > below, space = Math.max(44, up ? above : below);
      const w = Math.min(Math.max(r.width, 220), width - 16);
      Object.assign(popup.style, { width: `${w}px`, maxHeight: `${Math.min(320, space)}px`, left: `${Math.max(left + 8, Math.min(r.left, left + width - w - 8))}px`, top: up ? 'auto' : `${r.bottom + 6}px`, bottom: up ? `${innerHeight - r.top + 6}px` : 'auto' });
    };
    position();
    // Popover places the list above clipping containers and inside a modal's top layer.
    popup.showPopover?.();
    const outside = (event: PointerEvent) => { if (!popup.contains(event.target as Node) && !button.contains(event.target as Node)) setOpen(false); };
    const focus = (event: FocusEvent) => { if (!popup.contains(event.target as Node) && event.target !== button) setOpen(false); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', focus);
    window.addEventListener('resize', position); window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    return () => { popup.hidePopover?.(); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('focusin', focus); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); window.visualViewport?.removeEventListener('resize', position); };
  }, [open]);

  useLayoutEffect(() => { if (open) document.getElementById(`${uid}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, open, uid]);
  useLayoutEffect(() => { if (props.disabled) setOpen(false); }, [props.disabled]);

  const enabled = options.map((o, i) => o.disabled ? -1 : i).filter(i => i >= 0);
  function expand(index = options.findIndex(o => o.value === selected && !o.disabled)) {
    if (trigger.current?.matches(':disabled') || !enabled.length) return;
    setActive(index >= 0 ? index : enabled[0]); setOpen(true); search.current = { text: '', time: 0 };
  }
  function choose(index: number) {
    const option = options[index], native = field.current;
    if (!native || !option || option.disabled || trigger.current?.matches(':disabled')) return;
    if (native.value !== option.value) {
      native.value = option.value;
      native.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setOpen(false);
  }
  function keyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'Tab') { if (open) choose(active); return; }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Enter' || e.key === ' ') { if (open) choose(active); else expand(); return; }
      if (e.key === 'Home' || e.key === 'End') { expand(e.key === 'Home' ? enabled[0] : enabled.at(-1)); return; }
      if (!open) { expand(); return; }
      const step = e.key === 'PageDown' ? 10 : e.key === 'PageUp' ? -10 : e.key === 'ArrowDown' ? 1 : -1;
      setActive(enabled[Math.max(0, Math.min(enabled.length - 1, enabled.indexOf(active) + step))]); return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); const now = Date.now(), char = e.key.toLocaleLowerCase();
      let query = now - search.current.time < 650 ? search.current.text + char : char;
      if ([...query].every(c => c === char)) query = char;
      search.current = { text: query, time: now };
      const start = open ? active : options.findIndex(o => o.value === selected);
      const ordered = query.length === 1 ? [...enabled.filter(i => i > start), ...enabled.filter(i => i <= start)] : enabled;
      const match = ordered.find(i => options[i].label.toLocaleLowerCase().startsWith(query));
      if (match !== undefined) { setActive(match); setOpen(true); }
    }
  }

  const name = props['aria-label'] || label || props.title || 'Choose an option';
  return <span className={styles.root} data-hive-select>
    <select {...props} ref={field} className={styles.native} aria-hidden="true" tabIndex={-1}
      onFocus={() => trigger.current?.focus()} onInvalid={e => { e.preventDefault(); trigger.current?.focus(); onInvalid?.(e); }}
      onChange={e => { setSelected(e.target.value); onChange?.(e); }}>{children}</select>
    <button ref={trigger} type="button" role="combobox" className={`${styles.trigger} ${className || ''}`} style={style}
      disabled={props.disabled} aria-label={name} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']} aria-required={props.required} aria-expanded={open} aria-haspopup="listbox" aria-controls={`${uid}-menu`}
      aria-activedescendant={open && active >= 0 ? `${uid}-option-${active}` : undefined}
      onKeyDown={keyDown} onClick={e => { e.preventDefault(); if (open) setOpen(false); else expand(); }}>
      <span className={styles.value}>{options.find(o => o.value === selected)?.label || '\u00a0'}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div ref={menu} id={`${uid}-menu`} popover="manual" role="listbox" aria-label={name} className={styles.menu} data-hive-select-menu>
      {options.map((o, i) => <div key={`${o.value}-${i}`} id={`${uid}-option-${i}`} role="option" aria-selected={o.value === selected} aria-disabled={o.disabled || undefined}
        className={styles.option} data-active={i === active} onPointerMove={e => { if (e.pointerType === 'mouse' && !o.disabled) setActive(i); }}
        onPointerDown={e => e.preventDefault()} onClick={e => { e.preventDefault(); e.stopPropagation(); choose(i); }}>
        <span>{o.label}</span>{o.value === selected && <Check size={16} aria-hidden="true" />}
      </div>)}
    </div>}
  </span>;
}
