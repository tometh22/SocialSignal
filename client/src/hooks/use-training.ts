import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { authFetchJson } from "@/lib/queryClient";
import { canAccessTraining, type TrainingCatalog } from "@shared/training";

export function useTrainingCatalog() {
  const { user } = useAuth();
  return useQuery<TrainingCatalog>({
    queryKey: ["training", user?.id, "catalog"],
    enabled: Boolean(user),
    queryFn: async () => {
      const catalog = await authFetchJson<TrainingCatalog>("/api/training");
      return {
        ...catalog,
        lessons: catalog.lessons.filter((l) =>
          canAccessTraining(catalog.audience, l.access),
        ),
      };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}
export function useDismissTrainingInvitation() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authFetchJson("/api/training/invitation", {
        method: "PUT",
        body: JSON.stringify({ dismissed: true }),
      }),
    onSuccess: () => {
      client.setQueryData<TrainingCatalog>(
        ["training", user?.id, "catalog"],
        (data) => (data ? { ...data, invitationDismissed: true } : data),
      );
    },
  });
}
