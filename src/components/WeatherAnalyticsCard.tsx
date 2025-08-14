import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WeatherData } from "@/lib/eos";
import { analyzeWeatherStress, calculateOptimalGrowthProgress, generateWeatherBasedRecommendations } from "@/lib/weatherAnalysis";
import { Thermometer, Droplets, Wind, Sun, CloudRain, TrendingUp, Calendar, AlertTriangle } from "lucide-react";

interface WeatherAnalyticsCardProps {
  weather: WeatherData;
  cropType: string;
}

export function WeatherAnalyticsCard({ weather, cropType }: WeatherAnalyticsCardProps) {
  const stressAlerts = analyzeWeatherStress(weather, cropType);
  const growthProgress = calculateOptimalGrowthProgress(weather.growing_degree_days, cropType);
  const recommendations = generateWeatherBasedRecommendations(weather, weather.forecast || [], cropType);

  const getStressColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const formatTemperature = (temp: number) => `${temp.toFixed(1)}°C`;
  const formatPrecipitation = (precip: number) => `${precip.toFixed(1)}mm`;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-primary" />
          Analisi Meteorologica Avanzata
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Weather Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-orange-500" />
            <div className="text-sm">
              <div className="font-medium">{formatTemperature(weather.temperature_avg)}</div>
              <div className="text-muted-foreground text-xs">
                {formatTemperature(weather.temperature_min)} - {formatTemperature(weather.temperature_max)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" />
            <div className="text-sm">
              <div className="font-medium">{formatPrecipitation(weather.precipitation_total)}</div>
              <div className="text-muted-foreground text-xs">Precipitazioni</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-gray-500" />
            <div className="text-sm">
              <div className="font-medium">{weather.wind_speed_avg.toFixed(1)} m/s</div>
              <div className="text-muted-foreground text-xs">Max {weather.wind_speed_max.toFixed(1)}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-yellow-500" />
            <div className="text-sm">
              <div className="font-medium">{weather.sunshine_hours.toFixed(1)}h</div>
              <div className="text-muted-foreground text-xs">Sole</div>
            </div>
          </div>
        </div>

        {/* Stress Indicators */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Indicatori di Stress
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Stress Termico</span>
                <span>{weather.heat_stress_index.toFixed(0)}%</span>
              </div>
              <Progress value={weather.heat_stress_index} className="h-2" />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Stress da Freddo</span>
                <span>{weather.cold_stress_index.toFixed(0)}%</span>
              </div>
              <Progress value={weather.cold_stress_index} className="h-2" />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Bilancio Idrico</span>
                <span className={weather.water_balance < 0 ? 'text-red-500' : 'text-green-500'}>
                  {weather.water_balance > 0 ? '+' : ''}{weather.water_balance.toFixed(1)}mm
                </span>
              </div>
              <Progress 
                value={Math.min(100, Math.abs(weather.water_balance))} 
                className="h-2" 
              />
            </div>
          </div>
        </div>

        {/* Growth Progress */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Progresso di Crescita
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Fase Fenologica</span>
              <Badge variant={growthProgress.optimal_timing ? 'default' : 'secondary'}>
                {growthProgress.expected_stage}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Progresso Stagionale</span>
                <span>{growthProgress.progress_percentage.toFixed(1)}%</span>
              </div>
              <Progress value={growthProgress.progress_percentage} className="h-2" />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>GDD Accumulati: {weather.growing_degree_days.toFixed(0)}</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {growthProgress.days_to_maturity} giorni a maturazione
              </span>
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        {stressAlerts.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-destructive">Allerte Attive</h4>
            <div className="space-y-2">
              {stressAlerts.slice(0, 3).map((alert, index) => (
                <Alert key={index} className="border-l-4 border-l-current">
                  <AlertDescription className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{alert.title}</span>
                      <Badge variant={getStressColor(alert.severity) as any}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                    {alert.economic_impact && (
                      <p className="text-xs text-destructive">
                        Perdita stimata: €{alert.economic_impact.toFixed(0)}/ha
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Weather-Based Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Raccomandazioni Meteorologiche</h4>
            <div className="space-y-1">
              {recommendations.slice(0, 5).map((rec, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historical Comparison */}
        {weather.historical_comparison && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-medium">Confronto Storico</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Temperatura vs Normale:</span>
                <span className={`ml-2 font-medium ${
                  weather.historical_comparison.temperature_vs_normal > 0 ? 'text-red-500' : 'text-blue-500'
                }`}>
                  {weather.historical_comparison.temperature_vs_normal > 0 ? '+' : ''}
                  {weather.historical_comparison.temperature_vs_normal.toFixed(1)}°C
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Precipitazioni vs Normale:</span>
                <span className={`ml-2 font-medium ${
                  weather.historical_comparison.precipitation_vs_normal > 0 ? 'text-blue-500' : 'text-red-500'
                }`}>
                  {weather.historical_comparison.precipitation_vs_normal > 0 ? '+' : ''}
                  {weather.historical_comparison.precipitation_vs_normal.toFixed(1)}mm
                </span>
              </div>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Giorni di stress termico:</span>
              <Badge variant="outline" className="ml-2">
                {weather.historical_comparison.stress_days_count}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}