import { useState } from "react";
import { useLocation } from "wouter";
import { Users, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { roomColor, type ReviewRoomDetail } from "@/lib/review-api";
import MembersDialog from "./MembersDialog";
import { initials as userInitials } from "./utils";

interface Props {
  room: ReviewRoomDetail;
  myRole: 'owner' | 'editor';
}

export default function RoomHeader({ room, myRole }: Props) {
  const [, navigate] = useLocation();
  const [membersOpen, setMembersOpen] = useState(false);
  const color = roomColor(room.colorIndex);
  const isOwner = myRole === 'owner';
  const visibleMembers = room.members.slice(0, 5);
  const extraMembers = Math.max(0, room.members.length - visibleMembers.length);

  return (
    <>
      <div className={cn("border-t-4 bg-white rounded-t-lg px-5 py-3 flex items-start gap-4 shadow-sm", color.border.replace('border-', 'border-t-'))}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/review')} className="mt-1 px-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white text-lg", color.chip)}>
            {room.emoji || room.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">{room.name}</h1>
              <Badge variant="outline" className="text-xs">{isOwner ? 'Owner' : 'Editor'}</Badge>
            </div>
            {room.description && (
              <p className="text-xs text-slate-500 truncate max-w-md">{room.description}</p>
            )}
          </div>
        </div>

        <button
          className="flex items-center -space-x-2 hover:opacity-80"
          onClick={() => setMembersOpen(true)}
          aria-label="Ver miembros"
        >
          {visibleMembers.map(m => (
            <div
              key={m.userId}
              className="h-8 w-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-700"
              title={`${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()}
            >
              {userInitials(`${m.firstName ?? ''} ${m.lastName ?? ''}`.trim())}
            </div>
          ))}
          {extraMembers > 0 && (
            <div className="h-8 w-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-600">
              +{extraMembers}
            </div>
          )}
        </button>

        {isOwner && (
          <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)}>
            <Users className="h-4 w-4 mr-1" />
            Gestionar
          </Button>
        )}
      </div>

      <MembersDialog
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        room={room}
        myRole={myRole}
      />
    </>
  );
}
