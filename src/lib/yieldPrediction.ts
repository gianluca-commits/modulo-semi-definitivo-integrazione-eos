import { VegetationPoint } from './eos';
import { EosSummary } from './eos';

export interface YieldPrediction {
  predicted_yield_ton_ha: number;
  confidence_level: number; // 0-100%
  yield_class: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  factors: {
    ndvi_impact: number; // percentage
    ndmi_impact: number; // percentage
    weather_impact: number; // percentage
    seasonal_adjustment: number; // percentage
    soil_moisture_impact?: number; // percentage
    data_points: number;
  };
  historical_comparison: {
    vs_average: number; // percentage difference
  };
  economic_projection: {
    expected_revenue_eur_ha: number;
    market_price_eur_ton: number;
    production_cost_eur_ha: number;
    net_profit_eur_ha: number;
  };
  recommendations: string[];
  meta: {
    crop_type: string;
    analysis_date: string;
    data_source: string;
    time_series_length: number;
  };
}

// Historical yield database by crop type (ton/ha)
const HISTORICAL_YIELDS = {
  wheat: { average: 5.8, excellent: 8.5, poor: 3.2 },
  corn: { average: 11.2, excellent: 16.0, poor: 6.5 },
  barley: { average: 4.9, excellent: 7.2, poor: 2.8 },
  rice: { average: 6.7, excellent: 9.8, poor: 4.1 },
  soybean: { average: 3.1, excellent: 4.5, poor: 1.8 },
  sunflower: { average: 2.8, excellent: 4.0, poor: 1.5 },
  rapeseed: { average: 3.2, excellent: 4.8, poor: 1.9 },
  wine: { average: 12.5, excellent: 18.0, poor: 7.0 }, // grapes
  olive: { average: 4.2, excellent: 6.5, poor: 2.0 }, // olives
} as const;

// Market prices (EUR/ton) - simplified static data
const MARKET_PRICES = {
  wheat: 250,
  corn: 220,
  barley: 230,
  rice: 580,
  soybean: 450,
  sunflower: 420,
  rapeseed: 480,
  wine: 800, // grapes for wine
  olive: 3200, // olive oil equivalent
} as const;

// Production costs (EUR/ha) - simplified estimates
const PRODUCTION_COSTS = {
  wheat: 800,
  corn: 1200,
  barley: 750,
  rice: 1500,
  soybean: 650,
  sunflower: 600,
  rapeseed: 850,
  wine: 8000,
  olive: 2500,
} as const;

export function calculateYieldPrediction(
  eosData: EosSummary,
  cropType: string,
  timeSeries: VegetationPoint[]
): YieldPrediction {
  const crop = cropType as keyof typeof HISTORICAL_YIELDS;
  const historicalYield = HISTORICAL_YIELDS[crop] || HISTORICAL_YIELDS.wheat;
  
  // Calculate NDVI-based yield potential
  const avgNDVI = timeSeries.length > 0 
    ? timeSeries.reduce((sum, point) => sum + point.NDVI, 0) / timeSeries.length 
    : eosData.ndvi_data.current_value;
  
  const peakNDVI = timeSeries.length > 0
    ? Math.max(...timeSeries.map(p => p.NDVI))
    : eosData.ndvi_data.current_value;

  // NDVI contribution (25% of prediction - reduced due to soil moisture integration)
  let ndviMultiplier = 1.0;
  if (peakNDVI >= 0.8) ndviMultiplier = 1.4; // Excellent vegetation
  else if (peakNDVI >= 0.7) ndviMultiplier = 1.2; // Good vegetation
  else if (peakNDVI >= 0.6) ndviMultiplier = 1.0; // Average vegetation
  else if (peakNDVI >= 0.4) ndviMultiplier = 0.8; // Below average
  else ndviMultiplier = 0.6; // Poor vegetation

  // Soil Moisture contribution (30% of prediction - NEW PRIORITY)
  let soilMoistureMultiplier = 1.0;
  if (eosData.soil_moisture) {
    const sm = eosData.soil_moisture;
    const rootZoneMoisture = sm.root_zone_moisture;
    const waterDeficit = sm.water_deficit;
    const smi = sm.soil_moisture_index;
    
    // Root zone moisture impact (primary factor)
    if (rootZoneMoisture >= sm.field_capacity * 0.8) {
      soilMoistureMultiplier = 1.3; // Optimal moisture
    } else if (rootZoneMoisture >= sm.field_capacity * 0.6) {
      soilMoistureMultiplier = 1.1; // Good moisture
    } else if (rootZoneMoisture >= sm.wilting_point * 1.5) {
      soilMoistureMultiplier = 0.9; // Adequate moisture
    } else if (rootZoneMoisture >= sm.wilting_point) {
      soilMoistureMultiplier = 0.7; // Stress conditions
    } else {
      soilMoistureMultiplier = 0.5; // Severe stress
    }
    
    // Water deficit penalty
    if (waterDeficit > 5) soilMoistureMultiplier *= 0.85; // High deficit
    else if (waterDeficit > 3) soilMoistureMultiplier *= 0.92; // Moderate deficit
    
    // SMI historical context
    if (smi < -2) soilMoistureMultiplier *= 0.8; // Extremely dry
    else if (smi < -1) soilMoistureMultiplier *= 0.9; // Very dry
    else if (smi > 1) soilMoistureMultiplier *= 1.1; // Above normal
  }

  // NDMI contribution (15% of prediction - reduced, now complementary to soil moisture)
  const currentNDMI = eosData.ndmi_data.current_value;
  let ndmiMultiplier = 1.0;
  if (currentNDMI >= 0.5) ndmiMultiplier = 1.2; // Excellent water status
  else if (currentNDMI >= 0.4) ndmiMultiplier = 1.0; // Good water status
  else if (currentNDMI >= 0.3) ndmiMultiplier = 0.85; // Moderate stress
  else if (currentNDMI >= 0.2) ndmiMultiplier = 0.7; // High stress
  else ndmiMultiplier = 0.5; // Severe stress

  // Weather impact (25% of prediction - increased importance)
  let weatherMultiplier = 1.0;
  const weatherRisks = eosData.weather_risks;
  
  // Temperature stress impact
  if (weatherRisks.temperature_stress_days > 10) weatherMultiplier -= 0.15;
  else if (weatherRisks.temperature_stress_days > 5) weatherMultiplier -= 0.08;
  
  // Precipitation deficit impact
  if (weatherRisks.precipitation_deficit_mm > 50) weatherMultiplier -= 0.12;
  else if (weatherRisks.precipitation_deficit_mm > 25) weatherMultiplier -= 0.06;
  
  // Cumulative water deficit (NEW - integrates with soil moisture)
  if (weatherRisks.water_deficit_cumulative > 100) weatherMultiplier -= 0.1;
  else if (weatherRisks.water_deficit_cumulative > 50) weatherMultiplier -= 0.05;
  
  // Heat stress risk
  if (weatherRisks.heat_stress_risk === 'high') weatherMultiplier -= 0.1;
  else if (weatherRisks.heat_stress_risk === 'medium') weatherMultiplier -= 0.05;

  // Frost risk
  if (weatherRisks.frost_risk_forecast_7d) weatherMultiplier -= 0.08;

  // Seasonal adjustment (5% of prediction - reduced)
  const currentDate = new Date();
  const month = currentDate.getMonth() + 1;
  let seasonalMultiplier = 1.0;
  
  // Adjust based on timing in growing season
  if (month >= 4 && month <= 6) seasonalMultiplier = 1.05; // Peak growing season
  else if (month >= 7 && month <= 9) seasonalMultiplier = 1.0; // Maturation
  else seasonalMultiplier = 0.95; // Off-season analysis

  // Combine all factors with NEW WEIGHTING: Soil Moisture 30%, NDVI 25%, Weather 25%, NDMI 15%, Seasonal 5%
  const overallMultiplier = 
    (ndviMultiplier * 0.25) + 
    (soilMoistureMultiplier * 0.30) + 
    (ndmiMultiplier * 0.15) + 
    (weatherMultiplier * 0.25) + 
    (seasonalMultiplier * 0.05);

  const predictedYield = historicalYield.average * overallMultiplier;

  // Determine yield class
  let yieldClass: YieldPrediction['yield_class'];
  const relativeYield = predictedYield / historicalYield.average;
  
  if (relativeYield >= 1.3) yieldClass = 'excellent';
  else if (relativeYield >= 1.1) yieldClass = 'good';
  else if (relativeYield >= 0.9) yieldClass = 'average';
  else if (relativeYield >= 0.7) yieldClass = 'below_average';
  else yieldClass = 'poor';

  // Calculate confidence level
  let confidence = 75; // Base confidence
  
  // Increase confidence with more data points
  if (timeSeries.length >= 8) confidence += 15;
  else if (timeSeries.length >= 5) confidence += 10;
  else if (timeSeries.length >= 3) confidence += 5;
  
  // Adjust confidence based on data quality
  if (eosData.ndvi_data.current_value > 0.1) confidence += 5;
  if (avgNDVI > 0.3) confidence += 5;
  
  // Reduce confidence for extreme weather
  if (weatherRisks.temperature_stress_days > 15) confidence -= 10;
  if (weatherRisks.precipitation_deficit_mm > 75) confidence -= 10;
  
  confidence = Math.max(45, Math.min(95, confidence));

  // Economic calculations
  const marketPrice = MARKET_PRICES[crop] || MARKET_PRICES.wheat;
  const productionCost = PRODUCTION_COSTS[crop] || PRODUCTION_COSTS.wheat;
  const expectedRevenue = predictedYield * marketPrice;
  const netProfit = expectedRevenue - productionCost;

  // Generate enhanced recommendations with soil moisture priorities
  const recommendations: string[] = [];
  
  // Soil moisture priority recommendations
  if (eosData.soil_moisture) {
    const sm = eosData.soil_moisture;
    if (sm.irrigation_recommendation?.timing === "immediate") {
      recommendations.push(`🚨 Irrigazione URGENTE: ${sm.irrigation_recommendation.volume_mm}mm entro 24h`);
    } else if (sm.irrigation_recommendation?.timing === "within_3_days") {
      recommendations.push(`💧 Programmare irrigazione: ${sm.irrigation_recommendation.volume_mm}mm entro 3 giorni`);
    }
    
    if (sm.drought_stress_level === "severe") {
      recommendations.push("⚠️ Stress idrico severo: implementare irrigazione di emergenza");
    } else if (sm.drought_stress_level === "moderate") {
      recommendations.push("⚡ Stress idrico moderato: aumentare frequenza irrigazione");
    }
    
    if (sm.water_deficit > 5) {
      recommendations.push("📈 Alto deficit idrico: ottimizzare timing e volumi irrigazione");
    }
  }
  
  // Secondary recommendations
  if (ndmiMultiplier < 0.8 && !eosData.soil_moisture) {
    recommendations.push("💧 Intensificare l'irrigazione per ridurre lo stress idrico");
  }
  
  if (ndviMultiplier < 0.9) {
    recommendations.push("🌱 Considerare fertilizzazione aggiuntiva per migliorare la vigoria");
  }
  
  if (weatherRisks.temperature_stress_days > 5) {
    recommendations.push("🌡️ Monitorare stress termico e considerare strategie di ombreggiamento");
  }
  
  if (yieldClass === 'excellent') {
    recommendations.push("✅ Condizioni ottime - mantenere pratiche attuali");
  } else if (yieldClass === 'poor') {
    recommendations.push("🆘 Interventi urgenti necessari per salvare il raccolto");
  }

  return {
    predicted_yield_ton_ha: Number(predictedYield.toFixed(2)),
    confidence_level: confidence,
    yield_class: yieldClass,
    factors: {
      ndvi_impact: Number((ndviMultiplier * 25).toFixed(1)),
      ndmi_impact: Number((ndmiMultiplier * 15).toFixed(1)),
      weather_impact: Number((weatherMultiplier * 25).toFixed(1)),
      seasonal_adjustment: Number((seasonalMultiplier * 5).toFixed(1)),
      soil_moisture_impact: eosData.soil_moisture ? Number((soilMoistureMultiplier * 30).toFixed(1)) : undefined,
      data_points: timeSeries.length
    },
    historical_comparison: {
      vs_average: Number(((predictedYield / historicalYield.average - 1) * 100).toFixed(1))
    },
    economic_projection: {
      expected_revenue_eur_ha: Number(expectedRevenue.toFixed(0)),
      market_price_eur_ton: marketPrice,
      production_cost_eur_ha: productionCost,
      net_profit_eur_ha: Number(netProfit.toFixed(0))
    },
    recommendations,
    meta: {
      crop_type: cropType,
      analysis_date: new Date().toISOString(),
      data_source: "Internal Algorithm with EOS Data",
      time_series_length: timeSeries.length
    }
  };
}