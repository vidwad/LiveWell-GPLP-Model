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
import {
  Loader2, ShieldAlert, TrendingUp, Scale, Settings,
  Send, Bot, User, Sparkles, Wrench, FileText, MessageSquare,
} from 'lucide-react';

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
          {data.conditions && (data.conditions as string[]).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Conditions to Proceed</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {(data.conditions as string[]).map((c, i) => (
                    <li key={i} className="text-sm flex gap-2"><span className="text-muted-foreground">&#9744;</span>{c}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
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
        <TabsList>
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
      </Tabs>
    </div>
  );
}
