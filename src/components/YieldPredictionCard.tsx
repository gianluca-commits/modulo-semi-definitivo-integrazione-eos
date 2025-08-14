import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle } from "lucide-react";
import { YieldPrediction } from "@/lib/yieldPrediction";

interface YieldPredictionCardProps {
  prediction: YieldPrediction;
  cropType: string;
}

export function YieldPredictionCard({ prediction, cropType }: YieldPredictionCardProps) {
  const getYieldClassColor = (yieldClass: YieldPrediction['yield_class']) => {
    switch (yieldClass) {
      case 'excellent': return 'bg-emerald-500';
      case 'good': return 'bg-green-500';
      case 'average': return 'bg-yellow-500';
      case 'below_average': return 'bg-orange-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getYieldClassText = (yieldClass: YieldPrediction['yield_class']) => {
    switch (yieldClass) {
      case 'excellent': return 'Eccellente';
      case 'good': return 'Buona';
      case 'average': return 'Media';
      case 'below_average': return 'Sotto la media';
      case 'poor': return 'Scarsa';
      default: return 'N/A';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0 
    }).format(value);
  };

  const isProfitable = prediction.economic_projection.net_profit_eur_ha > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Predizione Resa
          </span>
          <Badge 
            className={`${getYieldClassColor(prediction.yield_class)} text-white`}
            variant="secondary"
          >
            {getYieldClassText(prediction.yield_class)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Prediction */}
        <div className="text-center space-y-2">
          <div className="text-3xl font-bold text-primary">
            {prediction.predicted_yield_ton_ha} t/ha
          </div>
          <div className="text-sm text-muted-foreground">
            Confidenza: {prediction.confidence_level}%
          </div>
          <Progress value={prediction.confidence_level} className="w-full" />
        </div>

        {/* Contributing Factors */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Fattori Contributivi</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">NDVI (Vigoria)</span>
              <span className="text-sm font-medium">{prediction.factors.ndvi_contribution}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">NDMI (Stress Idrico)</span>
              <span className="text-sm font-medium">{prediction.factors.ndmi_contribution}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Impatto Meteo</span>
              <span className="text-sm font-medium">{prediction.factors.weather_impact}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Aggiustamento Stagionale</span>
              <span className="text-sm font-medium">{prediction.factors.seasonal_adjustment}%</span>
            </div>
          </div>
        </div>

        {/* Historical Comparison */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Confronto Storico</h4>
          <div className="flex justify-between items-center">
            <span className="text-sm">vs Media Campo</span>
            <span className={`text-sm font-medium flex items-center gap-1 ${
              prediction.historical_comparison.vs_field_average >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {prediction.historical_comparison.vs_field_average >= 0 ? 
                <TrendingUp className="h-3 w-3" /> : 
                <TrendingDown className="h-3 w-3" />
              }
              {Math.abs(prediction.historical_comparison.vs_field_average)}%
            </span>
          </div>
        </div>

        {/* Economic Projection */}
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Proiezione Economica
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Ricavi Attesi</span>
              <span className="text-sm font-medium">
                {formatCurrency(prediction.economic_projection.expected_revenue_eur_ha)}/ha
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Costi Produzione</span>
              <span className="text-sm font-medium">
                {formatCurrency(prediction.economic_projection.production_cost_eur_ha)}/ha
              </span>
            </div>
            <div className="flex justify-between items-center border-t pt-2">
              <span className="text-sm font-medium">Profitto Netto</span>
              <span className={`text-sm font-bold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(prediction.economic_projection.net_profit_eur_ha)}/ha
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Prezzo mercato: {formatCurrency(prediction.economic_projection.market_price_eur_ton)}/t
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {prediction.recommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Raccomandazioni
            </h4>
            <ul className="space-y-1">
              {prediction.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}