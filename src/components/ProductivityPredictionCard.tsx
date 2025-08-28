import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Minus, Target, AlertTriangle } from "lucide-react";
import { VegetationPoint, WeatherData } from "@/lib/eos";
import { generateProductivityPrediction, ProductivityPrediction } from "@/lib/productivityPrediction";

interface ProductivityPredictionCardProps {
  province: string;
  cropType: string;
  timeSeries: VegetationPoint[];
  weather: WeatherData | null;
  area: number;
}

export const ProductivityPredictionCard: React.FC<ProductivityPredictionCardProps> = ({
  province,
  cropType,
  timeSeries,
  weather,
  area
}) => {
  const [prediction, setPrediction] = useState<ProductivityPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPrediction = async () => {
      if (!province || !cropType) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const result = await generateProductivityPrediction(
          province,
          cropType,
          timeSeries,
          weather
        );
        setPrediction(result);
      } catch (err) {
        console.error('Error generating prediction:', err);
        setError('Impossibile generare la previsione');
      } finally {
        setLoading(false);
      }
    };

    loadPrediction();
  }, [province, cropType, timeSeries, weather]);

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return 'text-green-600';
      case 'decreasing':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Previsione Produttività
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Calcolando previsione...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !prediction) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Previsione Produttività
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="w-4 h-4" />
            {error || 'Dati insufficienti per la previsione'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalProduction = prediction.predicted_productivity_qt_ha * area;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Previsione Produttività - {province}
        </CardTitle>
        <CardDescription>
          Analisi predittiva per {cropType} basata su dati storici e satellitari
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Prediction */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center p-4 border border-border rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {prediction.predicted_productivity_qt_ha}
            </div>
            <div className="text-sm text-muted-foreground">q/ha previsti</div>
          </div>
          <div className="text-center p-4 border border-border rounded-lg">
            <div className="text-2xl font-bold text-secondary-foreground">
              {Math.round(totalProduction)}
            </div>
            <div className="text-sm text-muted-foreground">q totali ({area} ha)</div>
          </div>
          <div className="text-center p-4 border border-border rounded-lg">
            <Badge className={`${getConfidenceColor(prediction.confidence_level)}`}>
              Affidabilità {prediction.confidence_level}%
            </Badge>
          </div>
        </div>

        {/* Historical Baseline */}
        <div>
          <h4 className="font-semibold mb-3">Baseline Storica</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Media storica:</span>
              <span className="font-medium">{prediction.baseline.historical_average} q/ha</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Anni di dati:</span>
              <span className="font-medium">{prediction.baseline.years_of_data}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Trend:</span>
              <div className="flex items-center gap-1">
                {getTrendIcon(prediction.baseline.trend_direction)}
                <span className={`font-medium ${getTrendColor(prediction.baseline.trend_direction)}`}>
                  {prediction.baseline.trend_percentage > 0 ? '+' : ''}{prediction.baseline.trend_percentage}%/anno
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Satellite Adjustments */}
        <div>
          <h4 className="font-semibold mb-3">Correzioni Satellitari</h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">NDVI:</span>
              <span className="font-medium">{prediction.satellite_adjustments.ndvi_factor.toFixed(2)}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">NDMI:</span>
              <span className="font-medium">{prediction.satellite_adjustments.ndmi_factor.toFixed(2)}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Meteo:</span>
              <span className="font-medium">{prediction.satellite_adjustments.weather_factor.toFixed(2)}x</span>
            </div>
          </div>
          <div className="mt-2 flex justify-between items-center">
            <span className="text-muted-foreground">Correzione totale:</span>
            <Badge variant={prediction.satellite_adjustments.combined_adjustment >= 0 ? 'default' : 'destructive'}>
              {prediction.satellite_adjustments.combined_adjustment > 0 ? '+' : ''}{prediction.satellite_adjustments.combined_adjustment.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* Risk Factors */}
        {prediction.risk_factors.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Fattori di Rischio</h4>
            <div className="space-y-2">
              {prediction.risk_factors.slice(0, 3).map((risk, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 border border-border rounded">
                  <span>{risk.factor}</span>
                  <Badge variant={risk.impact === 'positive' ? 'default' : risk.impact === 'negative' ? 'destructive' : 'secondary'}>
                    {risk.impact === 'positive' ? '+' : risk.impact === 'negative' ? '-' : ''}{risk.magnitude}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comparison */}
        <div>
          <h4 className="font-semibold mb-3">Confronto</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">vs Media regionale:</span>
              <Badge variant={prediction.comparison.vs_regional_average >= 0 ? 'default' : 'outline'}>
                {prediction.comparison.vs_regional_average > 0 ? '+' : ''}{prediction.comparison.vs_regional_average}%
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">vs Anno precedente:</span>
              <Badge variant={prediction.comparison.vs_last_year >= 0 ? 'default' : 'outline'}>
                {prediction.comparison.vs_last_year > 0 ? '+' : ''}{prediction.comparison.vs_last_year}%
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Percentile:</span>
              <span className="font-medium">{prediction.comparison.percentile_rank}°</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};