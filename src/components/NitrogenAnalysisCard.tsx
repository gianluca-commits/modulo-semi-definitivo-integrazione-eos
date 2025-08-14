import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Leaf, TrendingUp, AlertTriangle, Euro } from "lucide-react";
import { getNitrogenStatus, getNitrogenAlert, calculateFertilizationROI } from "@/lib/nitrogenAnalysis";

interface NitrogenAnalysisCardProps {
  reci: number;
  previousReci?: number;
  cropType: string;
  expectedYield: number;
  marketPrice: number;
}

export function NitrogenAnalysisCard({ 
  reci, 
  previousReci, 
  cropType, 
  expectedYield, 
  marketPrice 
}: NitrogenAnalysisCardProps) {
  const status = getNitrogenStatus(reci, cropType);
  const alert = getNitrogenAlert(reci, previousReci, cropType);
  const roi = calculateFertilizationROI(status, expectedYield, marketPrice);

  const getSeverityIcon = () => {
    switch (alert.severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "info": return <TrendingUp className="h-4 w-4 text-info" />;
      default: return <Leaf className="h-4 w-4 text-success" />;
    }
  };

  const getProgressValue = () => {
    // Convert ReCI to percentage (0-100) for progress bar
    const maxReCI = 2.5; // Assumed max for visualization
    return Math.min((reci / maxReCI) * 100, 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-primary" />
          Analisi Azoto (ReCI)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ReCI Value and Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Red-edge Chlorophyll Index</span>
            <Badge variant={status.level === "high" ? "default" : status.level === "medium" ? "secondary" : "destructive"}>
              {reci.toFixed(2)}
            </Badge>
          </div>
          <Progress value={getProgressValue()} className="h-2" />
          <p className={`text-sm font-medium ${status.color}`}>
            {status.description}
          </p>
        </div>

        {/* Alert */}
        {alert.severity !== "none" && (
          <Alert className={`border-l-4 ${
            alert.severity === "critical" ? "border-l-destructive" :
            alert.severity === "warning" ? "border-l-warning" :
            "border-l-info"
          }`}>
            <div className="flex items-center gap-2">
              {getSeverityIcon()}
              <AlertDescription className="font-medium">
                {alert.title}
              </AlertDescription>
            </div>
            <AlertDescription className="mt-1">
              {alert.description}
            </AlertDescription>
            <AlertDescription className="mt-2 font-medium text-destructive">
              {alert.economic_impact}
            </AlertDescription>
          </Alert>
        )}

        {/* Fertilization Recommendations */}
        {status.fertilization.needed && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm">Raccomandazioni Fertilizzazione</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Tempistica:</span>
                <p className="font-medium">{status.fertilization.timing}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Quantità:</span>
                <p className="font-medium">{status.fertilization.amount}</p>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-sm">Prodotti consigliati:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {status.fertilization.type.map((type, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Economic Analysis */}
        {roi.cost > 0 && (
          <div className="space-y-2 p-3 bg-primary/5 rounded-lg">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Analisi Economica</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Costo intervento:</span>
                <p className="font-medium">€{roi.cost.toFixed(0)}/ha</p>
              </div>
              <div>
                <span className="text-muted-foreground">Beneficio atteso:</span>
                <p className="font-medium text-success">€{roi.expectedBenefit.toFixed(0)}/ha</p>
              </div>
              <div>
                <span className="text-muted-foreground">ROI:</span>
                <p className={`font-medium ${roi.roi > 1 ? "text-success" : "text-warning"}`}>
                  {(roi.roi * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Recupero:</span>
                <p className="font-medium">{roi.paybackDays.toFixed(0)} giorni</p>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations List */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Raccomandazioni</h4>
          <ul className="space-y-1">
            {status.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}