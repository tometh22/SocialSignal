import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, AlertCircle, Lock, MessageSquare, Trash2 } from "lucide-react";
import { roomColor, type ReviewRoomSummary } from "@/lib/review-api";
import { setLastReviewRoomId } from "@/hooks/use-review-room";

interface Props {
  room: ReviewRoomSummary;
  onArchive?: (room: ReviewRoomSummary) => void;
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

export default function RoomCard({ room, onArchive }: Props) {
  const [, navigate] = useLocation();
  const color = roomColor(room.colorIndex);

  const open = () => {
    setLastReviewRoomId(room.id);
    navigate(`/review/${room.id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      className={cn(
        "group relative cursor-pointer bg-white border rounded-xl p-5 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
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
        {room.myRole === 'owner' && onArchive && (
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
            aria-label={`Eliminar sala ${room.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onArchive(room);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
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
        <span className="flex items-center gap-2">
          {room.unreadCommentsCount > 0 && (
            <span className="flex items-center gap-1 text-indigo-700 font-medium">
              <MessageSquare className="h-3.5 w-3.5" />
              {room.unreadCommentsCount} nuevo{room.unreadCommentsCount > 1 ? 's' : ''}
            </span>
          )}
          {room.pendingCount > 0 ? (
            <span className="flex items-center gap-1 text-amber-700 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {room.pendingCount} pendiente{room.pendingCount > 1 ? 's' : ''}
            </span>
          ) : room.unreadCommentsCount === 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {relTime(room.lastActivityAt)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
