import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DuplicateGroup, KeywordEntry } from "../backend.d";
import { useActor } from "./useActor";

export function useGetAllEntries() {
  const { actor, isFetching } = useActor();
  return useQuery<KeywordEntry[]>({
    queryKey: ["entries"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllEntries();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddEntry() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      keyword,
      frequency,
    }: { keyword: string; frequency: bigint }) => {
      if (!actor) throw new Error("No actor");
      return actor.addEntry(keyword, frequency);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useAddEntries() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: Array<[string, bigint]>) => {
      if (!actor) throw new Error("No actor");
      return actor.addEntries(entries);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useDeleteEntry() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteEntry(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useAnalyzeDuplicates() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async (): Promise<DuplicateGroup[]> => {
      if (!actor) throw new Error("No actor");
      return actor.analyzeDuplicates();
    },
  });
}

export function useCleanDuplicates() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.cleanDuplicates();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useClearAll() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.clearAll();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
