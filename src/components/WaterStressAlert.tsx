import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Droplets, AlertTriangle, Clock, ThermometerSun } from "lucide-react";
import { getWaterStressAlert, getIrrigationRecommendation, TemporalAnalysis } from "@/lib/eosAnalysis";
import { EosSummary } from "@/lib/eos";

interface WaterStressAlertProps {
  ndmi: number;
  trend?: number;
  cropType: string;
  summary: EosSummary;
  temporalAnalysis?: TemporalAnalysis | null;
  onIrrigationPlan?: () => void;
}

export const WaterStressAlert: React.FC<WaterStressAlertProps> = ({
  ndmi,
  trend,
  cropType,
  summary,
  temporalAnalysis,
  onIrrigationPlan
}) => {
  const waterStress = getWaterStressAlert(ndmi, trend, cropType);
  const irrigation = getIrrigationRecommendation(summary, cropType);
  
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "immediate": return "bg-red-100 border-red-500";
      case "high": return "bg-orange-100 border-orange-500";
      case "medium": return "bg-yellow-100 border-yellow-500";
      case "low": return "bg-blue-100 border-blue-500";
      default: return "bg-green-100 border-green-500";
    }
  };

  const getUrgencyVariant = (urgency: string) => {
    switch (urgency) {
      case "immediate":
      case "high":
        return "destructive" as const;
      case "medium":
        return "default" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="w-4 h-4" />
          <span>NDMI - Stress Idrico</span>
          <Badge variant={getUrgencyVariant(irrigation.urgency)} className="ml-auto">
            {waterStress.icon} {waterStress.title}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Value */}
        <div className="flex items-baseline justify-between">
          <span className={`text-3xl font-bold ${waterStress.color}`}>
            {ndmi.toFixed(3)}
          </span>
          <div className="text-sm text-muted-foreground">
            <div>Soglia critica: {summary.ndmi_data.critical_threshold.toFixed(2)}</div>
            {trend && (
              <div>Trend 14gg: {trend > 0 ? '+' : ''}{trend.toFixed(1)}%</div>
            )}
          </div>
        </div>

        {/* Stress Level Description */}
        <Alert className={`py-2 ${getUrgencyColor(irrigation.urgency)}`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">
            {waterStress.title}
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {waterStress.description}
          </AlertDescription>
        </Alert>

        {/* Irrigation Recommendations */}
        {irrigation.urgency !== "none" && (
          <div className="space-y-3 bg-muted/30 p-3 rounded">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Raccomandazioni Irrigazione</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Tempistica:</div>
                <div className="font-medium">{irrigation.timing}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Quantità:</div>
                <div className="font-medium">{irrigation.amount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Frequenza:</div>
                <div className="font-medium">{irrigation.frequency}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Urgenza:</div>
                <Badge variant={getUrgencyVariant(irrigation.urgency)} className="text-xs">
                  {irrigation.urgency}
                </Badge>
              </div>
            </div>

            {/* Reasoning */}
            <div className="space-y-1">
              <div className="text-xs font-medium">Motivazioni:</div>
              {irrigation.reasoning.map((reason, idx) => (
                <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span className="text-primary">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>

            {/* Weather Considerations */}
            {irrigation.weatherConsiderations.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium flex items-center gap-1">
                  <ThermometerSun className="w-3 h-3" />
                  Fattori meteorologici:
                </div>
                {irrigation.weatherConsiderations.map((factor, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-orange-500">⚠</span>
                    <span>{factor}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action Button */}
            {onIrrigationPlan && (irrigation.urgency === "immediate" || irrigation.urgency === "high" || irrigation.urgency === "medium" || irrigation.urgency === "low") && (
              <Button 
                size="sm" 
                variant={irrigation.urgency === "immediate" || irrigation.urgency === "high" ? "destructive" : "default"}
                onClick={onIrrigationPlan}
                className="w-full"
              >
                Pianifica Irrigazione
              </Button>
            )}
          </div>
        )}

        {/* Temporal Analysis for NDMI */}
        {temporalAnalysis && (
          <div className="text-xs space-y-1 bg-muted/20 p-2 rounded border">
            <div className="font-medium">Analisi trend NDMI:</div>
            {temporalAnalysis.trendDirection === "declining" && temporalAnalysis.velocityLevel === "rapid" && (
              <Alert variant="destructive" className="py-1">
                <AlertDescription className="text-xs">
                  🚨 Calo rapido NDMI rilevato - monitoraggio intensivo raccomandato
                </AlertDescription>
              </Alert>
            )}
            <div>Velocità cambiamento: {temporalAnalysis.velocityLevel}</div>
            <div>Confidenza previsione: {temporalAnalysis.confidence}%</div>
          </div>
        )}

        {/* Action Items */}
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Azioni immediate:</div>
          <div className="space-y-1">
            {waterStress.actions.map((action, idx) => (
              <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="text-primary">•</span>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};