import { useRef, useMemo, useCallback, useEffect } from 'react';
import ReactQuill from 'react-quill';

// Importar CSS do react-quill via CDN (mais confiável no build)
// O CSS será carregado dinamicamente quando o componente for montado

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor = ({ value, onChange, placeholder, className }: RichTextEditorProps) => {
  const quillRef = useRef<ReactQuill>(null);

  // Carregar CSS do Quill via CDN se não estiver carregado
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('quill-snow-css')) {
      const link = document.createElement('link');
      link.id = 'quill-snow-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  }, []);

  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const quill = quillRef.current?.getEditor();
          if (quill && reader.result) {
            const range = quill.getSelection();
            quill.insertEmbed(range?.index || 0, 'image', reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    };
  }, []);

  const insertTable = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true);
    const tableHtml = `
      <table style="width:100%; border-collapse: collapse;" border="1">
        <tr><th style="padding:6px;">Cabeçalho 1</th><th style="padding:6px;">Cabeçalho 2</th></tr>
        <tr><td style="padding:6px;">Valor 1</td><td style="padding:6px;">Valor 2</td></tr>
      </table><p></p>`;
    quill.clipboard.dangerouslyPasteHTML(range ? range.index : 0, tableHtml);
  }, []);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'clean', 'table']
      ],
      handlers: {
        image: imageHandler,
        table: insertTable
      }
    },
    clipboard: {
      matchVisual: false,
    }
  }), [imageHandler, insertTable]);

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet', 'blockquote', 'code-block', 'link', 'image'
  ];

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    const items = clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const quill = quillRef.current?.getEditor();
            if (quill && reader.result) {
              const range = quill.getSelection();
              quill.insertEmbed(range?.index || 0, 'image', reader.result);
            }
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }, []);

  return (
    <div className={className} onPaste={handlePaste}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        style={{
          backgroundColor: 'hsl(var(--background))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
        }}
      />
      <style>{`
        .ql-container {
          border-bottom-left-radius: var(--radius);
          border-bottom-right-radius: var(--radius);
          background: hsl(var(--background));
        }
        
        .ql-toolbar {
          border-top-left-radius: var(--radius);
          border-top-right-radius: var(--radius);
          background: hsl(var(--muted));
          border-color: hsl(var(--border));
        }
        
        .ql-editor {
          color: hsl(var(--foreground));
          min-height: 120px;
        }
        
        .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
};