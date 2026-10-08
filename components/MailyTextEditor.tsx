'use client';
import { useState } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Editor } from '@maily-to/core';
import { Extension, Node, type Editor as TiptapEditor } from '@tiptap/core';
import TextAlign from '@tiptap/extension-text-align';
import type {} from '@tiptap/starter-kit';
import type {} from '@tiptap/extension-underline';
import { MailyKit, PlaceholderExtension, VariableExtension } from '@maily-to/core/extensions';
import { sanitizeRichText, hasRestrictedFormatting } from '@/lib/safety';
import type { RichNode } from '@/types/campaign';
// Maily's bubble components expect its text/color storage even with menus hidden.
// Keep the native kit and remove layout extensions; normalize all persisted output.
const restrictedKit = MailyKit.extend({
  addExtensions() {
    const base = this.parent?.() ?? [];
    // The upstream document explicitly requires a columns group. Replace it when
    // disabling columns, while retaining native storage used by bubble menus.
    return [
      ...base.filter((extension) => extension.name !== 'doc' && extension.name !== 'textAlign'),
      Node.create({ name: 'doc', topNode: true, content: 'block+' }),
    ];
  },
}).configure({
  linkCard: false,
  repeat: false,
  section: false,
  columns: false,
  column: false,
  button: false,
  spacer: false,
  logo: false,
  image: false,
});
const disabled = ['slash-command', 'htmlCodeBlock', 'inlineImage'].map((name) =>
  Extension.create({ name }),
);
const extensions = [
  restrictedKit,
  TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right'] }),
  ...disabled,
  VariableExtension.configure({ variables: [] }),
  PlaceholderExtension.configure({ placeholder: 'Escreva o texto da campanha…' }),
];
export default function MailyTextEditor({
  value,
  onChange,
}: {
  value: RichNode;
  onChange: (value: RichNode) => void;
}) {
  const [editor, setEditor] = useState<TiptapEditor>();
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  return (
    <div className="rich-editor">
      <div className="rich-toolbar" aria-label="Formatação de texto">
        <button
          type="button"
          aria-label="Negrito"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <b>B</b>
        </button>
        <button
          type="button"
          aria-label="Itálico"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <i>I</i>
        </button>
        <button
          type="button"
          aria-label="Sublinhado"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          Lista
        </button>
        <button type="button" aria-label="Alinhar texto à esquerda" title="Alinhar texto à esquerda" aria-pressed={!!editor?.isActive({ textAlign: 'left' })}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}><AlignLeft size={16} /></button>
        <button type="button" aria-label="Centralizar texto" title="Centralizar texto" aria-pressed={!!editor?.isActive({ textAlign: 'center' })}
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}><AlignCenter size={16} /></button>
        <button type="button" aria-label="Alinhar texto à direita" title="Alinhar texto à direita" aria-pressed={!!editor?.isActive({ textAlign: 'right' })}
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}><AlignRight size={16} /></button>
        <button
          type="button"
          onClick={() => {
            setLink(String(editor?.getAttributes('link').href ?? ''));
            setLinkOpen(!linkOpen);
          }}
        >
          Link
        </button>
        <button
          type="button"
          aria-label="Desfazer texto"
          onClick={() => editor?.chain().focus().undo().run()}
        >
          ↶
        </button>
      </div>
      {linkOpen && (
        <div className="link-form">
          <input
            aria-label="Link do texto"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
          />
          <button
            type="button"
            onClick={() => {
              if (/^https?:\/\//.test(link))
                editor?.chain().focus().extendMarkRange('link').setLink({ href: link }).run();
              else if (!link) editor?.chain().focus().unsetLink().run();
              setLinkOpen(false);
            }}
          >
            Aplicar
          </button>
        </div>
      )}
      <Editor
        contentJson={value}
        extensions={extensions}
        blocks={[]}
        config={{
          hasMenuBar: false,
          hideContextMenu: true,
          autofocus: false,
          immediatelyRender: false,
          spellCheck: true,
        }}
        onCreate={(e) => {
          setEditor(e);
          e.view.dom.setAttribute('aria-label', 'Texto editorial');
          e.view.dom.setAttribute('role', 'textbox');
        }}
        onUpdate={(e) => {
          const raw = e.getJSON() as RichNode;
          const clean = sanitizeRichText(raw);
          if (hasRestrictedFormatting(raw)) {
            const position = e.state.selection.from;
            e.commands.setContent(clean, false);
            e.commands.setTextSelection(Math.min(position, e.state.doc.content.size - 1));
          }
          onChange(clean);
        }}
      />
    </div>
  );
}
