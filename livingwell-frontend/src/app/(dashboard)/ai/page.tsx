"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, AlertTriangle } from "lucide-react";
import { useValidateAssumptions, useRunScenario } from "@/hooks/useAI";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const { mutateAsync: validate, isPending: validatePending } = useValidateAssumptions();
  const { mutateAsync: scenario, isPending: scenarioPending } = useRunScenario();

  const [validateForm, setValidateForm] = useState({
    cap_rate: 0.05,
    construction_cost_per_sqft: 250,
    timeline_months: 18,
    market: "Toronto, ON",
  });

  const [scenarioForm, setScenarioForm] = useState({
    interest_rate_shift: 0.5,
    portfolio_summary: "{}",
  });

  const [noKey, setNoKey] = useState(false);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = `Validate assumptions: cap rate ${(validateForm.cap_rate * 100).toFixed(1)}%, construction $${validateForm.construction_cost_per_sqft}/sqft, ${validateForm.timeline_months} months in ${validateForm.market}`;
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    try {
      const res = await validate(validateForm);
      setMessages((m) => [...m, { role: "assistant", content: res.result }]);
      setNoKey(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 503) {
        setNoKey(true);
        setMessages((m) => m.slice(0, -1));
      } else {
        toast.error("AI request failed");
        setMessages((m) => m.slice(0, -1));
      }
    }
  };

  const handleScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    let portfolioObj: Record<string, unknown> = {};
    try {
      portfolioObj = JSON.parse(scenarioForm.portfolio_summary);
    } catch {
      toast.error("Portfolio summary must be valid JSON");
      return;
    }
    const prompt = `Scenario: ${scenarioForm.interest_rate_shift > 0 ? "+" : ""}${scenarioForm.interest_rate_shift}% interest rate shift`;
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    try {
      const res = await scenario({
        interest_rate_shift: scenarioForm.interest_rate_shift,
        portfolio_summary: portfolioObj,
      });
      setMessages((m) => [...m, { role: "assistant", content: res.result }]);
      setNoKey(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 503) {
        setNoKey(true);
        setMessages((m) => m.slice(0, -1));
      } else {
        toast.error("AI request failed");
        setMessages((m) => m.slice(0, -1));
      }
    }
  };

  const isPending = validatePending || scenarioPending;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Assistant
        </h1>
        <p className="text-muted-foreground">
          Validate assumptions and run interest rate scenarios with GPT-4o-mini
        </p>
      </div>

      {noKey && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">OpenAI API key not configured</p>
            <p className="text-sm">
              Add your{" "}
              <code className="rounded bg-yellow-100 px-1">OPENAI_API_KEY</code> to{" "}
              <code className="rounded bg-yellow-100 px-1">backend/.env</code> and restart
              the server to enable AI features.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Panel */}
        <div>
          <Tabs defaultValue="validate">
            <TabsList className="w-full">
              <TabsTrigger value="validate" className="flex-1">Validate Assumptions</TabsTrigger>
              <TabsTrigger value="scenario" className="flex-1">Scenario Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="validate" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assumption Validation</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleValidate} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cap Rate (e.g. 0.05 = 5%)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={validateForm.cap_rate}
                        onChange={(e) =>
                          setValidateForm((f) => ({ ...f, cap_rate: Number(e.target.value) }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Construction Cost ($/sqft)</Label>
                      <Input
                        type="number"
                        value={validateForm.construction_cost_per_sqft}
                        onChange={(e) =>
                          setValidateForm((f) => ({
                            ...f,
                            construction_cost_per_sqft: Number(e.target.value),
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Timeline (months)</Label>
                      <Input
                        type="number"
                        value={validateForm.timeline_months}
                        onChange={(e) =>
                          setValidateForm((f) => ({
                            ...f,
                            timeline_months: Number(e.target.value),
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Market</Label>
                      <Input
                        value={validateForm.market}
                        onChange={(e) =>
                          setValidateForm((f) => ({ ...f, market: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {validatePending ? "Analyzing…" : "Validate"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scenario" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Interest Rate Scenario</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleScenario} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Interest Rate Shift (%, e.g. 0.5 = +50bps)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={scenarioForm.interest_rate_shift}
                        onChange={(e) =>
                          setScenarioForm((f) => ({
                            ...f,
                            interest_rate_shift: Number(e.target.value),
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Portfolio Summary (JSON)</Label>
                      <Textarea
                        value={scenarioForm.portfolio_summary}
                        onChange={(e) =>
                          setScenarioForm((f) => ({
                            ...f,
                            portfolio_summary: e.target.value,
                          }))
                        }
                        rows={6}
                        placeholder='{"properties": 3, "total_debt": 5000000}'
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {scenarioPending ? "Running…" : "Run Scenario"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Response Panel */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Response History</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Responses will appear here after you submit a request.
              </p>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 text-sm ${
                      msg.role === "user"
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/5 border border-primary/20"
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">
                      {msg.role === "user" ? "You" : "AI"}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
                {isPending && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">AI</p>
                    <p className="text-sm text-muted-foreground animate-pulse">Thinking…</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
