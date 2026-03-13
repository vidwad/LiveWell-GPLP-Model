import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { PropertyDefaultsRequest, PropertyDefaultsResponse, RiskAnalysisResponse } from '@/types/ai';

export function usePropertyDefaults() {
  return useMutation<PropertyDefaultsResponse, Error, PropertyDefaultsRequest>({
    mutationFn: async (data) => {
      const response = await apiClient.post('/api/ai/suggest-defaults', data);
      return response.data;
    },
  });
}

export function useRiskAnalysis() {
  return useMutation<RiskAnalysisResponse, Error, number>({
    mutationFn: async (propertyId) => {
      const response = await apiClient.post('/api/ai/analyze-risk', { property_id: propertyId });
      return response.data;
    },
  });
}
