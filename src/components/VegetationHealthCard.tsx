import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Leaf, Droplets, ThermometerSun, Eye, Info } from "lucide-react";
import { VegetationHealthAnalysis } from "@/lib/vegetationHealth";

interface VegetationHealthCardProps {
  analysis: VegetationHealthAnalysis;
  cropType: string;
}

export function VegetationHealthCard({ analysis, cropType }: VegetationHealthCardProps) {
  const getHealthClassColor = (healthClass: VegetationHealthAnalysis['health_class']) => {
    switch (healthClass) {
      case 'excellent': return 'bg-emerald-500';
      case 'good': return 'bg-green-500';
      case 'average': return 'bg-yellow-500';
      case 'below_average': return 'bg-orange-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getHealthClassText = (healthClass: VegetationHealthAnalysis['health_class']) => {
    switch (healthClass) {
      case 'excellent': return 'Eccellente';
      case 'good': return 'Buona';
      case 'average': return 'Media';
      case 'below_average': return 'Sotto Media';
      case 'poor': return 'Scarsa';
      default: return 'N/A';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'declining': return <TrendingDown className="h-3 w-3 text-red-600" />;
      case 'stable': return <span className="h-3 w-3 text-blue-600">→</span>;
      default: return <span className="h-3 w-3 text-gray-400">?</span>;
    }
  };

  const getTrendText = (trend: string) => {
    switch (trend) {
      case 'improving': return 'In Miglioramento';
      case 'declining': return 'In Calo';
      case 'stable': return 'Stabile';
      default: return 'Sconosciuto';
    }
  };

  const getWaterStressColor = (level: string) => {
    switch (level) {
      case 'none': return 'text-green-600';
      case 'mild': return 'text-yellow-600';
      case 'moderate': return 'text-orange-600';
      case 'severe': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getWaterStressText = (level: string) => {
    switch (level) {
      case 'none': return 'Assente';
      case 'mild': return 'Lieve';
      case 'moderate': return 'Moderato';
      case 'severe': return 'Severo';
      default: return 'N/A';
    }
  };

  const getVigorText = (vigor: string) => {
    switch (vigor) {
      case 'high': return 'Alto';
      case 'medium': return 'Medio';
      case 'low': return 'Basso';
      default: return 'N/A';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Leaf className="h-5 w-5" />
            Salute Vegetazione (EOS)
          </span>
          <Badge 
            className={`${getHealthClassColor(analysis.health_class)} text-white`}
            variant="secondary"
          >
            {getHealthClassText(analysis.health_class)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Health Index */}
        <div className="text-center space-y-2">
          <div className="text-3xl font-bold text-primary">
            {analysis.health_index}/100
          </div>
          <div className="text-sm text-muted-foreground">
            Confidenza: {analysis.confidence_level}%
          </div>
          <Progress value={analysis.health_index} className="w-full" />
        </div>

        {/* Technical Indicators from EOS */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Indicatori Tecnici EOS
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>NDVI Corrente</span>
                <span className="font-medium">{analysis.technical_indicators.current_ndvi}</span>
              </div>
              <div className="flex justify-between">
                <span>NDVI Range</span>
                <span className="font-medium text-xs">
                  {analysis.technical_indicators.ndvi_range.min} - {analysis.technical_indicators.ndvi_range.max}
                </span>
              </div>
              <div className="flex justify-between">
                <span>NDVI Medio</span>
                <span className="font-medium">{analysis.technical_indicators.ndvi_range.avg}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>NDMI Corrente</span>
                <span className="font-medium">{analysis.technical_indicators.current_ndmi}</span>
              </div>
              <div className="flex justify-between">
                <span>Vigore Vegetativo</span>
                <span className="font-medium">{getVigorText(analysis.technical_indicators.vegetation_vigor)}</span>
              </div>
              <div className="flex justify-between">
                <span>Stress Idrico</span>
                <span className={`font-medium ${getWaterStressColor(analysis.technical_indicators.water_stress_level)}`}>
                  {getWaterStressText(analysis.technical_indicators.water_stress_level)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* EOS Factors Contribution */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            Contributi Fattori EOS
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">NDVI (Vigoria)</span>
              <span className="text-sm font-medium">{analysis.eos_factors.ndvi_contribution}/100</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">NDMI (Stress Idrico)</span>
              <span className="text-sm font-medium">{analysis.eos_factors.ndmi_contribution}/100</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Meteo</span>
              <span className="text-sm font-medium">{analysis.eos_factors.weather_contribution}/100</span>
            </div>
            {analysis.eos_factors.soil_moisture_contribution && (
              <div className="flex justify-between items-center">
                <span className="text-sm">Umidità Suolo</span>
                <span className="text-sm font-medium">{analysis.eos_factors.soil_moisture_contribution}/100</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm">Tendenza Temporale</span>
              <span className="text-sm font-medium flex items-center gap-1">
                {getTrendIcon(analysis.eos_factors.temporal_trend)}
                {getTrendText(analysis.eos_factors.temporal_trend)}
              </span>
            </div>
          </div>
        </div>

        {/* Data Quality */}
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <ThermometerSun className="h-4 w-4" />
            Qualità Dati
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Osservazioni Satellitari</span>
              <span className="text-sm font-medium">{analysis.eos_factors.data_points} punti</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Fonte Dati</span>
              <span className="text-xs font-medium text-muted-foreground">
                {analysis.meta.data_source}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Analisi del: {new Date(analysis.meta.analysis_date).toLocaleString('it-IT')}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              Raccomandazioni Tecniche
            </h4>
            <ul className="space-y-1">
              {analysis.recommendations.map((rec, index) => (
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