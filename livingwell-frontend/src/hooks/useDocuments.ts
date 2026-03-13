import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documents } from "@/lib/api";
import type { Document } from "@/types/investor";

export function useInvestorDocuments(investorId: number | undefined) {
  return useQuery<Document[]>({
    queryKey: ["documents", investorId],
    queryFn: () => documents.listByInvestor(investorId!),
    enabled: !!investorId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => documents.upload(formData),
    onSuccess: (_data, formData) => {
      const investorId = formData.get("investor_id");
      queryClient.invalidateQueries({ queryKey: ["documents", Number(investorId)] });
    },
  });
}

export function useMarkDocumentViewed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => documents.markViewed(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async ({ documentId, title }: { documentId: number; title: string }) => {
      const blob = await documents.download(documentId);
      const url = URL.createObjectURL(new Blob([blob]));
      const a = window.document.createElement("a");
      a.href = url;
      a.download = title;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
