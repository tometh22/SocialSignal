import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAutoResize } from "@/hooks/use-auto-resize-textarea";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type StatusMessageType = "note" | "update";
export type StatusMessage = {
  id: number;
  authorId: number | null;
  authorName: string | null;
  content: string;
  createdAt: string;
  editedAt?: string | null;
};
export type SavedStatusMessage = Pick<StatusMessage, "id" | "content" | "editedAt"> & { currentActionChanged?: boolean };

export function StatusMessageEditedAt({ date }: { date?: string | null }) {
  if (!date) return null;
  return <time dateTime={date} className="text-[10px] text-slate-500">
    Editado el {new Date(date).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", hour12: false })}
  </time>;
}

export default function StatusMessageEditor({ message, type, projectId, customId, onCancel, onSaved }: {
  message: StatusMessage;
  type: StatusMessageType;
  projectId?: number;
  customId?: number;
  onCancel: () => void;
  onSaved: (saved: SavedStatusMessage) => void;
}) {
  const [text, setText] = useState(message.content);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useAutoResize(textarea, text);
  const queryClient = useQueryClient();
  const target = projectId ? ["/api/status-semanal", projectId] : ["/api/status-semanal/custom", customId];
  const resource = type === "note" ? "notes" : "updates";
  const edit = useMutation({
    mutationFn: (content: string): Promise<SavedStatusMessage> =>
      apiRequest(`/api/status-semanal/${resource}/${message.id}`, "PATCH", { content }),
    onSuccess: saved => {
      const values = { content: saved.content, editedAt: saved.editedAt };
      queryClient.setQueryData<StatusMessage[]>([...target, resource], previous =>
        previous?.map(entry => entry.id === saved.id ? { ...entry, ...values } : entry));
      if (type === "note") {
        queryClient.setQueryData<(StatusMessage & { type: string })[]>([...target, "activity"], previous =>
          previous?.map(entry => entry.type === type && entry.id === saved.id ? { ...entry, ...values } : entry));
      }
      void queryClient.invalidateQueries({ queryKey: [...target, resource] });
      if (type === "note") void queryClient.invalidateQueries({ queryKey: [...target, "activity"] });
      if (saved.currentActionChanged) {
        void queryClient.invalidateQueries({ queryKey: ["/api/status-semanal?includeHidden=true"] });
        if (customId) void queryClient.invalidateQueries({ queryKey: ["/api/status-semanal/custom?includeHidden=true"] });
      }
      onSaved(saved);
    },
  });

  function save(event: FormEvent) {
    event.preventDefault();
    if (text.trim() && !edit.isPending) edit.mutate(text.trim());
  }

  return (
    <form onSubmit={save} data-status-message-editor className="mt-1 space-y-2">
      <Textarea ref={textarea} value={text} rows={2} autoFocus maxLength={20000} disabled={edit.isPending}
        aria-label="Editar mensaje de Status" onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            event.preventDefault();
            if (!edit.isPending) onCancel();
          }
          if (event.key === "Enter" && !event.shiftKey) save(event);
        }}
        className="min-h-12 bg-white text-sm" />
      {edit.isError && <p role="alert" className="text-xs text-red-700">{edit.error.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!text.trim() || edit.isPending}>{edit.isPending ? "Guardando…" : "Guardar edición"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={edit.isPending}>Cancelar</Button>
      </div>
    </form>
  );
}
