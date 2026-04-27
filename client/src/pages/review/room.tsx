import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewApi, reviewKeys, type ReviewRoomDetail } from "@/lib/review-api";
import { setCurrentReviewRoomId } from "@/lib/queryClient";
import { ReviewRoomContext, setLastReviewRoomId } from "@/hooks/use-review-room";
import AddProjectDialog from "@/components/review/AddProjectDialog";
import StatusSemanalPage from "@/pages/status-semanal";

export default function ReviewRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = parseInt(params?.roomId ?? '', 10);
  const [, navigate] = useLocation();

  // Set the room context SYNCHRONOUSLY during render so any child query on first mount
  // hits the room-scoped URL (child useEffects run before parent useEffects).
  // setCurrentReviewRoomId is a no-op if the id hasn't changed.
  if (Number.isFinite(roomId)) setCurrentReviewRoomId(roomId);

  useEffect(() => {
    if (!Number.isFinite(roomId)) return;
    setLastReviewRoomId(roomId);
    reviewApi.visit(roomId).catch(() => {});
    return () => { setCurrentReviewRoomId(null); };
  }, [roomId]);

  const { data: room, error, isLoading } = useQuery<ReviewRoomDetail>({
    queryKey: reviewKeys.detail(roomId),
    queryFn: () => reviewApi.getRoom(roomId),
    enabled: Number.isFinite(roomId),
    staleTime: 0,
  });

  const ctxValue = useMemo(() => {
    if (!room) return null;
    const myRole = (room.myRole as 'owner' | 'editor') ?? 'editor';
    return {
      roomId,
      room,
      myRole,
      isOwner: myRole === 'owner',
      canEdit: true, // MVP: both owner and editor can edit
    };
  }, [room, roomId]);

  if (!Number.isFinite(roomId)) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <p className="text-slate-600">ID de sala inválido.</p>
        <Button className="mt-4" onClick={() => navigate('/review')}>Ver Status</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Cargando sala…
      </div>
    );
  }

  if (error || !room || !ctxValue) {
    const msg = (error as Error | null)?.message ?? "Sala no encontrada o sin acceso.";
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <p className="text-slate-700 mb-1">{msg}</p>
        <Button className="mt-4" onClick={() => navigate('/review')}>Volver a Status</Button>
      </div>
    );
  }

  return (
    <ReviewRoomContext.Provider value={ctxValue}>
      <RoomBody roomId={roomId} />
    </ReviewRoomContext.Provider>
  );
}

// Renders either an empty-state banner or the full board, based on whether the
// room has any items. Uses the SAME cache keys as StatusSemanalPage so the
// queries are shared (no duplicate fetches).
function RoomBody({ roomId }: { roomId: number }) {
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  const { data: projects = [], isLoading: l1 } = useQuery<unknown[]>({
    queryKey: ['/api/status-semanal?includeHidden=true'],
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: custom = [], isLoading: l2 } = useQuery<unknown[]>({
    queryKey: ['/api/status-semanal/custom?includeHidden=true'],
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const loading = l1 || l2;
  const isEmpty = !loading && projects.length === 0 && custom.length === 0;

  return (
    <>
      {isEmpty && (
        <div className="px-6 pt-6">
          <div className="max-w-2xl mx-auto border border-dashed border-indigo-200 rounded-xl bg-indigo-50/40 p-6 text-center">
            <div className="text-3xl mb-2">📋</div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Esta sala está vacía</h2>
            <p className="text-sm text-slate-600 mb-4">
              Agregá proyectos para empezar el seguimiento semanal — o creá un tema custom
              desde el botón de abajo.
            </p>
            <Button onClick={() => setAddProjectOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-1.5" />
              Agregar proyecto
            </Button>
          </div>
        </div>
      )}
      {/* StatusSemanalPage uses legacy /api/status-semanal/* URLs; queryClient rewrites
          them to /api/reviews/:roomId/* because the room context is set above. */}
      <StatusSemanalPage />
      <AddProjectDialog open={addProjectOpen} onClose={() => setAddProjectOpen(false)} roomId={roomId} />
    </>
  );
}
