'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useProperties } from '@/hooks/usePortfolio';
import { useRiskAnalysis } from '@/hooks/useAI';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, ShieldAlert, TrendingUp, Scale, Settings,
  Send, Bot, User, Sparkles, Wrench, FileText, MessageSquare,
  BookOpen, Mail, MapPin, Search, AlertTriangle, Brain,
  Globe, Save, Copy, Check,
} from 'lucide-react';
import { useLPs } from '@/hooks/useInvestment';

// ── Types ────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  tools_used?: string[];
  timestamp: Date;
}

interface ChatResponse {
  response: string;
  tools_used: string[];
  model: string;
}

// ── Suggested Questions ──────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  { label: 'Portfolio Status', question: "Give me a quick summary of our portfolio — funds, properties, deployment status." },
  { label: 'Lowest Occupancy', question: "Which community currently has the lowest occupancy rate? Should we be worried?" },
  { label: 'Waterfall Sim', question: "If we distribute $50,000 from Fund I, how would it be split across holders?" },
  { label: 'Investor Exposure', question: "What is James Chen's total investment exposure across all funds?" },
  { label: 'Red Deer History', question: "What have we learned from our past acquisitions in Red Deer? Any lessons?" },
  { label: 'Fund I NAV', question: "What is the current NAV of Fund I and how does it compare to original unit price?" },
];

const TOOL_LABELS: Record<string, string> = {
  get_lp_summary: 'LP Summary',
  get_lp_nav: 'NAV Calculation',
  get_property_detail: 'Property Detail',
  list_properties: 'Property List',
  get_investor_holdings: 'Investor Holdings',
  list_investors: 'Investor List',
  get_community_occupancy: 'Occupancy Data',
  list_communities: 'Community List',
  get_community_pnl: 'Community P&L',
  run_waterfall: 'Waterfall Simulation',
  get_proforma: 'Pro Forma',
  get_trend_data: 'Trend Data',
  get_vacancy_alerts: 'Vacancy Alerts',
  get_portfolio_analytics: 'Portfolio Analytics',
  get_debt_facilities: 'Debt Facilities',
  recall_past_decisions: 'Decision Memory',
  log_decision: 'Log Decision',
};

// ── Chat Component ───────────────────────────────────────────────

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = useMutation({
    mutationFn: (payload: { message: string; conversation_history: { role: string; content: string }[] }) =>
      apiClient.post<ChatResponse>('/api/ai/chat', {
        ...payload,
        include_portfolio_context: true,
      }).then(r => r.data),
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Build conversation history for context
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const data = await chatMutation.mutateAsync({ message: text, conversation_history: history });
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        tools_used: data.tools_used,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (question: string) => {
    setInput(question);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Living Well AI Assistant</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Ask me anything about your portfolio. I can look up properties, investors,
              run waterfall simulations, generate pro formas, check occupancy, and recall past decisions.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-2xl">
              {SUGGESTED_QUESTIONS.map((sq) => (
                <button
                  key={sq.label}
                  onClick={() => handleSuggestion(sq.question)}
                  className="text-left rounded-lg border border-border p-3 text-sm hover:bg-muted transition-colors"
                >
                  <span className="font-medium text-primary">{sq.label}</span>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sq.question}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="shrink-0 rounded-full bg-primary/10 p-2 h-8 w-8 flex items-center justify-center mt-1">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              </div>
              {msg.tools_used && msg.tools_used.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
                  <Wrench className="h-3 w-3 text-muted-foreground mt-0.5" />
                  {msg.tools_used.map((tool, j) => (
                    <Badge key={j} variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                      {TOOL_LABELS[tool] || tool}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1 ml-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {msg.role === 'user' && (
              <div className="shrink-0 rounded-full bg-foreground/10 p-2 h-8 w-8 flex items-center justify-center mt-1">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex gap-3">
            <div className="shrink-0 rounded-full bg-primary/10 p-2 h-8 w-8 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-4 bg-background">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your portfolio, investors, properties, or past decisions..."
            className="flex-1 resize-none rounded-xl border border-input bg-transparent px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[48px] max-h-[120px]"
            rows={1}
            disabled={chatMutation.isPending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="rounded-xl h-12 w-12 shrink-0"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Claude AI with 17 platform tools. Responses may take a few seconds for complex queries.
        </p>
      </div>
    </div>
  );
}

// ── Risk Analysis Tab (existing) ─────────────────────────────────

function RiskAnalysisTab() {
  const { data: properties } = useProperties();
  const { mutate: analyzeRisk, data: riskData, isPending: isAnalyzing } = useRiskAnalysis();
  const [selectedPropId, setSelectedPropId] = useState<string>('');

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'financial': return <TrendingUp className="h-4 w-4" />;
      case 'regulatory': return <Scale className="h-4 w-4" />;
      case 'operational': return <Settings className="h-4 w-4" />;
      default: return <ShieldAlert className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Property Risk Analysis</CardTitle>
          <CardDescription>Select a property for AI-powered risk assessment with full financial context.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={selectedPropId} onValueChange={(v: string | null) => setSelectedPropId(v ?? "")}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a property..." />
            </SelectTrigger>
            <SelectContent>
              {properties?.map((p) => (
                <SelectItem key={p.property_id} value={p.property_id.toString()}>
                  {p.address}, {p.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => selectedPropId && analyzeRisk(parseInt(selectedPropId))} disabled={!selectedPropId || isAnalyzing}>
            {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Analyze Risk
          </Button>
        </CardContent>
      </Card>

      {riskData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1 bg-slate-50 dark:bg-slate-900">
              <CardHeader><CardTitle>Risk Score</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className={`text-6xl font-bold ${riskData.overall_risk_score > 70 ? 'text-red-600' : riskData.overall_risk_score > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {riskData.overall_risk_score}
                </div>
                <p className="text-sm text-muted-foreground mt-2">/ 100 (Lower is better)</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Executive Summary</CardTitle></CardHeader>
              <CardContent><p className="text-base leading-relaxed">{riskData.summary}</p></CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {riskData.risks.map((risk: { category: string; severity: string; description: string; mitigation: string }, idx: number) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {getCategoryIcon(risk.category)}
                      <span className="text-sm font-medium uppercase tracking-wider">{risk.category}</span>
                    </div>
                    <Badge className={getSeverityColor(risk.severity)}>{risk.severity}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{risk.description}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-3 rounded-md mt-2">
                    <span className="font-semibold text-sm block mb-1">Mitigation Strategy:</span>
                    <span className="text-sm">{risk.mitigation}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Underwriting Tab ─────────────────────────────────────────────

function UnderwritingTab() {
  const { data: properties } = useProperties();
  const [selectedPropId, setSelectedPropId] = useState<string>('');
  const underwriteMutation = useMutation({
    mutationFn: (propertyId: number) =>
      apiClient.post('/api/ai/underwrite', { property_id: propertyId, lp_id: null }).then(r => r.data),
  });

  const data = underwriteMutation.data as Record<string, unknown> | undefined;

  const recColor = (rec: string) => {
    switch (rec) {
      case 'strong_buy': return 'text-green-600';
      case 'buy': return 'text-green-500';
      case 'hold': return 'text-yellow-600';
      case 'pass': return 'text-red-600';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Underwriting Memo</CardTitle>
          <CardDescription>Generate a full acquisition underwriting analysis with go/no-go recommendation.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={selectedPropId} onValueChange={(v: string | null) => setSelectedPropId(v ?? "")}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a property..." />
            </SelectTrigger>
            <SelectContent>
              {properties?.map((p) => (
                <SelectItem key={p.property_id} value={p.property_id.toString()}>
                  {p.address}, {p.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => selectedPropId && underwriteMutation.mutate(parseInt(selectedPropId))} disabled={!selectedPropId || underwriteMutation.isPending}>
            {underwriteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Memo
          </Button>
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Recommendation</CardTitle></CardHeader>
              <CardContent className="text-center py-4">
                <div className={`text-3xl font-bold uppercase ${recColor(data.recommendation as string)}`}>
                  {(data.recommendation as string)?.replace('_', ' ')}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Confidence: {data.confidence as number}%</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Executive Summary</CardTitle></CardHeader>
              <CardContent><p className="text-base leading-relaxed">{data.executive_summary as string}</p></CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-green-600">Strengths</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(data.strengths as string[] || []).map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm"><span className="text-green-500 mt-0.5">+</span>{s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-red-600">Concerns</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(data.concerns as string[] || []).map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm"><span className="text-red-500 mt-0.5">-</span>{c}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          {Array.isArray(data.conditions) && (data.conditions as string[]).length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Conditions to Proceed</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {(data.conditions as string[]).map((c: string, i: number) => (
                    <li key={i} className="text-sm flex gap-2"><span className="text-muted-foreground">&#9744;</span>{c}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Report Narrative Tab ─────────────────────────────────────────

interface ReportNarrative {
  executive_summary: string;
  property_updates: string;
  market_commentary: string;
  investor_outlook: string;
}

function ReportNarrativeTab() {
  const { data: lps } = useLPs();
  const [selectedLpId, setSelectedLpId] = useState<string>('');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const q = Math.ceil(now.getMonth() / 3) || 1;
    return `Q${q} ${now.getFullYear()}`;
  });

  const mutation = useMutation({
    mutationFn: (payload: { lp_id: number; period: string }) =>
      apiClient.post<ReportNarrative>('/api/ai/generate-report-narrative', payload).then(r => r.data),
  });

  const data = mutation.data;

  const sections = data ? [
    { title: 'Executive Summary', content: data.executive_summary, icon: <BookOpen className="h-4 w-4" /> },
    { title: 'Property Updates', content: data.property_updates, icon: <MapPin className="h-4 w-4" /> },
    { title: 'Market Commentary', content: data.market_commentary, icon: <TrendingUp className="h-4 w-4" /> },
    { title: 'Investor Outlook', content: data.investor_outlook, icon: <Sparkles className="h-4 w-4" /> },
  ] : [];

  const handleCopyAll = () => {
    if (!data) return;
    const text = `Executive Summary\n${data.executive_summary}\n\nProperty Updates\n${data.property_updates}\n\nMarket Commentary\n${data.market_commentary}\n\nInvestor Outlook\n${data.investor_outlook}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Report Narrative</CardTitle>
          <CardDescription>Generate AI-written quarterly report sections from LP portfolio data.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">LP Fund</Label>
            <Select value={selectedLpId} onValueChange={(v: string | null) => setSelectedLpId(v ?? "")}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select an LP..." />
              </SelectTrigger>
              <SelectContent>
                {(lps as { lp_id: number; name: string }[] | undefined)?.map((lp) => (
                  <SelectItem key={lp.lp_id} value={lp.lp_id.toString()}>
                    {lp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Period</Label>
            <Input
              value={period}
              onChange={e => setPeriod(e.target.value)}
              placeholder="Q1 2026"
              className="w-[140px]"
            />
          </div>
          <Button
            onClick={() => selectedLpId && mutation.mutate({ lp_id: parseInt(selectedLpId), period })}
            disabled={!selectedLpId || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Report
          </Button>
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy All
            </Button>
          </div>
          {sections.map((section, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {section.icon}
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{section.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Investor Communications Tab ─────────────────────────────────

const COMM_TYPES = [
  { value: 'distribution_notice', label: 'Distribution Notice' },
  { value: 'quarterly_update', label: 'Quarterly Update' },
  { value: 'welcome_letter', label: 'Welcome Letter' },
  { value: 'capital_confirmation', label: 'Capital Call Confirmation' },
  { value: 'year_end', label: 'Year-End Summary' },
  { value: 'milestone', label: 'Milestone Update' },
  { value: 'custom', label: 'Custom' },
];

function InvestorCommunicationsTab() {
  const { data: lps } = useLPs();
  const [selectedLpId, setSelectedLpId] = useState<string>('');
  const [commType, setCommType] = useState('quarterly_update');
  const [customSubject, setCustomSubject] = useState('');
  const [draft, setDraft] = useState<{ subject: string; body: string; tone: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: { lp_id: number; communication_type: string; custom_subject?: string }) =>
      apiClient.post('/api/ai/draft-investor-communication', payload).then(r => r.data),
    onSuccess: (data) => setDraft(data as { subject: string; body: string; tone: string }),
  });

  const handleCopy = () => {
    if (!draft) return;
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Investor Communication Drafter</CardTitle>
          <CardDescription>AI-draft personalized investor emails from your portfolio data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-1.5">
              <Label className="text-xs">LP Fund</Label>
              <Select value={selectedLpId} onValueChange={(v: string | null) => setSelectedLpId(v ?? "")}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select an LP..." />
                </SelectTrigger>
                <SelectContent>
                  {(lps as { lp_id: number; name: string }[] | undefined)?.map((lp) => (
                    <SelectItem key={lp.lp_id} value={lp.lp_id.toString()}>
                      {lp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Communication Type</Label>
              <Select value={commType} onValueChange={setCommType}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMM_TYPES.map(ct => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => selectedLpId && mutation.mutate({
                lp_id: parseInt(selectedLpId),
                communication_type: commType,
                ...(commType === 'custom' && customSubject ? { custom_subject: customSubject } : {}),
              })}
              disabled={!selectedLpId || mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Draft Email
            </Button>
          </div>
          {commType === 'custom' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Custom Subject</Label>
              <Input
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                placeholder="Describe what this email should be about..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {draft && (
        <Card className="animate-in fade-in slide-in-from-bottom-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                {draft.subject}
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">{draft.tone}</Badge>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{draft.body}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Area Research Tab ────────────────────────────────────────────

function AreaResearchTab() {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Calgary');

  const mutation = useMutation({
    mutationFn: (payload: { address: string; city: string }) =>
      apiClient.post('/api/ai/area-research', payload).then(r => r.data),
  });

  const data = mutation.data as Record<string, unknown> | undefined;

  const renderSection = (title: string, items: unknown) => {
    if (!items || (Array.isArray(items) && items.length === 0)) return null;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {typeof items === 'string' ? (
            <p className="text-sm leading-relaxed">{items}</p>
          ) : Array.isArray(items) ? (
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="text-sm">
                  {typeof item === 'object' ? (
                    <div className="bg-muted/50 rounded p-2 space-y-0.5">
                      {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-medium">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : String(item)}
                </li>
              ))}
            </ul>
          ) : typeof items === 'object' ? (
            <div className="space-y-1">
              {Object.entries(items as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Area Research</CardTitle>
          <CardDescription>AI-powered due diligence research for a property area — comps, zoning, rentals, demographics.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">Address or Area</Label>
            <Input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St NW or Beltline, Calgary"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">City</Label>
            <Input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Calgary"
              className="w-[140px]"
            />
          </div>
          <Button
            onClick={() => address.trim() && mutation.mutate({ address, city })}
            disabled={!address.trim() || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Search className="mr-2 h-4 w-4" />
            Research
          </Button>
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          {data.summary && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed">{data.summary as string}</p>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {renderSection('Comparable Sales', data.comparable_sales)}
            {renderSection('Active Listings', data.active_listings)}
            {renderSection('Zoning & Land Use', data.zoning)}
            {renderSection('Rezoning Activity', data.rezoning)}
            {renderSection('Rental Market', data.rental_market)}
            {renderSection('Demographics', data.demographics)}
            {renderSection('Development Activity', data.development_activity)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Funding Research Tab ────────────────────────────────────────

function FundingResearchTab() {
  const [communityType, setCommunityType] = useState('');
  const [city, setCity] = useState('Calgary');

  const mutation = useMutation({
    mutationFn: (payload: { community_type: string; city: string }) =>
      apiClient.post('/api/ai/research-funding', payload).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { community_type: string; opportunities: unknown[] }) =>
      apiClient.post('/api/ai/research-funding/save-opportunities', payload).then(r => r.data),
  });

  const data = mutation.data as { opportunities?: { program_name: string; provider: string; description: string; eligibility: string; estimated_amount: string; application_url?: string }[]; summary?: string } | undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Government Funding Research</CardTitle>
          <CardDescription>Search for CMHC, provincial, and municipal funding programs for your community type.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Community Type</Label>
            <Select value={communityType} onValueChange={setCommunityType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LiveWell">LiveWell</SelectItem>
                <SelectItem value="RecoverWell">RecoverWell</SelectItem>
                <SelectItem value="StudyWell">StudyWell</SelectItem>
                <SelectItem value="WorkWell">WorkWell</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">City</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} className="w-[140px]" />
          </div>
          <Button
            onClick={() => communityType && mutation.mutate({ community_type: communityType, city })}
            disabled={!communityType || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Globe className="mr-2 h-4 w-4" />
            Search Funding
          </Button>
        </CardContent>
      </Card>

      {data?.opportunities && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          {data.summary && (
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed">{data.summary}</p>
              </CardContent>
            </Card>
          )}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => data.opportunities && saveMutation.mutate({ community_type: communityType, opportunities: data.opportunities })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save to Database
            </Button>
          </div>
          {data.opportunities.map((opp, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{opp.program_name}</CardTitle>
                  <Badge variant="secondary">{opp.provider}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{opp.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Eligibility: </span>
                    <span>{opp.eligibility}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est. Amount: </span>
                    <span className="font-medium">{opp.estimated_amount}</span>
                  </div>
                </div>
                {opp.application_url && (
                  <a href={opp.application_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    Application Link &rarr;
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Anomaly Detection Tab ───────────────────────────────────────

function AnomalyDetectionTab() {
  const { data: lps } = useLPs();
  const [selectedLpId, setSelectedLpId] = useState<string>('');

  const mutation = useMutation({
    mutationFn: (payload: { entity_type: string; entity_id: number }) =>
      apiClient.post('/api/ai/detect-anomalies', payload).then(r => r.data),
  });

  const data = mutation.data as { summary?: string; anomalies?: { metric: string; period: string; description: string; severity: string; recommendation: string }[] } | undefined;

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Anomaly Detection</CardTitle>
          <CardDescription>AI analysis of trend data to identify unusual patterns, drops, or spikes.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">LP Fund</Label>
            <Select value={selectedLpId} onValueChange={(v: string | null) => setSelectedLpId(v ?? "")}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select an LP..." />
              </SelectTrigger>
              <SelectContent>
                {(lps as { lp_id: number; name: string }[] | undefined)?.map((lp) => (
                  <SelectItem key={lp.lp_id} value={lp.lp_id.toString()}>
                    {lp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => selectedLpId && mutation.mutate({ entity_type: 'lp', entity_id: parseInt(selectedLpId) })}
            disabled={!selectedLpId || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <AlertTriangle className="mr-2 h-4 w-4" />
            Detect Anomalies
          </Button>
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          {data.summary && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed">{data.summary}</p>
              </CardContent>
            </Card>
          )}
          {data.anomalies?.length === 0 && (
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="pt-4 text-center">
                <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-700">No anomalies detected</p>
              </CardContent>
            </Card>
          )}
          {data.anomalies?.map((anomaly, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{anomaly.metric}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{anomaly.period}</Badge>
                    <Badge className={severityColor(anomaly.severity)}>{anomaly.severity}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{anomaly.description}</p>
                <div className="bg-muted p-3 rounded-md">
                  <span className="font-semibold text-xs block mb-1">Recommendation:</span>
                  <span className="text-sm">{anomaly.recommendation}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Decision Memory Tab ─────────────────────────────────────────

interface Decision {
  decision_id: string;
  decision_type: string;
  title: string;
  rationale: string;
  outcome?: string;
  outcome_notes?: string;
  created_at: string;
  tags: string[];
}

function DecisionMemoryTab() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDecisions = async (query?: string) => {
    setLoading(true);
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : '';
      const resp = await apiClient.get(`/api/ai/decisions${params}`);
      setDecisions((resp.data as { decisions?: Decision[] }).decisions || resp.data as Decision[]);
    } catch {
      setDecisions([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDecisions(); }, []);

  const handleSearch = () => {
    fetchDecisions(searchQuery || undefined);
  };

  const outcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'successful': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'mixed': return 'text-yellow-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Decision Memory</CardTitle>
          <CardDescription>Browse and search institutional knowledge — past decisions, rationale, and outcomes.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Search Decisions</Label>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by keyword, property, or decision type..."
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Search
          </Button>
        </CardContent>
      </Card>

      {decisions.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No decisions recorded yet. Use the AI chat to log decisions.</p>
          </CardContent>
        </Card>
      )}

      {decisions.map((d) => (
        <Card key={d.decision_id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base">{d.title}</CardTitle>
              <div className="flex gap-2 items-center">
                <Badge variant="outline">{d.decision_type}</Badge>
                {d.outcome && (
                  <span className={`text-xs font-semibold uppercase ${outcomeColor(d.outcome)}`}>
                    {d.outcome}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{d.rationale}</p>
            {d.outcome_notes && (
              <div className="bg-muted p-3 rounded-md">
                <span className="text-xs font-semibold block mb-1">Outcome Notes:</span>
                <span className="text-sm">{d.outcome_notes}</span>
              </div>
            )}
            {d.tags?.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {d.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function AIDashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Claude-powered intelligence with access to your entire portfolio.
        </p>
      </div>

      <Tabs defaultValue="chat">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5">
            <ShieldAlert className="h-4 w-4" />
            Risk Analysis
          </TabsTrigger>
          <TabsTrigger value="underwriting" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Underwriting
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            Report Narrative
          </TabsTrigger>
          <TabsTrigger value="communications" className="gap-1.5">
            <Mail className="h-4 w-4" />
            Communications
          </TabsTrigger>
          <TabsTrigger value="area-research" className="gap-1.5">
            <MapPin className="h-4 w-4" />
            Area Research
          </TabsTrigger>
          <TabsTrigger value="funding" className="gap-1.5">
            <Globe className="h-4 w-4" />
            Funding
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Anomalies
          </TabsTrigger>
          <TabsTrigger value="decisions" className="gap-1.5">
            <Brain className="h-4 w-4" />
            Decisions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <ChatTab />
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <RiskAnalysisTab />
        </TabsContent>
        <TabsContent value="underwriting" className="mt-4">
          <UnderwritingTab />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportNarrativeTab />
        </TabsContent>
        <TabsContent value="communications" className="mt-4">
          <InvestorCommunicationsTab />
        </TabsContent>
        <TabsContent value="area-research" className="mt-4">
          <AreaResearchTab />
        </TabsContent>
        <TabsContent value="funding" className="mt-4">
          <FundingResearchTab />
        </TabsContent>
        <TabsContent value="anomalies" className="mt-4">
          <AnomalyDetectionTab />
        </TabsContent>
        <TabsContent value="decisions" className="mt-4">
          <DecisionMemoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
