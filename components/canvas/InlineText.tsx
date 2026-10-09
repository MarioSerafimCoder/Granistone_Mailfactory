'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import type { RichNode } from '@/types/campaign';
import { safeUrl, sanitizeRichText } from '@/lib/safety';

function fieldValue(value: RichNode, links: boolean): RichNode {
  const clean = sanitizeRichText(value);
  const stripLinks = (node: RichNode): RichNode => ({ ...node, ...(node.marks ? { marks: node.marks.filter(mark => mark.type !== 'link') } : {}), ...(node.content ? { content: node.content.map(stripLinks) } : {}) });
  return links ? clean : stripLinks(clean);
}

export default function InlineText({ value, label, kind = 'text', links = kind !== 'button', readOnly, onChange, onSelect, onUndo, onRedo }: {
  value: RichNode; label: string; kind?: 'title' | 'text' | 'body' | 'button' | 'kicker'; links?: boolean; readOnly: boolean;
  onChange: (v: RichNode) => void; onSelect: () => void; onUndo: () => void; onRedo: () => void;
}) {
  const host = useRef<HTMLDivElement>(null), editor = useRef<Editor | null>(null);
  const [e, setEditor] = useState<Editor>();
  const live = useRef({ onChange, onSelect, onUndo, onRedo, readOnly });
  const [bubble, setBubble] = useState<{ top: number; left: number }>();
  const [, redraw] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false), [url, setUrl] = useState(''), [error, setError] = useState('');
  const bubbleHost = useRef<HTMLDivElement>(null);
  const applyHistory = useRef(false);
  const undo = () => { applyHistory.current = true; live.current.onUndo(); };
  const redo = () => { applyHistory.current = true; live.current.onRedo(); };
  useLayoutEffect(() => { live.current = { onChange, onSelect, onUndo, onRedo, readOnly }; });
  useEffect(() => {
    const instance = new Editor({
      element: host.current!, content: fieldValue(value, links), editable: !readOnly,
      extensions: [StarterKit.configure({ history: false, heading: false, codeBlock: false, code: false, strike: false, horizontalRule: false, orderedList: false, bulletList: kind === 'body' ? {} : false, listItem: kind === 'body' ? {} : false, blockquote: kind === 'body' ? {} : false }), Underline, ...(links ? [Link.configure({ openOnClick: false, autolink: false, validate: url => !!safeUrl(url) })] : []), TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right'] })],
      editorProps: {
        attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', spellcheck: 'true' },
        handleKeyDown: (_view, event) => {
          if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
            event.preventDefault(); event.stopPropagation();
            if (event.shiftKey || event.key.toLowerCase() === 'y') { applyHistory.current = true; live.current.onRedo(); }
            else { applyHistory.current = true; live.current.onUndo(); }
            return true;
          }
          return false;
        },
      },
      onFocus: () => live.current.onSelect(),
      onCreate: ({ editor }) => setEditor(editor),
      onUpdate: ({ editor }) => { if (!live.current.readOnly) live.current.onChange(sanitizeRichText(editor.getJSON() as RichNode)); },
    });
    editor.current = instance;
    const position = () => {
      const { from, to } = instance.state.selection;
      if (!instance.isEditable) { setBubble(undefined); return; }
      // The link input temporarily owns focus; retain the ProseMirror selection.
      // Outside clicks and the deferred blur handler close the bubble instead.
      if (!instance.isFocused) return;
      if (from === to) { setBubble(undefined); return; }
      const bounds = instance.view.coordsAtPos(from);
      setBubble({ top: bounds.top > 62 ? bounds.top - 48 : instance.view.coordsAtPos(to).bottom + 8, left: Math.max(12, Math.min(bounds.left, window.innerWidth - 490)) });
      redraw(n => n + 1);
    };
    instance.on('selectionUpdate', position); instance.on('transaction', position);
    const blur = () => { window.setTimeout(() => { if (!bubbleHost.current?.contains(document.activeElement)) { setBubble(undefined); setLinkOpen(false); } }, 0); };
    instance.on('blur', blur);
    const outside = (event: PointerEvent) => { const target = event.target as Node; if (!host.current?.contains(target) && !bubbleHost.current?.contains(target)) { setBubble(undefined); setLinkOpen(false); } };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', position, true); window.removeEventListener('resize', position); instance.destroy(); editor.current = null; };
    // A field's editor lives as long as its stable block/language key, never per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const instance = editor.current;
    if (!instance) return;
    if (instance.isEditable === readOnly) instance.setEditable(!readOnly, false);
    // Local typing may render an older parent snapshot before the latest keystroke is saved.
    // Replacing a focused ProseMirror document with that snapshot moves its caret.
    if (instance.isFocused && !readOnly && !applyHistory.current) return;
    applyHistory.current = false;
    const clean = fieldValue(value, links);
    if (JSON.stringify(sanitizeRichText(instance.getJSON() as RichNode)) !== JSON.stringify(clean)) {
      const { from, to } = instance.state.selection;
      instance.commands.setContent(clean, false);
      const max = instance.state.doc.content.size;
      instance.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
    }
  }, [value, readOnly, links]);
  const run = (command: (e: Editor) => void) => { const e = editor.current; if (e && !readOnly) { command(e); redraw(n => n + 1); } };
  return <div className={`canvas-text canvas-${kind}${readOnly ? ' locked' : ''}`} data-field-label={label} onClick={event => { event.stopPropagation(); onSelect(); }}>
    <div ref={host} />
    {bubble && !readOnly && createPortal(<div ref={bubbleHost} className="canvas-bubble" role="toolbar" aria-label="Formatação da seleção" style={bubble} onMouseDown={event => { if ((event.target as HTMLElement).closest('button')) event.preventDefault(); }}>
      <button aria-label="Negrito" aria-pressed={e?.isActive('bold') ?? false} onClick={() => run(e => e.chain().focus().toggleBold().run())}><b>B</b></button>
      <button aria-label="Itálico" aria-pressed={e?.isActive('italic') ?? false} onClick={() => run(e => e.chain().focus().toggleItalic().run())}><i>I</i></button>
      <button aria-label="Sublinhado" aria-pressed={e?.isActive('underline') ?? false} onClick={() => run(e => e.chain().focus().toggleUnderline().run())}><u>U</u></button>
      {links && <button aria-pressed={e?.isActive('link') ?? false} onClick={() => { setUrl(String(e?.getAttributes('link').href ?? '')); setLinkOpen(!linkOpen); }}>Link</button>}
      {kind === 'body' && <button aria-pressed={e?.isActive('bulletList') ?? false} onClick={() => run(e => e.chain().focus().toggleBulletList().run())}>Lista</button>}
      {(['left', 'center', 'right'] as const).map((align, i) => <button key={align} aria-label={['Alinhar texto à esquerda', 'Centralizar texto', 'Alinhar texto à direita'][i]} aria-pressed={e?.isActive({ textAlign: align }) ?? false} onClick={() => run(e => e.chain().focus().setTextAlign(align).run())}>{['←', '↔', '→'][i]}</button>)}
      <button aria-label="Desfazer texto" onClick={undo}>↶</button><button aria-label="Refazer texto" onClick={redo}>↷</button>
      {linkOpen && <form onSubmit={event => { event.preventDefault(); if (url && !safeUrl(url)) { setError('Use um link HTTP, HTTPS, mailto ou tel válido.'); return; } run(e => url ? e.chain().focus().extendMarkRange('link').setLink({ href: safeUrl(url) }).run() : e.chain().focus().unsetLink().run()); setLinkOpen(false); setError(''); }}><input aria-label="Endereço do link" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" /><button type="submit">Aplicar</button>{error && <small role="alert">{error}</small>}</form>}
    </div>, document.body)}
  </div>;
}
