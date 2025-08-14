import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Droplets, TrendingDown, TrendingUp, AlertTriangle, Info, Calendar, Target } from "lucide-react";
import { SoilMoistureData } from "@/lib/eos";

interface SoilMoistureAnalyticsCardProps {
  soilMoisture: SoilMoistureData;
  cropType: string;
  onIrrigationPlan?: () => void;
}

export function SoilMoistureAnalyticsCard({ 
  soilMoisture, 
  cropType, 
  onIrrigationPlan 
}: SoilMoistureAnalyticsCardProps) {
  const getStressColor = (level: string) => {
    switch (level) {
      case "none": return "text-green-600";
      case "mild": return "text-yellow-600";
      case "moderate": return "text-orange-600";
      case "severe": return "text-red-600";
      default: return "text-muted-foreground";
    }
  };

  const getStressVariant = (level: string) => {
    switch (level) {
      case "none": return "default";
      case "mild": return "secondary";
      case "moderate": return "outline";
      case "severe": return "destructive";
      default: return "outline";
    }
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 80) return "text-green-600";
    if (percentile >= 60) return "text-blue-600";
    if (percentile >= 40) return "text-yellow-600";
    if (percentile >= 20) return "text-orange-600";
    return "text-red-600";
  };

  const getSMIDescription = (smi: number) => {
    if (smi > 2) return "Estremamente umido";
    if (smi > 1) return "Molto umido";
    if (smi > 0.5) return "Sopra la norma";
    if (smi > -0.5) return "Normale";
    if (smi > -1) return "Sotto la norma";
    if (smi > -2) return "Secco";
    return "Estremamente secco";
  };

  const getIrrigationColor = (timing?: string) => {
    switch (timing) {
      case "immediate": return "text-red-600";
      case "within_3_days": return "text-orange-600";
      case "within_week": return "text-yellow-600";
      case "not_needed": return "text-green-600";
      default: return "text-muted-foreground";
    }
  };

  const formatTiming = (timing?: string) => {
    switch (timing) {
      case "immediate": return "IMMEDIATA";
      case "within_3_days": return "Entro 3 giorni";
      case "within_week": return "Entro 7 giorni";
      case "not_needed": return "Non necessaria";
      default: return "Non determinata";
    }
  };

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-600" />
              Analisi Umidità Suolo
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Dati EOS Soil Moisture Analytics: umidità superficiale (0-7cm), 
                  zona radicale (fino a 70cm), indice SMI standardizzato e 
                  raccomandazioni irrigazione precision agriculture
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Current Moisture Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Superficie (0-7cm)</span>
                <span className="text-sm font-bold">{soilMoisture.surface_moisture.toFixed(1)}%</span>
              </div>
              <Progress 
                value={soilMoisture.surface_moisture} 
                className="h-2"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Zona Radicale</span>
                <span className="text-sm font-bold">{soilMoisture.root_zone_moisture.toFixed(1)}%</span>
              </div>
              <Progress 
                value={soilMoisture.root_zone_moisture} 
                className="h-2"
              />
            </div>
          </div>

          {/* Stress Level & SMI */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">Stress Idrico</span>
              <Badge 
                variant={getStressVariant(soilMoisture.drought_stress_level)}
                className={getStressColor(soilMoisture.drought_stress_level)}
              >
                {soilMoisture.drought_stress_level === "none" ? "Nessuno" :
                 soilMoisture.drought_stress_level === "mild" ? "Lieve" :
                 soilMoisture.drought_stress_level === "moderate" ? "Moderato" : "Severo"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger className="text-sm font-medium cursor-help">
                  SMI: {soilMoisture.soil_moisture_index.toFixed(2)}
                </TooltipTrigger>
                <TooltipContent>
                  <p>Soil Moisture Index standardizzato (-3 a +3)</p>
                  <p>Compara l'umidità attuale con i dati storici di 20+ anni</p>
                </TooltipContent>
              </Tooltip>
              <p className="text-xs text-muted-foreground">
                {getSMIDescription(soilMoisture.soil_moisture_index)}
              </p>
            </div>
          </div>

          {/* Evapotranspiration & Water Balance */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold">Bilancio Idrico</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">ET Attuale</p>
                <p className="text-sm font-bold">{soilMoisture.evapotranspiration_actual.toFixed(1)} mm/g</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ET Potenziale</p>
                <p className="text-sm font-bold">{soilMoisture.evapotranspiration_potential.toFixed(1)} mm/g</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deficit Idrico</p>
                <p className={`text-sm font-bold ${
                  soilMoisture.water_deficit > 3 ? "text-red-600" : 
                  soilMoisture.water_deficit > 1 ? "text-orange-600" : "text-green-600"
                }`}>
                  {soilMoisture.water_deficit.toFixed(1)} mm/g
                </p>
              </div>
            </div>
          </div>

          {/* Historical Context */}
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-sm font-medium">Percentile Storico</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${getPercentileColor(soilMoisture.historical_percentile)}`}>
                {soilMoisture.historical_percentile.toFixed(0)}°
              </span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Percentile vs dati storici 20+ anni EOS</p>
                  <p>100° = estremamente umido, 0° = estremamente secco</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Irrigation Recommendation */}
          {soilMoisture.irrigation_recommendation && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  Raccomandazione Irrigazione
                </h4>
                <Badge variant="outline" className={getIrrigationColor(soilMoisture.irrigation_recommendation.timing)}>
                  {soilMoisture.irrigation_recommendation.priority.toUpperCase()}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Timing</p>
                  <p className={`text-sm font-bold ${getIrrigationColor(soilMoisture.irrigation_recommendation.timing)}`}>
                    {formatTiming(soilMoisture.irrigation_recommendation.timing)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Volume Raccomandato</p>
                  <p className="text-sm font-bold text-blue-600">
                    {soilMoisture.irrigation_recommendation.volume_mm} mm
                  </p>
                </div>
              </div>

              {onIrrigationPlan && (
                <Button 
                  onClick={onIrrigationPlan} 
                  size="sm" 
                  className="w-full"
                  variant={soilMoisture.irrigation_recommendation.timing === "immediate" ? "destructive" : "default"}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Pianifica Irrigazione
                </Button>
              )}
            </div>
          )}

          {/* 7-Day Forecast Preview */}
          {soilMoisture.forecast_7d.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Previsioni 7 Giorni</h4>
              <div className="grid grid-cols-7 gap-1">
                {soilMoisture.forecast_7d.slice(0, 7).map((forecast, index) => (
                  <div key={index} className="text-center p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">
                      {new Date(forecast.date).toLocaleDateString('it-IT', { weekday: 'short' })}
                    </p>
                    <div className="mt-1">
                      {forecast.irrigation_need ? (
                        <Droplets className="w-3 h-3 text-red-500 mx-auto" />
                      ) : (
                        <div className="w-3 h-3 bg-green-500 rounded-full mx-auto" />
                      )}
                    </div>
                    <p className="text-xs mt-1">{forecast.stress_probability}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crop-Specific Insights */}
          <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
            <p className="font-medium mb-1">💡 Insight per {cropType}:</p>
            <ul className="space-y-1">
              <li>• Capacità campo: {soilMoisture.field_capacity}% - Punto di appassimento: {soilMoisture.wilting_point}%</li>
              <li>• Acqua disponibile: {soilMoisture.available_water_content.toFixed(1)}%</li>
              {soilMoisture.water_deficit > 3 && (
                <li className="text-orange-600">• ⚠️ Alto deficit idrico: considerare irrigazione supplementare</li>
              )}
              {soilMoisture.historical_percentile < 20 && (
                <li className="text-red-600">• 🚨 Condizioni estremamente secche vs media storica</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}