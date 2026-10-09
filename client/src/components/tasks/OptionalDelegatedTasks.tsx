import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import DelegatedTasks from "./DelegatedTasks";

function DelegatedTasksPreference({ userId }: { userId: number }) {
  const panelId = useId();
  const preferenceKey = `mind:show-delegated-tasks:${userId}`;
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(preferenceKey) === "true"; }
    catch { return false; }
  });

  const toggle = () => {
    const next = !visible;
    setVisible(next);
    try { localStorage.setItem(preferenceKey, String(next)); }
    catch { /* The control still works when browser storage is unavailable. */ }
  };

  return <div className="space-y-2">
    <div className="flex justify-end">
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={toggle}
        aria-expanded={visible} aria-controls={panelId}>
        {visible ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {visible ? "Ocultar tareas que asigné" : "Mostrar tareas que asigné"}
      </Button>
    </div>
    <div id={panelId} hidden={!visible}>
      {visible && <DelegatedTasks />}
    </div>
  </div>;
}

export default function OptionalDelegatedTasks() {
  const { user } = useAuth();
  // A different signed-in user starts from their own preference, never the last user's state.
  return user ? <DelegatedTasksPreference key={user.id} userId={user.id} /> : null;
}
