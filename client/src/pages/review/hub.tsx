import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { reviewApi, reviewKeys, type ReviewRoomSummary } from "@/lib/review-api";
import { setCurrentReviewRoomId, getCurrentReviewRoomId } from "@/lib/queryClient";
import CreateReviewDialog from "@/components/review/CreateReviewDialog";
import RoomCard from "@/components/review/RoomCard";
import EmptyReviewsState from "@/components/review/EmptyReviewsState";
import WhatIsReviewBanner from "@/components/review/WhatIsReviewBanner";

export default function ReviewHubPage() {
  const [createOpen, setCreateOpen] = useState(false);

  // Reset room context on hub — so subsequent /api/status-semanal/* calls (e.g. in the create dialog)
  // stay as-is and hit the admin/all-users endpoints.
  useEffect(() => {
    if (getCurrentReviewRoomId() !== null) setCurrentReviewRoomId(null);
  }, []);

  const { data: rooms = [], isLoading } = useQuery<ReviewRoomSummary[]>({
    queryKey: reviewKeys.list(),
    queryFn: reviewApi.listRooms,
    staleTime: 0,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Status</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tus salas de seguimiento semanal</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva sala
        </Button>
      </div>

      <WhatIsReviewBanner />

      {isLoading ? (
        <div className="text-sm text-slate-500 text-center py-10">Cargando salas…</div>
      ) : rooms.length === 0 ? (
        <EmptyReviewsState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map(r => <RoomCard key={r.id} room={r} />)}
        </div>
      )}

      <CreateReviewDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
