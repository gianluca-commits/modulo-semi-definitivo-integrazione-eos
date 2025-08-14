import { WeatherData, WeatherForecast } from './eos';

export interface WeatherStressAlert {
  type: 'heat' | 'cold' | 'drought' | 'excess_water' | 'wind' | 'frost';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  icon: string;
  color: string;
  recommendations: string[];
  economic_impact?: number; // estimated loss in €/ha
  duration_days?: number;
  confidence: number; // 0-100
}

export interface CropWeatherThresholds {
  temperature_optimal_min: number;
  temperature_optimal_max: number;
  temperature_stress_cold: number;
  temperature_stress_heat: number;
  precipitation_min_monthly: number;
  precipitation_max_daily: number;
  humidity_optimal_range: [number, number];
  wind_damage_threshold: number;
  gdd_base: number; // base temperature for GDD calculation
  gdd_required_maturity: number;
}

export const CROP_WEATHER_THRESHOLDS: Record<string, CropWeatherThresholds> = {
  wheat: {
    temperature_optimal_min: 15,
    temperature_optimal_max: 25,
    temperature_stress_cold: 5,
    temperature_stress_heat: 32,
    precipitation_min_monthly: 40,
    precipitation_max_daily: 30,
    humidity_optimal_range: [60, 75],
    wind_damage_threshold: 15,
    gdd_base: 5,
    gdd_required_maturity: 1800
  },
  wine: {
    temperature_optimal_min: 18,
    temperature_optimal_max: 28,
    temperature_stress_cold: 8,
    temperature_stress_heat: 35,
    precipitation_min_monthly: 30,
    precipitation_max_daily: 25,
    humidity_optimal_range: [55, 70],
    wind_damage_threshold: 12,
    gdd_base: 10,
    gdd_required_maturity: 1400
  },
  olive: {
    temperature_optimal_min: 16,
    temperature_optimal_max: 30,
    temperature_stress_cold: 0,
    temperature_stress_heat: 38,
    precipitation_min_monthly: 25,
    precipitation_max_daily: 40,
    humidity_optimal_range: [50, 65],
    wind_damage_threshold: 18,
    gdd_base: 7,
    gdd_required_maturity: 1200
  },
  sunflower: {
    temperature_optimal_min: 20,
    temperature_optimal_max: 30,
    temperature_stress_cold: 10,
    temperature_stress_heat: 35,
    precipitation_min_monthly: 50,
    precipitation_max_daily: 35,
    humidity_optimal_range: [65, 80],
    wind_damage_threshold: 20,
    gdd_base: 8,
    gdd_required_maturity: 1500
  }
};

export function calculateGrowingDegreeDays(
  temperatureMin: number,
  temperatureMax: number,
  baseTemp: number
): number {
  const avgTemp = (temperatureMin + temperatureMax) / 2;
  return Math.max(0, avgTemp - baseTemp);
}

export function calculateHeatStressIndex(
  temperatureMax: number,
  humidity: number,
  cropType: string
): number {
  const thresholds = CROP_WEATHER_THRESHOLDS[cropType];
  if (!thresholds) return 0;

  const tempStress = Math.max(0, temperatureMax - thresholds.temperature_stress_heat);
  const humidityFactor = humidity > thresholds.humidity_optimal_range[1] ? 1.3 : 1.0;
  
  return Math.min(100, (tempStress * humidityFactor * 10));
}

export function calculateColdStressIndex(
  temperatureMin: number,
  cropType: string
): number {
  const thresholds = CROP_WEATHER_THRESHOLDS[cropType];
  if (!thresholds) return 0;

  const coldStress = Math.max(0, thresholds.temperature_stress_cold - temperatureMin);
  return Math.min(100, coldStress * 15);
}

export function analyzeWeatherStress(
  weather: WeatherData,
  cropType: string
): WeatherStressAlert[] {
  const alerts: WeatherStressAlert[] = [];
  const thresholds = CROP_WEATHER_THRESHOLDS[cropType] || CROP_WEATHER_THRESHOLDS.wheat;

  // Heat stress analysis
  if (weather.heat_stress_index > 30) {
    const severity = weather.heat_stress_index > 70 ? 'critical' : 
                    weather.heat_stress_index > 50 ? 'high' : 'medium';
    
    alerts.push({
      type: 'heat',
      severity,
      title: 'Stress Termico Rilevato',
      description: `Temperature elevate (${weather.temperature_max}°C) stanno causando stress alla coltura`,
      icon: 'thermometer',
      color: severity === 'critical' ? 'destructive' : 'warning',
      recommendations: [
        'Aumentare frequenza irrigazione nelle ore serali',
        'Considerare ombreggiamento temporaneo se possibile',
        'Monitorare segni di appassimento fogliare',
        'Evitare trattamenti nelle ore più calde'
      ],
      economic_impact: weather.heat_stress_index * 15, // €/ha estimated loss
      confidence: 85
    });
  }

  // Cold stress analysis
  if (weather.cold_stress_index > 20) {
    const severity = weather.cold_stress_index > 60 ? 'critical' : 
                    weather.cold_stress_index > 40 ? 'high' : 'medium';
    
    alerts.push({
      type: 'cold',
      severity,
      title: 'Stress da Freddo',
      description: `Temperature basse (${weather.temperature_min}°C) possono danneggiare la coltura`,
      icon: 'snowflake',
      color: severity === 'critical' ? 'destructive' : 'secondary',
      recommendations: [
        'Implementare sistemi di protezione antigelo',
        'Considerare irrigazione preventiva',
        'Monitorare previsioni per interventi tempestivi',
        'Valutare coperture temporanee per piante giovani'
      ],
      economic_impact: weather.cold_stress_index * 12,
      confidence: 80
    });
  }

  // Drought stress analysis
  if (weather.water_balance < -30) {
    const severity = weather.water_balance < -60 ? 'critical' : 
                    weather.water_balance < -45 ? 'high' : 'medium';
    
    alerts.push({
      type: 'drought',
      severity,
      title: 'Deficit Idrico',
      description: `Bilancio idrico negativo (${weather.water_balance}mm) indica carenza d'acqua`,
      icon: 'droplets',
      color: severity === 'critical' ? 'destructive' : 'warning',
      recommendations: [
        'Pianificare irrigazione immediata',
        'Ottimizzare efficienza sistema irriguo',
        'Considerare pacciamatura per ridurre evaporazione',
        'Monitorare NDMI per stress idrico precoce'
      ],
      economic_impact: Math.abs(weather.water_balance) * 8,
      confidence: 90
    });
  }

  // Excess water analysis
  if (weather.precipitation_total > thresholds.precipitation_max_daily * 3) {
    alerts.push({
      type: 'excess_water',
      severity: 'medium',
      title: 'Eccesso Idrico',
      description: `Precipitazioni eccessive (${weather.precipitation_total}mm) possono causare problemi`,
      icon: 'cloud-rain',
      color: 'secondary',
      recommendations: [
        'Verificare drenaggio del campo',
        'Monitorare ristagni idrici',
        'Valutare rischio malattie fungine',
        'Pianificare interventi preventivi fitosanitari'
      ],
      economic_impact: weather.precipitation_total * 2,
      confidence: 75
    });
  }

  // Wind stress analysis
  if (weather.wind_speed_max > thresholds.wind_damage_threshold) {
    const severity = weather.wind_speed_max > thresholds.wind_damage_threshold * 1.5 ? 'high' : 'medium';
    
    alerts.push({
      type: 'wind',
      severity,
      title: 'Stress da Vento',
      description: `Venti forti (${weather.wind_speed_max}m/s) possono danneggiare le piante`,
      icon: 'wind',
      color: severity === 'high' ? 'destructive' : 'warning',
      recommendations: [
        'Verificare stabilità delle piante',
        'Controllare sistemi di supporto',
        'Valutare danni meccanici alle foglie',
        'Posticipare trattamenti se vento persiste'
      ],
      economic_impact: weather.wind_speed_max * 5,
      confidence: 70
    });
  }

  return alerts;
}

export function calculateOptimalGrowthProgress(
  gddAccumulated: number,
  cropType: string
): {
  progress_percentage: number;
  expected_stage: string;
  days_to_maturity: number;
  optimal_timing: boolean;
} {
  const thresholds = CROP_WEATHER_THRESHOLDS[cropType] || CROP_WEATHER_THRESHOLDS.wheat;
  const progress = (gddAccumulated / thresholds.gdd_required_maturity) * 100;
  
  let expectedStage = 'Germinazione';
  if (progress > 80) expectedStage = 'Maturazione';
  else if (progress > 60) expectedStage = 'Riempimento granella';
  else if (progress > 40) expectedStage = 'Fioritura';
  else if (progress > 20) expectedStage = 'Accestimento';
  else if (progress > 10) expectedStage = 'Emergenza';

  const remainingGdd = Math.max(0, thresholds.gdd_required_maturity - gddAccumulated);
  const avgDailyGdd = 15; // Estimated average daily GDD
  const daysToMaturity = Math.ceil(remainingGdd / avgDailyGdd);

  // Check if timing is optimal based on season
  const currentMonth = new Date().getMonth() + 1;
  const optimalTiming = cropType === 'wheat' ? 
    (currentMonth >= 10 || currentMonth <= 6) : // winter/spring wheat
    (currentMonth >= 3 && currentMonth <= 9); // summer crops

  return {
    progress_percentage: Math.min(100, progress),
    expected_stage: expectedStage,
    days_to_maturity: daysToMaturity,
    optimal_timing: optimalTiming
  };
}

export function generateWeatherBasedRecommendations(
  weather: WeatherData,
  forecast: WeatherForecast[],
  cropType: string
): string[] {
  const recommendations: string[] = [];
  const alerts = analyzeWeatherStress(weather, cropType);
  
  // Critical alerts first
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  if (criticalAlerts.length > 0) {
    recommendations.push('🚨 INTERVENTO URGENTE RICHIESTO:');
    criticalAlerts.forEach(alert => {
      recommendations.push(...alert.recommendations.slice(0, 2));
    });
  }

  // Forecast-based recommendations
  if (forecast.length > 0) {
    const nextDaysStress = forecast.slice(0, 3).filter(f => f.stress_probability > 60);
    if (nextDaysStress.length > 0) {
      recommendations.push('📅 Prossimi giorni critici - prepararsi:');
      recommendations.push('Verificare sistemi irrigazione/protezione');
      recommendations.push('Pianificare interventi preventivi');
    }

    const rainyDays = forecast.slice(0, 7).filter(f => f.precipitation > 5);
    if (rainyDays.length > 3) {
      recommendations.push('🌧️ Periodo piovoso in arrivo:');
      recommendations.push('Posticipare trattamenti fitosanitari');
      recommendations.push('Verificare drenaggio del campo');
    }
  }

  // General optimization recommendations
  if (weather.water_balance > -10 && weather.water_balance < 10) {
    recommendations.push('💧 Bilancio idrico equilibrato - ottimizzare:');
    recommendations.push('Mantenere regime irriguo attuale');
    recommendations.push('Monitorare evoluzione NDMI');
  }

  return recommendations.slice(0, 8); // Limit to most important
}