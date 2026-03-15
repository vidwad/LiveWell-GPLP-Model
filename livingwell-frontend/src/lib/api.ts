import axios from "axios";
import type { CostEstimateInput, CostEstimateResult, Property, PropertyCreate, DevelopmentPlan, DevelopmentPlanCreate, PropertyCluster, PropertyManager, PropertyManagerCreate } from "@/types/portfolio";
import type { GPEntity, LPEntity, LPDetail, LPCreate, LPTranche, LPTrancheCreate, Subscription, SubscriptionCreate, Holding, TargetProperty, LPPortfolioRollup, DistributionEvent, Investor as InvInvestor, WaterfallResult as InvWaterfallResult } from "@/types/investment";
import type { Investor, InvestorCreate, InvestorDashboard, InvestorDistributionHistory, Document, Message, WaterfallInput, WaterfallResult } from "@/types/investor";

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

  // Cap Rate Valuation
  calculateCapRateValuation: (propertyId: number, data: { noi: number; cap_rate: number }) =>
    apiClient.post(`/api/portfolio/properties/${propertyId}/valuations/cap-rate`, data).then(r => r.data),
  saveCapRateValuation: (propertyId: number, data: { noi: number; cap_rate: number }) =>
    apiClient.post(`/api/portfolio/properties/${propertyId}/valuations/cap-rate/save`, data).then(r => r.data),

  // Construction Budget
  getConstructionExpenses: (propertyId: number, planId?: number) =>
    apiClient.get(`/api/portfolio/properties/${propertyId}/construction-expenses`, { params: planId ? { plan_id: planId } : {} }).then(r => r.data),
  createConstructionExpense: (propertyId: number, data: object) =>
    apiClient.post(`/api/portfolio/properties/${propertyId}/construction-expenses`, data).then(r => r.data),
  getConstructionBudgetSummary: (propertyId: number, planId: number) =>
    apiClient.get(`/api/portfolio/properties/${propertyId}/construction-budget-summary`, { params: { plan_id: planId } }).then(r => r.data),

  // Construction Draws
  getConstructionDraws: (propertyId: number, debtId?: number) =>
    apiClient.get(`/api/portfolio/properties/${propertyId}/construction-draws`, { params: debtId ? { debt_id: debtId } : {} }).then(r => r.data),
  createConstructionDraw: (propertyId: number, data: object) =>
    apiClient.post(`/api/portfolio/properties/${propertyId}/construction-draws`, data).then(r => r.data),
  updateConstructionDraw: (drawId: number, data: object) =>
    apiClient.patch(`/api/portfolio/construction-draws/${drawId}`, data).then(r => r.data),

  // Valuations
  getValuations: (propertyId: number) =>
    apiClient.get(`/api/portfolio/properties/${propertyId}/valuations`).then(r => r.data),
};

// ── Investment (GP / LP / Tranche / Subscription / Holding / Target / Distribution) ─────
export const investment = {
  // GP
  getGPs: () => apiClient.get<GPEntity[]>("/api/investment/gp").then(r => r.data),
  createGP: (data: Partial<GPEntity>) => apiClient.post<GPEntity>("/api/investment/gp", data).then(r => r.data),
  updateGP: (id: number, data: Partial<GPEntity>) => apiClient.patch<GPEntity>(`/api/investment/gp/${id}`, data).then(r => r.data),

  // LP
  getLPs: () => apiClient.get<LPEntity[]>("/api/investment/lp").then(r => r.data),
  getLP: (id: number) => apiClient.get<LPDetail>(`/api/investment/lp/${id}`).then(r => r.data),
  createLP: (data: LPCreate) => apiClient.post<LPEntity>("/api/investment/lp", data).then(r => r.data),
  updateLP: (id: number, data: Partial<LPCreate>) => apiClient.patch<LPEntity>(`/api/investment/lp/${id}`, data).then(r => r.data),

  // Tranches
  getTranches: (lpId: number) => apiClient.get<LPTranche[]>(`/api/investment/lp/${lpId}/tranches`).then(r => r.data),
  createTranche: (lpId: number, data: LPTrancheCreate) => apiClient.post<LPTranche>(`/api/investment/lp/${lpId}/tranches`, data).then(r => r.data),
  updateTranche: (trancheId: number, data: Partial<LPTrancheCreate>) => apiClient.patch<LPTranche>(`/api/investment/tranches/${trancheId}`, data).then(r => r.data),

  // Investors
  getInvestors: () => apiClient.get<InvInvestor[]>("/api/investment/investors").then(r => r.data),
  createInvestor: (data: Partial<InvInvestor>) => apiClient.post<InvInvestor>("/api/investment/investors", data).then(r => r.data),
  updateInvestor: (id: number, data: Partial<InvInvestor>) => apiClient.patch<InvInvestor>(`/api/investment/investors/${id}`, data).then(r => r.data),

  // Subscriptions
  getSubscriptions: (lpId: number) => apiClient.get<Subscription[]>(`/api/investment/lp/${lpId}/subscriptions`).then(r => r.data),
  createSubscription: (lpId: number, data: SubscriptionCreate) => apiClient.post<Subscription>(`/api/investment/lp/${lpId}/subscriptions`, data).then(r => r.data),
  updateSubscription: (subId: number, data: Partial<SubscriptionCreate>) => apiClient.patch<Subscription>(`/api/investment/subscriptions/${subId}`, data).then(r => r.data),

  // Holdings
  getHoldings: (lpId: number) => apiClient.get<Holding[]>(`/api/investment/lp/${lpId}/holdings`).then(r => r.data),
  createHolding: (lpId: number, data: Partial<Holding>) => apiClient.post<Holding>(`/api/investment/lp/${lpId}/holdings`, data).then(r => r.data),
  updateHolding: (holdingId: number, data: Partial<Holding>) => apiClient.patch<Holding>(`/api/investment/holdings/${holdingId}`, data).then(r => r.data),

  // Target Properties
  getTargetProperties: (lpId: number) => apiClient.get<TargetProperty[]>(`/api/investment/lp/${lpId}/target-properties`).then(r => r.data),
  createTargetProperty: (lpId: number, data: Partial<TargetProperty>) => apiClient.post<TargetProperty>(`/api/investment/lp/${lpId}/target-properties`, data).then(r => r.data),
  updateTargetProperty: (tpId: number, data: Partial<TargetProperty>) => apiClient.patch<TargetProperty>(`/api/investment/target-properties/${tpId}`, data).then(r => r.data),
  deleteTargetProperty: (tpId: number) => apiClient.delete(`/api/investment/target-properties/${tpId}`).then(r => r.data),
  convertTargetProperty: (tpId: number) => apiClient.post(`/api/investment/target-properties/${tpId}/convert`).then(r => r.data),

  // Portfolio Roll-up
  getPortfolioRollup: (lpId: number) => apiClient.get<LPPortfolioRollup>(`/api/investment/lp/${lpId}/portfolio-rollup`).then(r => r.data),

  // Distributions
  getDistributions: (lpId: number) => apiClient.get<DistributionEvent[]>(`/api/investment/lp/${lpId}/distributions`).then(r => r.data),

  // P&L
  getLpPnl: (lpId: number, year: number, month?: number) =>
    apiClient.get(`/api/investment/lp/${lpId}/pnl`, { params: { year, ...(month ? { month } : {}) } }).then(r => r.data),

  // NAV
  getLpNav: (lpId: number) =>
    apiClient.get(`/api/investment/lp/${lpId}/nav`).then(r => r.data),

  // Waterfall
  computeWaterfall: (lpId: number, distributableAmount: number) =>
    apiClient.post<InvWaterfallResult>(`/api/investment/lp/${lpId}/waterfall`, { distributable_amount: distributableAmount }).then(r => r.data),

  // Portfolio Analytics
  getPortfolioAnalytics: () =>
    apiClient.get("/api/investment/portfolio-analytics").then(r => r.data),
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
  getDistributions: (id: number) => apiClient.get<InvestorDistributionHistory>(`/api/investor/investors/${id}/distributions`).then(r => r.data),
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
  getVacancyAlerts: (thresholdDays?: number) =>
    apiClient.get("/api/community/operations/vacancy-alerts", { params: thresholdDays ? { threshold_days: thresholdDays } : {} }).then(r => r.data),
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

// ── Property Managers ──────────────────────────────────────────────────
export const propertyManagers = {
  getAll: () => apiClient.get<PropertyManager[]>("/api/property-managers").then(r => r.data),
  get: (id: number) => apiClient.get<PropertyManager>(`/api/property-managers/${id}`).then(r => r.data),
  create: (data: PropertyManagerCreate) => apiClient.post<PropertyManager>("/api/property-managers", data).then(r => r.data),
  update: (id: number, data: Partial<PropertyManagerCreate>) => apiClient.patch<PropertyManager>(`/api/property-managers/${id}`, data).then(r => r.data),
  delete: (id: number) => apiClient.delete(`/api/property-managers/${id}`).then(r => r.data),
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
