import { queryClient } from "./queryClient";

import { isTaskRelatedQuery } from "@shared/utils/task-cache-key";

export function invalidateTaskQueries() {
  return queryClient.invalidateQueries({ predicate: query => isTaskRelatedQuery(query.queryKey) });
}
