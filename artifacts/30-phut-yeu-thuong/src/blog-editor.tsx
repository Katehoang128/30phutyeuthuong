// Tiptap rich-text editor for the Blog admin page. Split into its own file (loaded via React.lazy
// from App.tsx) so the ~100KB+ of Tiptap/ProseMirror code only ever downloads for the one person
// (Kate) who visits /blog/write, never for readers of the public blog or the rest of the app.
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import LinkExtension from '@tiptap/extension-link';
import PlaceholderExtension from '@tiptap/extension-placeholder';
import { Bold, Italic, Heading2, List, ListOrdered, Quote, Link2, ImagePlus, Undo2, Redo2 } from 'lucide-react';

export default function RichTextEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      LinkExtension.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      ImageExtension.configure({ HTMLAttributes: { class: 'rounded-xl' } }),
      PlaceholderExtension.configure({ placeholder: 'Viết nội dung bài blog ở đây...' }),
    ],
    content,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    editorProps: { attributes: { class: 'blog-editor-content prose prose-neutral max-w-none focus:outline-none' } },
  });

  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('Dán URL ảnh (VD: link ảnh công khai trên Imgur, Google Drive, Shopee...)');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };
  const setLink = () => {
    const previousUrl = (editor.getAttributes('link').href as string) || '';
    const url = window.prompt('Dán URL liên kết (để trống để bỏ liên kết)', previousUrl || 'https://');
    if (url === null) return;
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return <div className="blog-editor">
    <div className="blog-editor-toolbar" role="toolbar" aria-label="Định dạng văn bản">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`blog-editor-btn ${editor.isActive('bold') ? 'blog-editor-btn-active' : ''}`} aria-label="In đậm" aria-pressed={editor.isActive('bold')} data-testid="button-editor-bold"><Bold size={15} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`blog-editor-btn ${editor.isActive('italic') ? 'blog-editor-btn-active' : ''}`} aria-label="In nghiêng" aria-pressed={editor.isActive('italic')} data-testid="button-editor-italic"><Italic size={15} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`blog-editor-btn ${editor.isActive('heading', { level: 2 }) ? 'blog-editor-btn-active' : ''}`} aria-label="Tiêu đề lớn" aria-pressed={editor.isActive('heading', { level: 2 })} data-testid="button-editor-h2"><Heading2 size={15} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`blog-editor-btn ${editor.isActive('bulletList') ? 'blog-editor-btn-active' : ''}`} aria-label="Danh sách" aria-pressed={editor.isActive('bulletList')} data-testid="button-editor-bullet-list"><List size={15} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`blog-editor-btn ${editor.isActive('orderedList') ? 'blog-editor-btn-active' : ''}`} aria-label="Danh sách số" aria-pressed={editor.isActive('orderedList')} data-testid="button-editor-ordered-list"><ListOrdered size={15} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`blog-editor-btn ${editor.isActive('blockquote') ? 'blog-editor-btn-active' : ''}`} aria-label="Trích dẫn" aria-pressed={editor.isActive('blockquote')} data-testid="button-editor-blockquote"><Quote size={15} /></button>
      <button type="button" onClick={setLink} className={`blog-editor-btn ${editor.isActive('link') ? 'blog-editor-btn-active' : ''}`} aria-label="Chèn liên kết" aria-pressed={editor.isActive('link')} data-testid="button-editor-link"><Link2 size={15} /></button>
      <button type="button" onClick={addImage} className="blog-editor-btn" aria-label="Chèn ảnh từ URL" data-testid="button-editor-image"><ImagePlus size={15} /></button>
      <span className="blog-editor-divider" aria-hidden="true" />
      <button type="button" onClick={() => editor.chain().focus().undo().run()} className="blog-editor-btn" aria-label="Hoàn tác" data-testid="button-editor-undo"><Undo2 size={15} /></button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} className="blog-editor-btn" aria-label="Làm lại" data-testid="button-editor-redo"><Redo2 size={15} /></button>
    </div>
    <EditorContent editor={editor} />
  </div>;
}
