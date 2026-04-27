import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, AlertCircle, Lock } from "lucide-react";
import { roomColor, type ReviewRoomSummary } from "@/lib/review-api";
import { setLastReviewRoomId } from "@/hooks/use-review-room";

interface Props {
  room: ReviewRoomSummary;
}

function relTime(s: string | null): string {
  if (!s) return '';
  const diff = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)}d`;
  return new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function RoomCard({ room }: Props) {
  const [, navigate] = useLocation();
  const color = roomColor(room.colorIndex);

  const open = () => {
    setLastReviewRoomId(room.id);
    navigate(`/review/${room.id}`);
  };

  return (
    <button
      onClick={open}
      className={cn(
        "group relative bg-white border rounded-xl p-5 text-left transition-all hover:shadow-md",
        color.border,
      )}
    >
      <div className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-xl", color.chip)} />

      <div className="flex items-start gap-3 mb-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0", color.chip)}>
          {room.emoji || room.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
            {room.name}
          </h3>
          {room.description && (
            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{room.description}</p>
          )}
        </div>
        {room.privacy === 'private' ? (
          <Badge variant="outline" className="text-[10px] gap-1 border-slate-300 text-slate-600">
            <Lock className="h-2.5 w-2.5" />
            Personal
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">{room.myRole === 'owner' ? 'Owner' : 'Editor'}</Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          {room.privacy === 'private' ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              Solo vos
            </>
          ) : (
            <>
              <Users className="h-3.5 w-3.5" />
              {room.memberCount} {room.memberCount === 1 ? 'miembro' : 'miembros'}
            </>
          )}
        </span>
        {room.pendingCount > 0 ? (
          <span className="flex items-center gap-1 text-amber-700 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            {room.pendingCount} pendiente{room.pendingCount > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {relTime(room.lastActivityAt)}
          </span>
        )}
      </div>
    </button>
  );
}
