import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { AssumptionValidationRequest, ScenarioRequest, AIResponse } from "@/types/ai";

export function useValidateAssumptions() {
  return useMutation({
    mutationFn: (data: AssumptionValidationRequest) =>
      apiClient.post<AIResponse>("/api/ai/validate", data).then((r) => r.data),
  });
}

export function useRunScenario() {
  return useMutation({
    mutationFn: (data: ScenarioRequest) =>
      apiClient.post<AIResponse>("/api/ai/scenario", data).then((r) => r.data),
  });
}
