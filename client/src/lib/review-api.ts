import { apiRequest, authFetch } from "./queryClient";

export type ReviewRoomSummary = {
  id: number;
  name: string;
  description: string | null;
  colorIndex: number;
  emoji: string | null;
  privacy: 'members' | 'private';
  createdBy: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  myRole: 'owner' | 'editor';
  lastVisitedAt: string | null;
  memberCount: number;
  pendingCount: number;
  lastActivityAt: string | null;
};

export type ReviewRoomMember = {
  userId: number;
  role: 'owner' | 'editor';
  addedAt: string;
  lastVisitedAt?: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatar: string | null;
};

export type ReviewRoomDetail = ReviewRoomSummary & {
  members: ReviewRoomMember[];
};

export const reviewKeys = {
  all: ['reviews'] as const,
  list: () => [...reviewKeys.all, 'list'] as const,
  detail: (id: number) => [...reviewKeys.all, 'detail', id] as const,
  members: (id: number) => [...reviewKeys.all, 'members', id] as const,
};

export const reviewApi = {
  async listRooms(): Promise<ReviewRoomSummary[]> {
    const r = await authFetch('/api/reviews');
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async getRoom(id: number): Promise<ReviewRoomDetail> {
    const r = await authFetch(`/api/reviews/${id}`);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async listMembers(id: number): Promise<ReviewRoomMember[]> {
    const r = await authFetch(`/api/reviews/${id}/members`);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  createRoom(payload: { name: string; description?: string | null; colorIndex?: number; emoji?: string | null; memberIds?: number[]; privacy?: 'members' | 'private' }) {
    return apiRequest('/api/reviews', 'POST', payload);
  },
  updateRoom(id: number, payload: Partial<{ name: string; description: string | null; colorIndex: number; emoji: string | null }>) {
    return apiRequest(`/api/reviews/${id}`, 'PATCH', payload);
  },
  archiveRoom(id: number) {
    return apiRequest(`/api/reviews/${id}`, 'DELETE');
  },
  visit(id: number) {
    return apiRequest(`/api/reviews/${id}/visit`, 'POST');
  },
  addMember(id: number, userId: number, role: 'owner' | 'editor' = 'editor') {
    return apiRequest(`/api/reviews/${id}/members`, 'POST', { userId, role });
  },
  updateMember(id: number, userId: number, role: 'owner' | 'editor') {
    return apiRequest(`/api/reviews/${id}/members/${userId}`, 'PATCH', { role });
  },
  removeMember(id: number, userId: number) {
    return apiRequest(`/api/reviews/${id}/members/${userId}`, 'DELETE');
  },
  addProject(id: number, projectId: number) {
    return apiRequest(`/api/reviews/${id}/items/project`, 'POST', { projectId });
  },
};

// Palette re-used across Review/Projects for consistent visual identity.
export const ROOM_PALETTE = [
  { chip: 'bg-slate-500',   ring: 'ring-slate-400',   border: 'border-slate-200',   name: 'Pizarra'  },
  { chip: 'bg-indigo-500',  ring: 'ring-indigo-400',  border: 'border-indigo-200',  name: 'Índigo'   },
  { chip: 'bg-emerald-500', ring: 'ring-emerald-400', border: 'border-emerald-200', name: 'Esmeralda' },
  { chip: 'bg-amber-500',   ring: 'ring-amber-400',   border: 'border-amber-200',   name: 'Ámbar'    },
  { chip: 'bg-rose-500',    ring: 'ring-rose-400',    border: 'border-rose-200',    name: 'Rosa'     },
  { chip: 'bg-sky-500',     ring: 'ring-sky-400',     border: 'border-sky-200',     name: 'Cielo'    },
  { chip: 'bg-violet-500',  ring: 'ring-violet-400',  border: 'border-violet-200',  name: 'Violeta'  },
  { chip: 'bg-teal-500',    ring: 'ring-teal-400',    border: 'border-teal-200',    name: 'Turquesa' },
] as const;

export function roomColor(idx: number) {
  return ROOM_PALETTE[((idx % ROOM_PALETTE.length) + ROOM_PALETTE.length) % ROOM_PALETTE.length];
}
