import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ProfileNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstName: string;
  lastName: string;
};

export function ProfileNameDialog({ open, onOpenChange, firstName, lastName }: ProfileNameDialogProps) {
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFirst(firstName);
    setLast(lastName);
    setError("");
  }, [open, firstName, lastName]);

  const unchanged = first.trim() === firstName.trim() && last.trim() === lastName.trim();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!first.trim() || !last.trim()) { setError("Completá nombre y apellido."); return; }
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/me/profile", "PATCH", { firstName: first.trim(), lastName: last.trim() });
      // The name shows up in tasks, projects and status, so refresh everything.
      await queryClient.invalidateQueries();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "No pudimos guardar tu nombre.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Mi nombre</DialogTitle>
            <DialogDescription>Así te ven en tareas, proyectos y status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="profile-first-name">Nombre</Label>
            <Input id="profile-first-name" value={first} maxLength={100} autoFocus onChange={(e) => setFirst(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-last-name">Apellido</Label>
            <Input id="profile-last-name" value={last} maxLength={100} onChange={(e) => setLast(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || unchanged}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
