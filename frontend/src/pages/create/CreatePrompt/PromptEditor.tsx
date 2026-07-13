import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorContent, Node, ReactNodeViewRenderer, mergeAttributes, useEditor, type NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TiptapImage from '@tiptap/extension-image';
import {
  Italic as IconItalic,
  Strikethrough as IconStrike,
  Code as IconInlineCode,
  ListOrdered as IconListOrdered,
  ListChecks as IconListChecks,
  Link2 as IconLink,
  ImagePlus as IconImage,
} from 'lucide-react';
import { TOKENS } from '@/lib/tokens';
import { Button } from '@/components/ui';
import { I } from '@/components/icons';
import {
  createPromptMentionNode,
  promptDocToMarkdown,
  promptMarkdownToDoc,
  type PromptMentionAttrs,
} from './promptMarkdown';

export interface PromptEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  disabled?: boolean;
  promptCount?: number;
  /** 是否启用 @prompt 引用（默认 true，保留 CreatePrompt 行为） */
  enableMentions?: boolean;
  /** 是否启用图片：工具栏上传 + 粘贴 + 拖拽 */
  enableImages?: boolean;
  /** 返回可嵌入的完整图片 URL；启用图片时必传 */
  onImageUpload?: (file: File) => Promise<string>;
}

export interface PromptEditorHandle {
  insertPromptMention: (attrs: PromptMentionAttrs) => void;
}

const HEADING_LEVELS = [1, 2, 3, 4, 5] as const;

const PromptMention = Node.create({
  name: 'promptMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      label: { default: '' },
      teamSlug: { default: '' },
      promptSlug: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-prompt-mention]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Partial<PromptMentionAttrs>;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-prompt-mention': 'true',
        'data-team-slug': attrs.teamSlug,
        'data-prompt-slug': attrs.promptSlug,
      }),
      `@${attrs.label || attrs.promptSlug}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PromptMentionChip);
  },
});

function PromptMentionChip({ node }: NodeViewProps) {
  const attrs = node.attrs as PromptMentionAttrs;
  return (
    <span
      contentEditable={false}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 7px',
        margin: '0 1px',
        borderRadius: 999,
        background: TOKENS.primarySoft,
        color: TOKENS.primaryDeep,
        border: `1px solid ${TOKENS.primary}33`,
        fontSize: '0.92em',
        fontWeight: 600,
      }}
      title={`${attrs.teamSlug}/${attrs.promptSlug}`}
    >
      @{attrs.label || attrs.promptSlug}
    </span>
  );
}

export const PromptEditor = forwardRef<PromptEditorHandle, PromptEditorProps>(function PromptEditor({
  value,
  onChange,
  placeholder = '编写 Prompt Markdown，使用右侧列表插入 @prompt 引用',
  disabled,
  promptCount = 0,
  enableMentions = true,
  enableImages = false,
  onImageUpload,
}, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // 在 editorProps 闭包里读取最新的上传函数与 editor 实例
  const onImageUploadRef = useRef(onImageUpload);
  onImageUploadRef.current = onImageUpload;
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  const insertImageFiles = async (files: File[]) => {
    const upload = onImageUploadRef.current;
    if (!upload) return;
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setUploading(true);
    try {
      for (const file of images) {
        const url = await upload(file);
        editorRef.current?.chain().focus().setImage({ src: url, alt: file.name }).run();
      }
    } finally {
      setUploading(false);
    }
  };

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // StarterKit v3 自带 link，这里关掉，改用下方显式配置的 Link（openOnClick:false）
        link: false,
        heading: {
          levels: [...HEADING_LEVELS],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'prompt-editor-codeblock',
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        defaultProtocol: 'https',
      }),
      Placeholder.configure({ placeholder }),
      TaskList.configure({ HTMLAttributes: { class: 'prompt-editor-tasklist' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'prompt-editor-taskitem' } }),
      ...(enableMentions ? [PromptMention] : []),
      ...(enableImages
        ? [TiptapImage.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: 'prompt-editor-image' } })]
        : []),
    ],
    content: promptMarkdownToDoc(value),
    onUpdate: ({ editor }) => {
      onChange(promptDocToMarkdown(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: 'prompt-editor-content',
      },
      handlePaste: (_view, event) => {
        if (!enableImages || !onImageUploadRef.current) return false;
        const files = Array.from(event.clipboardData?.files ?? []);
        const images = files.filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return false;
        event.preventDefault();
        void insertImageFiles(images);
        return true;
      },
      handleDrop: (_view, event) => {
        if (!enableImages || !onImageUploadRef.current) return false;
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        const images = files.filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return false;
        event.preventDefault();
        void insertImageFiles(images);
        return true;
      },
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const current = promptDocToMarkdown(editor.getJSON());
    if (current !== value) {
      editor.commands.setContent(promptMarkdownToDoc(value), { emitUpdate: false });
    }
  }, [editor, value]);

  useImperativeHandle(ref, () => ({
    insertPromptMention(attrs) {
      insertPromptMentionIntoEditor(editor, attrs);
    },
  }), [editor]);

  return (
    <div style={{ border: `1px solid ${TOKENS.borderSoft}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <style>{editorCss}</style>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          background: TOKENS.bgAlt,
        }}
      >
        {HEADING_LEVELS.map((level) => (
          <IconButton
            key={level}
            label={`标题 H${level}`}
            onClick={() => editor?.chain().focus().toggleHeading({ level }).run()}
            active={editor?.isActive('heading', { level })}
          >
            H{level}
          </IconButton>
        ))}
        <IconButton label="加粗" onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')}>
          <strong>B</strong>
        </IconButton>
        <IconButton label="斜体" onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')}>
          <IconItalic size={13} />
        </IconButton>
        <IconButton label="删除线" onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')}>
          <IconStrike size={13} />
        </IconButton>
        <IconButton label="行内代码" onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')}>
          <IconInlineCode size={13} />
        </IconButton>
        <IconButton label="链接" onClick={() => promptForLink(editor)} active={editor?.isActive('link')}>
          <IconLink size={13} />
        </IconButton>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<I.list size={13} />}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          style={toolbarButtonStyle(editor?.isActive('bulletList'))}
        />
        <IconButton label="有序列表" onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')}>
          <IconListOrdered size={13} />
        </IconButton>
        <IconButton label="任务列表" onClick={() => editor?.chain().focus().toggleTaskList().run()} active={editor?.isActive('taskList')}>
          <IconListChecks size={13} />
        </IconButton>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<I.copy size={13} />}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          style={toolbarButtonStyle(editor?.isActive('blockquote'))}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<I.code size={13} />}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          style={toolbarButtonStyle(editor?.isActive('codeBlock'))}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          style={toolbarButtonStyle(false)}
        >
          HR
        </Button>
        {enableImages && (
          <IconButton
            label="插入图片"
            onClick={() => fileInputRef.current?.click()}
            active={false}
          >
            <IconImage size={13} />
          </IconButton>
        )}
        <span style={{ flex: 1 }} />
        {enableImages && uploading && (
          <span style={{ fontSize: 12, color: TOKENS.primary }}>图片上传中…</span>
        )}
        <span style={{ fontSize: 12, color: TOKENS.text3 }}>{value.length} 字符</span>
        {enableMentions && (
          <span style={{ fontSize: 12, color: promptCount > 0 ? TOKENS.primary : TOKENS.text3 }}>{promptCount} 个引用</span>
        )}
      </div>
      {enableImages && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            void insertImageFiles(files);
            e.target.value = '';
          }}
        />
      )}
      <EditorContent editor={editor} />
    </div>
  );
});

function promptForLink(editor: ReturnType<typeof useEditor>) {
  if (!editor) return;
  const previous = editor.getAttributes('link').href as string | undefined;
  const input = window.prompt('链接地址（留空可移除已有链接）', previous ?? 'https://');
  if (input === null) return;
  const href = input.trim();
  if (!href) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  if (editor.state.selection.empty && !editor.isActive('link')) {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
      .run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
}

export function insertPromptMentionIntoEditor(
  editor: ReturnType<typeof useEditor>,
  attrs: PromptMentionAttrs,
) {
  editor
    ?.chain()
    .focus()
    .insertContent([createPromptMentionNode(attrs), { type: 'text', text: ' ' }])
    .run();
}

function IconButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Button type="button" variant="ghost" size="sm" aria-label={label} title={label} onClick={onClick} style={toolbarButtonStyle(active)}>
      {children}
    </Button>
  );
}

function toolbarButtonStyle(active?: boolean): React.CSSProperties {
  return {
    minWidth: 28,
    height: 28,
    padding: '0 8px',
    border: `1px solid ${active ? TOKENS.primary : TOKENS.borderSoft}`,
    borderRadius: 6,
    background: active ? TOKENS.primarySoft : '#fff',
    color: active ? TOKENS.primaryDeep : TOKENS.text2,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };
}

const editorCss = `
.prompt-editor-content {
  min-height: 420px;
  padding: 18px;
  color: ${TOKENS.text};
  font-size: 14px;
  line-height: 1.72;
  outline: none;
}
.prompt-editor-content p {
  margin: 0 0 12px;
}
.prompt-editor-content h1,
.prompt-editor-content h2,
.prompt-editor-content h3,
.prompt-editor-content h4,
.prompt-editor-content h5 {
  margin: 12px 0 10px;
  line-height: 1.25;
  color: ${TOKENS.text};
}
.prompt-editor-content h1 {
  font-size: 28px;
  font-weight: 760;
}
.prompt-editor-content h2 {
  font-size: 23px;
  font-weight: 720;
}
.prompt-editor-content h3 {
  font-size: 19px;
  font-weight: 680;
}
.prompt-editor-content h4 {
  font-size: 16px;
  font-weight: 650;
}
.prompt-editor-content h5 {
  font-size: 14px;
  font-weight: 630;
}
.prompt-editor-content ul,
.prompt-editor-content ol {
  padding-left: 22px;
  margin: 0 0 12px;
}
.prompt-editor-content code {
  padding: 1px 5px;
  border-radius: 4px;
  background: ${TOKENS.bgAlt};
  border: 1px solid ${TOKENS.borderSoft};
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  color: ${TOKENS.text};
}
.prompt-editor-content s {
  color: ${TOKENS.text3};
}
.prompt-editor-content ul.prompt-editor-tasklist {
  list-style: none;
  padding-left: 2px;
  margin: 0 0 12px;
}
.prompt-editor-content ul.prompt-editor-tasklist li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 2px;
}
.prompt-editor-content ul.prompt-editor-tasklist li > label {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  height: calc(1em * 1.72);
  user-select: none;
}
.prompt-editor-content ul.prompt-editor-tasklist li > label > input[type="checkbox"] {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: ${TOKENS.primary};
  cursor: pointer;
}
.prompt-editor-content ul.prompt-editor-tasklist li > div {
  flex: 1 1 auto;
  min-width: 0;
}
.prompt-editor-content ul.prompt-editor-tasklist li > div > p {
  margin: 0;
}
.prompt-editor-content ul.prompt-editor-tasklist li[data-checked="true"] > div {
  color: ${TOKENS.text3};
  text-decoration: line-through;
}
.prompt-editor-content blockquote {
  margin: 0 0 12px;
  padding-left: 12px;
  border-left: 3px solid ${TOKENS.primary}33;
  color: ${TOKENS.text2};
}
.prompt-editor-content pre {
  margin: 0 0 12px;
  padding: 12px;
  border-radius: 8px;
  background: #111827;
  color: #F9FAFB;
  overflow: auto;
}
.prompt-editor-content a {
  color: ${TOKENS.primary};
}
.prompt-editor-content img.prompt-editor-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid ${TOKENS.borderSoft};
  margin: 4px 0;
}
.prompt-editor-content img.prompt-editor-image.ProseMirror-selectednode {
  outline: 2px solid ${TOKENS.primary};
  outline-offset: 2px;
}
.prompt-editor-content .is-editor-empty:first-child::before {
  color: ${TOKENS.text3};
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
`;
