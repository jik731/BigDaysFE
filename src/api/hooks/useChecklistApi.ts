// src/api/hooks/useChecklistApi.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../client";
import { ChecklistEndpoints } from "../endpoints";

export interface ChecklistItem {
  id: string;
  eventId: number;
  eventGuid: string;
  title: string;
  isCompleted: boolean;
  category: string | null;
  dueDate: string | null;
  notes: string | null;
  sortOrder: number;
  createdDate: string;
  lastUpdated: string;
}

export interface CreateChecklistItemPayload {
  eventGuid: string;
  title: string;
  category?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  sortOrder?: number;
}

export interface UpdateChecklistItemPayload {
  id: string;
  title: string;
  isCompleted: boolean;
  category?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

export const CHECKLIST_CATEGORIES = [
  "Venue",
  "Catering",
  "Attire",
  "Photography",
  "Flowers & Décor",
  "Music",
  "Invitations",
  "Logistics",
  "General",
] as const;

export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

export function useChecklistApi(eventGuid: string | undefined) {
  return useQuery<ChecklistItem[]>({
    queryKey: ["checklist", eventGuid],
    queryFn: async () => {
      const res = await client.get(ChecklistEndpoints.byEvent(eventGuid!));
      return res.data.data ?? res.data;
    },
    enabled: !!eventGuid,
    staleTime: 60_000,
  });
}

export function useCreateChecklistItem(eventGuid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChecklistItemPayload) =>
      client.post(ChecklistEndpoints.create, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", eventGuid] }),
  });
}

export function useUpdateChecklistItem(eventGuid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateChecklistItemPayload) =>
      client.put(ChecklistEndpoints.update, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", eventGuid] }),
  });
}

export function useDeleteChecklistItem(eventGuid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      client.delete(ChecklistEndpoints.delete(id)).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", eventGuid] }),
  });
}

export function useSeedChecklist(eventGuid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      client.post(ChecklistEndpoints.seed(eventGuid!)).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", eventGuid] }),
  });
}
