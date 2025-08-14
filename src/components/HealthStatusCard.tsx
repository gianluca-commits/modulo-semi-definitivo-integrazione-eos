import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Leaf, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getHealthStatus, getSeasonalContext, TemporalAnalysis } from "@/lib/eosAnalysis";

interface HealthStatusCardProps {
  ndvi: number;
  trend?: number;
  cropType: string;
  temporalAnalysis?: TemporalAnalysis | null;
  isDemo?: boolean;
}

export const HealthStatusCard: React.FC<HealthStatusCardProps> = ({
  ndvi,
  trend,
  cropType,
  temporalAnalysis,
  isDemo
}) => {
  const health = getHealthStatus(ndvi, cropType);
  const seasonal = getSeasonalContext(cropType);
  
  const getTrendIcon = () => {
    if (!trend) return <Minus className="w-4 h-4" />;
    if (trend > 2) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend < -2) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };
  
  const getTrendDescription = () => {
    if (!trend) return "Trend non disponibile";
    if (trend > 5) return "In forte crescita";
    if (trend > 2) return "In crescita";
    if (trend > -2) return "Stabile";
    if (trend > -5) return "In calo";
    return "In forte calo";
  };

  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4" />
            <span>NDVI - Salute Vegetazione</span>
          </div>
          {isDemo && <Badge variant="secondary" className="text-xs">Demo</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Value */}
        <div className="flex items-baseline justify-between">
          <span className={`text-3xl font-bold ${health.color}`}>
            {ndvi.toFixed(3)}
          </span>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {getTrendIcon()}
            <span>{trend ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%` : '-'}</span>
          </div>
        </div>

        {/* Health Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Stato:</span>
            <Badge variant={health.level === "excellent" || health.level === "good" ? "default" : "destructive"}>
              {health.description}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Trend 30gg:</span>
            <span className={trend && trend > 0 ? "text-green-600" : trend && trend < 0 ? "text-red-600" : "text-gray-600"}>
              {getTrendDescription()}
            </span>
          </div>
        </div>

        {/* Seasonal Context */}
        <Alert className="py-2">
          <AlertDescription className="text-xs">
            <div className="font-medium">Contesto stagionale ({seasonal.season}):</div>
            <div>Fase attesa: {seasonal.expectedPhase}</div>
            <div>NDVI ottimale: {seasonal.optimalNDVI.toFixed(2)} per {cropType}</div>
          </AlertDescription>
        </Alert>

        {/* Temporal Analysis */}
        {temporalAnalysis && (
          <div className="text-xs space-y-1 bg-muted/30 p-2 rounded">
            <div className="font-medium">Analisi temporale:</div>
            <div>Direzione: {
              temporalAnalysis.trendDirection === "improving" ? "📈 Miglioramento" :
              temporalAnalysis.trendDirection === "declining" ? "📉 Peggioramento" :
              "➡️ Stabile"
            }</div>
            <div>Velocità: {
              temporalAnalysis.velocityLevel === "rapid" ? "Rapida" :
              temporalAnalysis.velocityLevel === "moderate" ? "Moderata" : "Lenta"
            }</div>
            {temporalAnalysis.projectedValue7d && (
              <div>Proiezione 7gg: {temporalAnalysis.projectedValue7d.toFixed(3)}</div>
            )}
          </div>
        )}

        {/* Recommendations */}
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Raccomandazioni:</div>
          <div className="space-y-1">
            {health.recommendations.map((rec, idx) => (
              <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="text-primary">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};