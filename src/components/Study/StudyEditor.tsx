import { useImperativeHandle, useRef, type JSX, type Ref } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import type { StringsShape } from "../../data/strings";
import styles from "./StudyEditor.module.scss";

export interface StudyEditorHandle {
  /** Inserts HTML at the caret — or where it last was, if the editor lost focus. */
  insertHtml(html: string): void;
}

interface StudyEditorProps {
  /** Read once, on mount — key the component by study id to load another. */
  initialHtml: string;
  placeholder: string;
  labels: StringsShape;
  onChange(html: string): void;
  ref?: Ref<StudyEditorHandle>;
}

// TipTap (ProseMirror) rather than a bare contentEditable: its schema is the
// sanitizer — pasted Word / Google Docs / web markup is parsed into these
// nodes and marks only, everything else is dropped — and it owns undo/redo,
// the selection and the toolbar's pressed states.
//
// The vocabulary is kept to what the PDF export lays out (lib/pdf/studyPdf.ts):
// paragraphs, two heading levels, bold, italic, lists and block quotes.
// Extending it means teaching the PDF the new node too.
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    link: false,
    horizontalRule: false
  })
];

export function StudyEditor({ initialHtml, placeholder, labels: t, onChange, ref }: StudyEditorProps): JSX.Element {
  // useEditor builds the editor once; route onChange through a ref so a new
  // callback identity from the parent doesn't need to rebuild it.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [...EXTENSIONS, Placeholder.configure({ placeholder })],
    content: initialHtml,
    editorProps: {
      attributes: { class: styles.editor, "aria-label": placeholder, "aria-multiline": "true", role: "textbox" }
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(e.isEmpty ? "" : e.getHTML())
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      h2: e?.isActive("heading", { level: 2 }) ?? false,
      h3: e?.isActive("heading", { level: 3 }) ?? false,
      ul: e?.isActive("bulletList") ?? false,
      ol: e?.isActive("orderedList") ?? false,
      quote: e?.isActive("blockquote") ?? false
    })
  });

  // ProseMirror keeps its selection while blurred, so focus() restores the
  // caret to where the preacher was writing before clicking "Insert".
  useImperativeHandle(ref, () => ({
    insertHtml: (html: string) => {
      editor?.chain().focus().insertContent(html).run();
    }
  }), [editor]);

  const tools: { key: string; label: string; glyph: string; on: boolean; run(): void }[] = editor
    ? [
        { key: "bold", label: t.fmtBold, glyph: "B", on: active.bold, run: () => editor.chain().focus().toggleBold().run() },
        { key: "italic", label: t.fmtItalic, glyph: "I", on: active.italic, run: () => editor.chain().focus().toggleItalic().run() },
        { key: "h2", label: t.fmtHeading, glyph: "H1", on: active.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
        { key: "h3", label: t.fmtSubheading, glyph: "H2", on: active.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
        { key: "p", label: t.fmtParagraph, glyph: "¶", on: false, run: () => editor.chain().focus().setParagraph().run() },
        { key: "ul", label: t.fmtBullets, glyph: "•", on: active.ul, run: () => editor.chain().focus().toggleBulletList().run() },
        { key: "ol", label: t.fmtNumbers, glyph: "1.", on: active.ol, run: () => editor.chain().focus().toggleOrderedList().run() },
        { key: "quote", label: t.fmtQuote, glyph: "“", on: active.quote, run: () => editor.chain().focus().toggleBlockquote().run() }
      ]
    : [];

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} role="toolbar">
        {tools.map((tool) => (
          <button
            key={tool.key}
            type="button"
            className={styles.tool}
            data-tool={tool.key}
            data-on={tool.on ? "yes" : "no"}
            aria-pressed={tool.on}
            title={tool.label}
            aria-label={tool.label}
            // Taking focus would blur the editor, and refocusing it drops a
            // pending mark — Bold, then typing, would come out plain.
            onMouseDown={(event) => event.preventDefault()}
            onClick={tool.run}
          >
            {tool.glyph}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
