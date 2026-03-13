'use client';

import { useState } from 'react';
import { useProperties } from '@/hooks/usePortfolio';
import { useRiskAnalysis } from '@/hooks/useAI';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, TrendingUp, Scale, Settings } from 'lucide-react';

export default function AIDashboardPage() {
  const { data: properties, isLoading: propsLoading } = useProperties();
  const { mutate: analyzeRisk, data: riskData, isPending: isAnalyzing } = useRiskAnalysis();
  const [selectedPropId, setSelectedPropId] = useState<string>('');

  const handleAnalyze = () => {
    if (selectedPropId) {
      analyzeRisk(parseInt(selectedPropId));
    }
  };

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Decision Layer</h1>
        <p className="text-muted-foreground">
          AI-powered risk analysis and underwriting intelligence.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Property Risk Analysis</CardTitle>
          <CardDescription>Select a property to generate a comprehensive risk profile.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={selectedPropId} onValueChange={(v: string | null) => setSelectedPropId(v ?? "")}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a property..." />
            </SelectTrigger>
            <SelectContent>
              {properties?.map((p) => (
                <SelectItem key={p.property_id} value={p.property_id.toString()}>
                  {p.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAnalyze} disabled={!selectedPropId || isAnalyzing}>
            {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Analyze Risk
          </Button>
        </CardContent>
      </Card>

      {riskData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1 bg-slate-50">
              <CardHeader>
                <CardTitle>Risk Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className={`text-6xl font-bold ${riskData.overall_risk_score > 70 ? 'text-red-600' : riskData.overall_risk_score > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {riskData.overall_risk_score}
                </div>
                <p className="text-sm text-muted-foreground mt-2">/ 100 (Lower is better)</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg leading-relaxed">{riskData.summary}</p>
              </CardContent>
            </Card>
          </div>

          <h3 className="text-xl font-semibold mt-8 mb-4">Identified Risks & Mitigations</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {riskData.risks.map((risk, idx) => (
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
                  <div className="bg-slate-100 p-3 rounded-md mt-2">
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
