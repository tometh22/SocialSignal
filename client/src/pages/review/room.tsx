import { useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewApi, reviewKeys, type ReviewRoomDetail } from "@/lib/review-api";
import { setCurrentReviewRoomId } from "@/lib/queryClient";
import { ReviewRoomContext, setLastReviewRoomId } from "@/hooks/use-review-room";
import RoomHeader from "@/components/review/RoomHeader";
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
        <Button className="mt-4" onClick={() => navigate('/review')}>Ver salas</Button>
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
        <Button className="mt-4" onClick={() => navigate('/review')}>Volver a Reviews</Button>
      </div>
    );
  }

  return (
    <ReviewRoomContext.Provider value={ctxValue}>
      <div className="px-6 pt-4">
        <RoomHeader room={room} myRole={ctxValue.myRole} />
      </div>
      {/* StatusSemanalPage uses legacy /api/status-semanal/* URLs; queryClient rewrites
          them to /api/reviews/:roomId/* because we set the current room id above. */}
      <StatusSemanalPage />
    </ReviewRoomContext.Provider>
  );
}
