"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Pencil, Check, X } from "lucide-react";

interface EditableFieldProps {
  value: string;
  onSave?: (newValue: string) => void;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  textClassName?: string;
  editable?: boolean;
}

export default function EditableField({
  value,
  onSave,
  label,
  placeholder = "Click to edit...",
  multiline = false,
  className = "",
  textClassName = "",
  editable = true,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: multiline ? {} : false,
        bulletList: multiline ? {} : false,
        orderedList: multiline ? {} : false,
        blockquote: multiline ? {} : false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `outline-none ${textClassName} ${multiline ? "min-h-[60px]" : ""}`,
      },
    },
  });

  const handleEdit = useCallback(() => {
    if (!editable) return;
    editor?.commands.setContent(value || "");
    setIsEditing(true);
    setTimeout(() => editor?.commands.focus(), 50);
  }, [editor, value, editable]);

  const handleSave = useCallback(() => {
    const newValue = editor?.getHTML() || "";
    // Strip wrapping <p> tags for single-line fields
    const cleaned = multiline
      ? newValue
      : newValue.replace(/^<p>/, "").replace(/<\/p>$/, "");
    onSave?.(cleaned);
    setIsEditing(false);
  }, [editor, onSave, multiline]);

  const handleCancel = useCallback(() => {
    editor?.commands.setContent(value || "");
    setIsEditing(false);
  }, [editor, value]);

  if (isEditing) {
    return (
      <div className={`group ${className}`}>
        {label && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1 block">
            {label}
          </span>
        )}
        <div className="relative border border-[#6B21A8]/30 rounded-lg bg-white p-2 shadow-sm shadow-purple-100">
          <EditorContent editor={editor} />
          <div className="flex gap-1 mt-2 justify-end">
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
            <button
              onClick={handleSave}
              className="p-1.5 rounded-md bg-[#32373C] text-white hover:bg-[#1A1A1A] cursor-pointer transition-colors"
            >
              <Check size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group ${editable ? "cursor-pointer" : ""} ${className}`}
      onClick={handleEdit}
    >
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1 block">
          {label}
        </span>
      )}
      <div className="flex items-start gap-2">
        <div
          className={`flex-1 ${textClassName} ${
            editable
              ? "border border-transparent hover:border-[var(--border)] rounded-lg hover:bg-white/50 px-2 py-1 -mx-2 -my-1 transition-all"
              : ""
          }`}
          dangerouslySetInnerHTML={{
            __html: value || `<span class="text-[var(--muted-foreground)] italic">${placeholder}</span>`,
          }}
        />
        {editable && (
          <Pencil
            size={12}
            className="text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1"
          />
        )}
      </div>
    </div>
  );
}
