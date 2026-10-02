import { useImperativeHandle, useRef, useState, type FormEvent, type JSX, type ReactNode, type Ref } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { saveStudyImage, studyImageUrl } from "../../state/studyImages";
import { openExternal } from "../../lib/externalLinks";
import type { StringsShape } from "../../data/strings";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BulletListIcon,
  ImagePlusIcon,
  LinkIcon,
  NumberedListIcon,
  QuoteIcon,
  RuleIcon,
  VideoIcon
} from "../icons";
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

// Images are stored in IndexedDB and referenced as `study-image:<id>`
// (state/studyImages.ts), which an <img> can't load — so the node view
// resolves the src to an object URL. getHTML() still writes the stored src.
const StudyImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const img = document.createElement("img");
      let shown: string | null = null;
      const show = (attrs: Record<string, unknown>): void => {
        img.alt = typeof attrs.alt === "string" ? attrs.alt : "";
        const src = typeof attrs.src === "string" ? attrs.src : "";
        if (src === shown) return;
        shown = src;
        void studyImageUrl(src).then((url) => {
          if (shown !== src) return;
          if (url) img.src = url;
          else img.dataset.missing = "true";
        });
      };
      show(node.attrs);
      return {
        dom: img,
        update: (next) => {
          if (next.type !== node.type) return false;
          show(next.attrs);
          return true;
        }
      };
    };
  }
});

// TipTap (ProseMirror) rather than a bare contentEditable: its schema is the
// sanitizer — pasted Word / Google Docs / web markup is parsed into these
// nodes and marks only, everything else is dropped — and it owns undo/redo,
// the selection and the toolbar's pressed states.
//
// The vocabulary is kept to what the PDF export lays out (lib/pdf/studyPdf.ts):
// paragraphs, two heading levels, bold, italic, links, lists, block quotes,
// alignment, dividers, images and YouTube videos (printed as their link).
// Extending it means teaching the PDF the new node too.
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    // A plain click puts the caret in the link (see handleDOMEvents below).
    link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { target: null } }
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  StudyImage,
  Youtube.configure({
    nocookie: true,
    modestBranding: true,
    rel: 0,
    // `allowfullscreen` alone isn't enough for every webview: the iframe's
    // permissions policy has to grant fullscreen too. (On macOS the webview
    // itself also needs it enabled — see src-tauri/Cargo.toml.)
    HTMLAttributes: { allow: "fullscreen; picture-in-picture; encrypted-media; clipboard-write" }
  })
];

/** What the preacher typed into the link field, as an href — "bibleql.org" gets https://. */
function normalizeHref(raw: string): string {
  const value = raw.trim();
  if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(value)) return `mailto:${value}`;
  return `https://${value}`;
}

/**
 * After inserting an image or a video, TipTap leaves that node selected —
 * so the next keystroke or insert would replace it. Put the caret in the
 * paragraph after it instead, adding one if there isn't one.
 */
function caretAfterNode(e: Editor): void {
  const { selection } = e.state;
  if (!(selection instanceof NodeSelection)) return;
  const end = selection.to;
  if (!e.state.doc.resolve(end).nodeAfter?.isTextblock) e.chain().insertContentAt(end, { type: "paragraph" }).run();
  e.chain().focus().setTextSelection(end + 1).run();
}

type UrlPrompt = { kind: "link" | "video"; value: string; invalid: boolean };

interface Tool {
  key: string;
  label: string;
  glyph: ReactNode;
  on?: boolean;
  run(): void;
}

export function StudyEditor({ initialHtml, placeholder, labels: t, onChange, ref }: StudyEditorProps): JSX.Element {
  // useEditor builds the editor once; route onChange through a ref so a new
  // callback identity from the parent doesn't need to rebuild it.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const fileInput = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState<UrlPrompt | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  // Paste and drop handlers are fixed when the editor is built, before it
  // exists to close over; they reach it through this ref.
  const editorRef = useRef<Editor | null>(null);

  async function insertImages(files: File[], at?: number): Promise<void> {
    setImageFailed(false);
    for (const file of files) {
      try {
        const src = await saveStudyImage(file);
        const e = editorRef.current;
        if (!e) return;
        if (at === undefined) e.chain().focus().setImage({ src }).run();
        else e.chain().focus().insertContentAt(at, { type: "image", attrs: { src } }).run();
        caretAfterNode(e);
      } catch {
        setImageFailed(true);
      }
    }
  }
  const insertImagesRef = useRef(insertImages);
  insertImagesRef.current = insertImages;

  const editor = useEditor({
    extensions: [...EXTENSIONS, Placeholder.configure({ placeholder })],
    content: initialHtml,
    editorProps: {
      attributes: { class: styles.editor, "aria-label": placeholder, "aria-multiline": "true", role: "textbox" },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        void insertImagesRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        void insertImagesRef.current(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
      handleDOMEvents: {
        // Without this, the app-wide handler (lib/externalLinks.ts) would send
        // every click on a link to the browser, and the link could never be
        // edited. Cmd/Ctrl-click follows it, as in a word processor.
        click: (_view, event) => {
          const anchor = (event.target as Element | null)?.closest?.("a[href]");
          if (!anchor) return false;
          event.preventDefault();
          if (event.metaKey || event.ctrlKey) openExternal(anchor.getAttribute("href") ?? "");
          return false;
        }
      }
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(e.isEmpty ? "" : e.getHTML())
  });
  editorRef.current = editor;

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      h2: e?.isActive("heading", { level: 2 }) ?? false,
      h3: e?.isActive("heading", { level: 3 }) ?? false,
      ul: e?.isActive("bulletList") ?? false,
      ol: e?.isActive("orderedList") ?? false,
      quote: e?.isActive("blockquote") ?? false,
      center: e?.isActive({ textAlign: "center" }) ?? false,
      right: e?.isActive({ textAlign: "right" }) ?? false,
      justify: e?.isActive({ textAlign: "justify" }) ?? false,
      link: e?.isActive("link") ?? false
    })
  });

  // ProseMirror keeps its selection while blurred, so focus() restores the
  // caret to where the preacher was writing before clicking "Insert".
  useImperativeHandle(ref, () => ({
    insertHtml: (html: string) => {
      editor?.chain().focus().insertContent(html).run();
    }
  }), [editor]);

  function openPrompt(kind: UrlPrompt["kind"]): void {
    if (prompt?.kind === kind) {
      setPrompt(null);
      return;
    }
    const href = kind === "link" ? ((editor?.getAttributes("link").href as string | undefined) ?? "") : "";
    setPrompt({ kind, value: href, invalid: false });
  }

  function closePrompt(): void {
    setPrompt(null);
    editor?.commands.focus();
  }

  function applyPrompt(event: FormEvent): void {
    event.preventDefault();
    if (!editor || !prompt) return;
    if (prompt.kind === "video") {
      const ok = editor.chain().focus().setYoutubeVideo({ src: prompt.value.trim() }).run();
      if (ok) {
        caretAfterNode(editor);
        setPrompt(null);
      }
      else setPrompt({ ...prompt, invalid: true });
      return;
    }
    const href = normalizeHref(prompt.value);
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected to link: insert the address itself as the link text.
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: prompt.value.trim(), marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setPrompt(null);
  }

  function removeLink(): void {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setPrompt(null);
  }

  const groups: Tool[][] = editor
    ? [
        [
          { key: "bold", label: t.fmtBold, glyph: "B", on: active.bold, run: () => editor.chain().focus().toggleBold().run() },
          { key: "italic", label: t.fmtItalic, glyph: "I", on: active.italic, run: () => editor.chain().focus().toggleItalic().run() },
          {
            key: "h2",
            label: t.fmtHeading,
            glyph: <>H<sub>2</sub></>,
            on: active.h2,
            run: () => editor.chain().focus().toggleHeading({ level: 2 }).run()
          },
          {
            key: "h3",
            label: t.fmtSubheading,
            glyph: <>H<sub>3</sub></>,
            on: active.h3,
            run: () => editor.chain().focus().toggleHeading({ level: 3 }).run()
          },
          { key: "ul", label: t.fmtBullets, glyph: <BulletListIcon />, on: active.ul, run: () => editor.chain().focus().toggleBulletList().run() },
          { key: "ol", label: t.fmtNumbers, glyph: <NumberedListIcon />, on: active.ol, run: () => editor.chain().focus().toggleOrderedList().run() },
          { key: "quote", label: t.fmtQuote, glyph: <QuoteIcon size={14} />, on: active.quote, run: () => editor.chain().focus().toggleBlockquote().run() }
        ],
        [
          {
            key: "left",
            label: t.fmtAlignLeft,
            glyph: <AlignLeftIcon />,
            on: !active.center && !active.right && !active.justify,
            // Left is the default: unset rather than write text-align: left.
            run: () => editor.chain().focus().unsetTextAlign().run()
          },
          { key: "center", label: t.fmtAlignCenter, glyph: <AlignCenterIcon />, on: active.center, run: () => editor.chain().focus().setTextAlign("center").run() },
          { key: "right", label: t.fmtAlignRight, glyph: <AlignRightIcon />, on: active.right, run: () => editor.chain().focus().setTextAlign("right").run() },
          { key: "justify", label: t.fmtJustify, glyph: <AlignJustifyIcon />, on: active.justify, run: () => editor.chain().focus().setTextAlign("justify").run() },
          { key: "rule", label: t.fmtRule, glyph: <RuleIcon />, run: () => editor.chain().focus().setHorizontalRule().run() },
          { key: "link", label: t.fmtLink, glyph: <LinkIcon />, on: active.link || prompt?.kind === "link", run: () => openPrompt("link") },
          { key: "image", label: t.fmtImage, glyph: <ImagePlusIcon />, run: () => fileInput.current?.click() },
          { key: "video", label: t.fmtVideo, glyph: <VideoIcon />, on: prompt?.kind === "video", run: () => openPrompt("video") }
        ]
      ]
    : [];

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <div className={styles.toolbar} role="toolbar">
          {groups.map((group, i) => (
            <div key={i} className={styles.group}>
              {group.map((tool) => (
                <button
                  key={tool.key}
                  type="button"
                  className={styles.tool}
                  data-tool={tool.key}
                  data-on={tool.on ? "yes" : "no"}
                  aria-pressed={tool.on ?? undefined}
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
          ))}
        </div>

        {prompt && (
          <form className={styles.urlBar} onSubmit={applyPrompt}>
            <input
              className={styles.urlInput}
              type="text"
              inputMode="url"
              autoFocus
              value={prompt.value}
              placeholder={prompt.kind === "link" ? "https://" : "https://www.youtube.com/watch?v=…"}
              aria-label={prompt.kind === "link" ? t.linkUrl : t.videoUrl}
              aria-invalid={prompt.invalid}
              onChange={(event) => setPrompt({ ...prompt, value: event.target.value, invalid: false })}
              onKeyDown={(event) => {
                if (event.key === "Escape") closePrompt();
              }}
            />
            <button type="submit" className={styles.urlButton}>
              {t.applyUrl}
            </button>
            {prompt.kind === "link" && active.link && (
              <button type="button" className={styles.urlButton} onClick={removeLink}>
                {t.removeLink}
              </button>
            )}
            <button type="button" className={styles.urlButton} onClick={closePrompt}>
              {t.cancel}
            </button>
            {prompt.invalid && (
              <span className={styles.urlError} role="alert">
                {t.invalidVideo}
              </span>
            )}
          </form>
        )}
        {imageFailed && (
          <p className={styles.urlError} role="alert">
            {t.imageError}
          </p>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label={t.fmtImage}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = ""; // picking the same file again should still fire
          if (files.length) void insertImages(files);
        }}
      />
      <EditorContent editor={editor} />
    </div>
  );
}
