import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sprout, Calendar, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { PhenologyAnalysis } from "@/lib/phenologyAnalysis";

interface PhenologyCardProps {
  analysis: PhenologyAnalysis;
  cropType: string;
}

export function PhenologyCard({ analysis, cropType }: PhenologyCardProps) {
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high": return "text-green-600";
      case "medium": return "text-yellow-600";
      case "low": return "text-red-600";
      default: return "text-muted-foreground";
    }
  };

  const getStageIcon = () => {
    if (analysis.current_stage.bbch_code < 30) return <Sprout className="w-5 h-5" />;
    if (analysis.current_stage.bbch_code < 60) return <TrendingUp className="w-5 h-5" />;
    return <Calendar className="w-5 h-5" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStageIcon()}
          Analisi Fenologica BBCH
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Stage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Stadio Attuale</h3>
            <Badge variant="secondary">BBCH {analysis.current_stage.bbch_code}</Badge>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium text-foreground mb-2">{analysis.current_stage.stage_name}</h4>
            <p className="text-sm text-muted-foreground mb-3">{analysis.current_stage.description}</p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso stadio</span>
                <span className="font-medium">{analysis.estimated_progress}%</span>
              </div>
              <Progress value={analysis.estimated_progress} className="h-2" />
            </div>
          </div>
        </div>

        {/* Development Metrics */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <span className="text-muted-foreground">Giorni da semina</span>
            <p className="font-medium flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {analysis.days_since_planting}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground">GDD accumulati</span>
            <p className="font-medium">{analysis.gdd_accumulated}°</p>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground">Prossimo stadio in</span>
            <p className="font-medium">{analysis.expected_days_to_next_stage} giorni</p>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground">Affidabilità</span>
            <p className={`font-medium capitalize ${getConfidenceColor(analysis.confidence)}`}>
              {analysis.confidence}
            </p>
          </div>
        </div>

        {/* GDD Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GDD per prossimo stadio</span>
            <span className="font-medium">{analysis.gdd_required_next_stage}°</span>
          </div>
          <Progress 
            value={(analysis.gdd_accumulated / analysis.gdd_required_next_stage) * 100} 
            className="h-2" 
          />
        </div>

        {/* Critical Factors */}
        {analysis.current_stage.critical_factors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">Fattori critici stadio attuale</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.current_stage.critical_factors.map((factor, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        {analysis.alerts.length > 0 && (
          <div className="space-y-2">
            {analysis.alerts.map((alert, index) => (
              <Alert key={index} className="border-orange-200 bg-orange-50">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-orange-800">
                  {alert}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">Raccomandazioni</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {analysis.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Duration Info */}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Durata prevista stadio:</span> {analysis.current_stage.expected_duration_days} giorni
          </p>
        </div>
      </CardContent>
    </Card>
  );
}