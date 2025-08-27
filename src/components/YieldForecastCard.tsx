import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, DollarSign, Calendar, AlertTriangle } from "lucide-react";
import { ComprehensiveYieldAnalysis } from "@/lib/yieldForecast";

interface YieldForecastCardProps {
  analysis: ComprehensiveYieldAnalysis;
  cropType: string;
  area: number;
}

export function YieldForecastCard({ analysis, cropType, area }: YieldForecastCardProps) {
  const { yield_forecast, profitability, comparative_performance } = analysis;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "text-red-600";
      case "medium": return "text-yellow-600";
      case "low": return "text-green-600";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Previsione Resa e Redditività
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Yield Forecast */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Resa Stimata</h3>
            <Badge variant="secondary">{yield_forecast.confidence_interval.confidence_level}% confidenza</Badge>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-center mb-3">
              <span className="text-3xl font-bold text-foreground">{yield_forecast.estimated_yield_tons_ha}</span>
              <span className="text-muted-foreground ml-1">t/ha</span>
            </div>
            
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Min: {yield_forecast.confidence_interval.min_yield} t/ha</span>
              <span>Max: {yield_forecast.confidence_interval.max_yield} t/ha</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Potenziale realizzato</span>
                <span className="font-medium">{yield_forecast.yield_potential_realized}%</span>
              </div>
              <Progress value={yield_forecast.yield_potential_realized} className="h-2" />
            </div>
          </div>
        </div>

        {/* Profitability Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-muted-foreground text-sm flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              Ricavo stimato
            </span>
            <p className="font-medium">{Math.round(profitability.revenue_forecast.base_scenario)} €</p>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-sm">Margine lordo</span>
            <p className="font-medium">{Math.round(profitability.profitability_metrics.gross_margin)} €</p>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-sm">ROI</span>
            <p className="font-medium">{profitability.profitability_metrics.roi_percent}%</p>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-sm">Break-even</span>
            <p className="font-medium">{profitability.profitability_metrics.break_even_yield} t/ha</p>
          </div>
        </div>

        {/* Maturation Estimate */}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-800">Stima Maturazione</span>
          </div>
          <p className="text-sm text-blue-700">
            {yield_forecast.maturation_estimate.days_to_harvest} giorni alla raccolta • {yield_forecast.maturation_estimate.optimal_harvest_window}
          </p>
        </div>

        {/* Limiting Factors */}
        {yield_forecast.limiting_factors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Fattori Limitanti
            </h4>
            <div className="space-y-1">
              {yield_forecast.limiting_factors.slice(0, 3).map((factor, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{factor.factor}</span>
                  <span className={`font-medium ${getSeverityColor(factor.severity)}`}>
                    -{factor.impact_percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Comparison */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-foreground mb-2">Performance Comparativa</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">vs Media Regionale</span>
              <p className={`font-medium ${comparative_performance.vs_regional_average >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {comparative_performance.vs_regional_average >= 0 ? '+' : ''}{comparative_performance.vs_regional_average}%
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Percentile</span>
              <p className="font-medium">{comparative_performance.ranking_percentile}°</p>
            </div>
          </div>
        </div>

        {/* Investment Recommendations */}
        {profitability.investment_recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">Raccomandazioni Investimento</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {profitability.investment_recommendations.slice(0, 2).map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{rec.action}</span>
                    <span className="ml-2">ROI {rec.expected_roi}% • {rec.payback_period}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}