import axios from "axios";
import type { CostEstimateInput, CostEstimateResult, Property, PropertyCreate, DevelopmentPlan, DevelopmentPlanCreate, PropertyCluster } from "@/types/portfolio";
import type { GPEntity, LPEntity, LPCreate, Subscription, Holding, DistributionEvent } from "@/types/investment";
import type { Investor, InvestorCreate, InvestorDashboard, Document, Message, WaterfallInput, WaterfallResult } from "@/types/investor";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const apiClient = axios.create({ baseURL: BASE_URL });

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("lwc_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken =
        typeof window !== "undefined"
          ? localStorage.getItem("lwc_refresh_token")
          : null;
      if (!refreshToken) {
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });
        localStorage.setItem("lwc_access_token", data.access_token);
        localStorage.setItem("lwc_refresh_token", data.refresh_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch {
        if (typeof window !== "undefined") {
          localStorage.clear();
          document.cookie =
            "lwc_token_present=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Portfolio ────────────────────────────────────────────────────────
export const portfolio = {
  getProperties: () => apiClient.get<Property[]>("/api/portfolio/properties").then(r => r.data),
  getProperty: (id: number) => apiClient.get<Property>(`/api/portfolio/properties/${id}`).then(r => r.data),
  createProperty: (data: PropertyCreate) => apiClient.post<Property>("/api/portfolio/properties", data).then(r => r.data),
  getDevelopmentPlans: (propertyId: number) => apiClient.get<DevelopmentPlan[]>(`/api/portfolio/properties/${propertyId}/plans`).then(r => r.data),
  createDevelopmentPlan: (propertyId: number, data: DevelopmentPlanCreate) => apiClient.post<DevelopmentPlan>(`/api/portfolio/properties/${propertyId}/plans`, data).then(r => r.data),
  getClusters: () => apiClient.get<PropertyCluster[]>("/api/portfolio/clusters").then(r => r.data),
  estimateCosts: (data: CostEstimateInput) => apiClient.post<CostEstimateResult>("/api/portfolio/modeling/estimate-costs", data).then(r => r.data),
  getReturnsMetrics: () => apiClient.get("/api/portfolio/metrics/returns").then(r => r.data),
};

// ── Investment (GP / LP / Subscription / Holding / Distribution) ─────
export const investment = {
  getGPs: () => apiClient.get<GPEntity[]>("/api/investment/gp").then(r => r.data),
  getLPs: () => apiClient.get<LPEntity[]>("/api/investment/lp").then(r => r.data),
  getLP: (id: number) => apiClient.get<LPEntity>(`/api/investment/lp/${id}`).then(r => r.data),
  createLP: (data: LPCreate) => apiClient.post<LPEntity>("/api/investment/lp", data).then(r => r.data),
  getSubscriptions: (lpId: number) => apiClient.get<Subscription[]>(`/api/investment/lp/${lpId}/subscriptions`).then(r => r.data),
  getHoldings: (lpId: number) => apiClient.get<Holding[]>(`/api/investment/lp/${lpId}/holdings`).then(r => r.data),
  getDistributions: (lpId: number) => apiClient.get<DistributionEvent[]>(`/api/investment/lp/${lpId}/distributions`).then(r => r.data),
};

// ── Investors ────────────────────────────────────────────────────────
export const investors = {
  getAll: () => apiClient.get<Investor[]>("/api/investor/investors").then(r => r.data),
  get: (id: number) => apiClient.get<Investor>(`/api/investor/investors/${id}`).then(r => r.data),
  create: (data: InvestorCreate) => apiClient.post<Investor>("/api/investor/investors", data).then(r => r.data),
  getDashboard: (id?: number) => {
    const url = id ? `/api/investor/investors/${id}/dashboard` : "/api/investor/dashboard";
    return apiClient.get<InvestorDashboard>(url).then(r => r.data);
  },
  getDocuments: (id: number) => apiClient.get<Document[]>(`/api/investor/investors/${id}/documents`).then(r => r.data),
  getMessages: (id: number) => apiClient.get<Message[]>(`/api/investor/investors/${id}/messages`).then(r => r.data),
  calculateWaterfall: (data: WaterfallInput) => apiClient.post<WaterfallResult>("/api/investor/waterfall/calculate", data).then(r => r.data),
};

// ── Communities ──────────────────────────────────────────────────────
export const communities = {
  getAll: () => apiClient.get("/api/community/communities").then(r => r.data),
  get: (id: number) => apiClient.get(`/api/community/communities/${id}`).then(r => r.data),
  getUnits: (communityId: number) => apiClient.get(`/api/community/communities/${communityId}/units`).then(r => r.data),
  getResidents: (communityId: number) => apiClient.get(`/api/community/communities/${communityId}/residents`).then(r => r.data),
  getBeds: (unitId: number) => apiClient.get(`/api/community/units/${unitId}/beds`).then(r => r.data),
  getMaintenance: () => apiClient.get("/api/community/maintenance").then(r => r.data),
};

// ── Reports ──────────────────────────────────────────────────────────
export const reports = {
  getSummary: () => apiClient.get("/api/reports/summary").then(r => r.data),
  getFundPerformance: () => apiClient.get("/api/reports/fund-performance").then(r => r.data),
};

// ── Documents ─────────────────────────────────────────────────────────
export const documents = {
  upload: (formData: FormData) =>
    apiClient.post("/api/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data),
  listByInvestor: (investorId: number) =>
    apiClient.get(`/api/documents/investor/${investorId}`).then(r => r.data),
  download: (documentId: number) =>
    apiClient.get(`/api/documents/${documentId}/download`, { responseType: "blob" }).then(r => r.data),
  markViewed: (documentId: number) =>
    apiClient.patch(`/api/documents/${documentId}/viewed`).then(r => r.data),
};

// ── Notifications ─────────────────────────────────────────────────────
export const notifications = {
  list: (unreadOnly = false) =>
    apiClient.get(`/api/notifications?unread_only=${unreadOnly}`).then(r => r.data),
  markRead: (notificationId: number) =>
    apiClient.patch(`/api/notifications/${notificationId}/read`).then(r => r.data),
  markAllRead: () =>
    apiClient.patch("/api/notifications/read-all").then(r => r.data),
};
