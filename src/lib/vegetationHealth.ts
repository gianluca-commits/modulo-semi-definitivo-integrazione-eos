import { VegetationPoint } from './eos';
import { EosSummary } from './eos';

export interface VegetationHealthAnalysis {
  health_index: number; // 0-100 composite score
  confidence_level: number; // 0-100%
  health_class: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  eos_factors: {
    ndvi_contribution: number; // 0-100 score
    ndmi_contribution: number; // 0-100 score  
    weather_contribution: number; // 0-100 score
    soil_moisture_contribution?: number; // 0-100 score if available
    temporal_trend: 'improving' | 'stable' | 'declining' | 'unknown';
    data_points: number;
  };
  technical_indicators: {
    current_ndvi: number;
    ndvi_range: { min: number; max: number; avg: number };
    current_ndmi: number;
    water_stress_level: 'none' | 'mild' | 'moderate' | 'severe';
    vegetation_vigor: 'high' | 'medium' | 'low';
  };
  recommendations: string[];
  meta: {
    crop_type: string;
    analysis_date: string;
    data_source: string;
    time_series_length: number;
  };
}

export function analyzeVegetationHealth(
  eosData: EosSummary,
  cropType: string,
  timeSeries: VegetationPoint[]
): VegetationHealthAnalysis {
  
  // Calculate NDVI statistics from time series
  const ndviValues = timeSeries.map(p => p.NDVI);
  const currentNDVI = eosData.ndvi_data.current_value;
  const avgNDVI = ndviValues.length > 0 
    ? ndviValues.reduce((sum, val) => sum + val, 0) / ndviValues.length 
    : currentNDVI;
  const maxNDVI = ndviValues.length > 0 ? Math.max(...ndviValues) : currentNDVI;
  const minNDVI = ndviValues.length > 0 ? Math.min(...ndviValues) : currentNDVI;

  // NDVI contribution score (based on peak and current values)
  let ndviScore = 0;
  if (currentNDVI >= 0.8) ndviScore = 95;
  else if (currentNDVI >= 0.7) ndviScore = 80;
  else if (currentNDVI >= 0.6) ndviScore = 65;
  else if (currentNDVI >= 0.5) ndviScore = 50;
  else if (currentNDVI >= 0.4) ndviScore = 35;
  else if (currentNDVI >= 0.3) ndviScore = 20;
  else ndviScore = 10;

  // NDMI contribution score (water stress indicator)
  const currentNDMI = eosData.ndmi_data.current_value;
  let ndmiScore = 0;
  let waterStressLevel: 'none' | 'mild' | 'moderate' | 'severe' = 'none';
  
  if (currentNDMI >= 0.5) {
    ndmiScore = 90;
    waterStressLevel = 'none';
  } else if (currentNDMI >= 0.4) {
    ndmiScore = 75;
    waterStressLevel = 'mild';
  } else if (currentNDMI >= 0.3) {
    ndmiScore = 55;
    waterStressLevel = 'moderate';
  } else if (currentNDMI >= 0.2) {
    ndmiScore = 35;
    waterStressLevel = 'moderate';
  } else {
    ndmiScore = 15;
    waterStressLevel = 'severe';
  }

  // Weather contribution score
  let weatherScore = 75; // Base score
  const weatherRisks = eosData.weather_risks;
  
  // Temperature stress penalty
  if (weatherRisks.temperature_stress_days > 15) weatherScore -= 25;
  else if (weatherRisks.temperature_stress_days > 10) weatherScore -= 15;
  else if (weatherRisks.temperature_stress_days > 5) weatherScore -= 8;
  
  // Precipitation deficit penalty
  if (weatherRisks.precipitation_deficit_mm > 75) weatherScore -= 20;
  else if (weatherRisks.precipitation_deficit_mm > 50) weatherScore -= 12;
  else if (weatherRisks.precipitation_deficit_mm > 25) weatherScore -= 6;
  
  // Heat stress penalty
  if (weatherRisks.heat_stress_risk === 'high') weatherScore -= 15;
  else if (weatherRisks.heat_stress_risk === 'medium') weatherScore -= 8;
  
  // Frost risk penalty
  if (weatherRisks.frost_risk_forecast_7d) weatherScore -= 10;

  weatherScore = Math.max(5, Math.min(100, weatherScore));

  // Soil moisture contribution (if available)
  let soilMoistureScore: number | undefined;
  if (eosData.soil_moisture) {
    const sm = eosData.soil_moisture;
    soilMoistureScore = 50; // Base score
    
    // Root zone moisture impact
    const moistureRatio = sm.root_zone_moisture / sm.field_capacity;
    if (moistureRatio >= 0.8) soilMoistureScore = 95;
    else if (moistureRatio >= 0.6) soilMoistureScore = 80;
    else if (moistureRatio >= 0.4) soilMoistureScore = 60;
    else if (moistureRatio >= 0.2) soilMoistureScore = 35;
    else soilMoistureScore = 15;
    
    // Water deficit adjustment
    if (sm.water_deficit > 10) soilMoistureScore -= 15;
    else if (sm.water_deficit > 5) soilMoistureScore -= 8;
    
    soilMoistureScore = Math.max(5, Math.min(100, soilMoistureScore));
  }

  // Calculate composite health index
  let healthIndex: number;
  if (soilMoistureScore !== undefined) {
    // With soil moisture: 35% NDVI, 25% NDMI, 25% Weather, 15% Soil Moisture
    healthIndex = (ndviScore * 0.35) + (ndmiScore * 0.25) + (weatherScore * 0.25) + (soilMoistureScore * 0.15);
  } else {
    // Without soil moisture: 45% NDVI, 30% NDMI, 25% Weather
    healthIndex = (ndviScore * 0.45) + (ndmiScore * 0.30) + (weatherScore * 0.25);
  }

  // Determine health class
  let healthClass: VegetationHealthAnalysis['health_class'];
  if (healthIndex >= 80) healthClass = 'excellent';
  else if (healthIndex >= 65) healthClass = 'good';
  else if (healthIndex >= 50) healthClass = 'average';
  else if (healthIndex >= 35) healthClass = 'below_average';
  else healthClass = 'poor';

  // Determine vegetation vigor
  let vegetationVigor: 'high' | 'medium' | 'low';
  if (avgNDVI >= 0.7) vegetationVigor = 'high';
  else if (avgNDVI >= 0.5) vegetationVigor = 'medium';
  else vegetationVigor = 'low';

  // Analyze temporal trend
  let temporalTrend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';
  if (timeSeries.length >= 3) {
    const recent = timeSeries.slice(-3).map(p => p.NDVI);
    const older = timeSeries.slice(0, -3).map(p => p.NDVI);
    
    if (older.length > 0) {
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
      
      const diff = recentAvg - olderAvg;
      if (diff > 0.05) temporalTrend = 'improving';
      else if (diff < -0.05) temporalTrend = 'declining';
      else temporalTrend = 'stable';
    }
  }

  // Calculate confidence level
  let confidence = 70; // Base confidence
  
  // More data points increase confidence
  if (timeSeries.length >= 8) confidence += 20;
  else if (timeSeries.length >= 5) confidence += 15;
  else if (timeSeries.length >= 3) confidence += 10;
  else if (timeSeries.length >= 1) confidence += 5;
  
  // Quality of current readings
  if (currentNDVI > 0.1) confidence += 5;
  if (currentNDMI > 0.1) confidence += 5;
  
  // Soil moisture data availability
  if (eosData.soil_moisture) confidence += 10;
  
  confidence = Math.max(40, Math.min(95, confidence));

  // Generate technical recommendations
  const recommendations: string[] = [];
  
  // Water stress recommendations
  if (waterStressLevel === 'severe') {
    recommendations.push("🚨 Stress idrico severo: irrigazione urgente necessaria");
  } else if (waterStressLevel === 'moderate') {
    recommendations.push("💧 Stress idrico moderato: aumentare frequenza irrigazione");
  }
  
  // Soil moisture specific recommendations
  if (eosData.soil_moisture) {
    const sm = eosData.soil_moisture;
    if (sm.irrigation_recommendation?.timing === "immediate") {
      recommendations.push(`💧 EOS raccomanda irrigazione immediata: ${sm.irrigation_recommendation.volume_mm}mm`);
    } else if (sm.irrigation_recommendation?.timing === "within_3_days") {
      recommendations.push(`📅 EOS suggerisce irrigazione entro 3 giorni: ${sm.irrigation_recommendation.volume_mm}mm`);
    }
  }
  
  // NDVI-based recommendations
  if (currentNDVI < 0.4) {
    recommendations.push("🌱 NDVI basso: verificare nutrizione e gestione delle infestanti");
  } else if (currentNDVI < 0.6) {
    recommendations.push("📈 NDVI sotto-ottimale: considerare fertilizzazione azotata");
  }
  
  // Weather-based recommendations
  if (weatherRisks.temperature_stress_days > 10) {
    recommendations.push("🌡️ Stress termico rilevato: monitorare e proteggere la coltura");
  }
  
  if (weatherRisks.precipitation_deficit_mm > 50) {
    recommendations.push("☔ Deficit pluviometrico significativo: programmare irrigazione supplementare");
  }
  
  // Temporal trend recommendations
  if (temporalTrend === 'declining') {
    recommendations.push("📉 Tendenza NDVI in calo: investigare cause e intervenire rapidamente");
  } else if (temporalTrend === 'improving') {
    recommendations.push("📈 Tendenza NDVI positiva: mantenere pratiche attuali");
  }

  return {
    health_index: Number(healthIndex.toFixed(1)),
    confidence_level: confidence,
    health_class: healthClass,
    eos_factors: {
      ndvi_contribution: Number(ndviScore.toFixed(1)),
      ndmi_contribution: Number(ndmiScore.toFixed(1)),
      weather_contribution: Number(weatherScore.toFixed(1)),
      soil_moisture_contribution: soilMoistureScore ? Number(soilMoistureScore.toFixed(1)) : undefined,
      temporal_trend: temporalTrend,
      data_points: timeSeries.length
    },
    technical_indicators: {
      current_ndvi: Number(currentNDVI.toFixed(3)),
      ndvi_range: {
        min: Number(minNDVI.toFixed(3)),
        max: Number(maxNDVI.toFixed(3)),
        avg: Number(avgNDVI.toFixed(3))
      },
      current_ndmi: Number(currentNDMI.toFixed(3)),
      water_stress_level: waterStressLevel,
      vegetation_vigor: vegetationVigor
    },
    recommendations,
    meta: {
      crop_type: cropType,
      analysis_date: new Date().toISOString(),
      data_source: "EOS Data Analytics + Technical Analysis",
      time_series_length: timeSeries.length
    }
  };
}