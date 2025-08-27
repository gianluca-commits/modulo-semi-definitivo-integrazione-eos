// Yield and Profitability Forecast using NDVI, NDMI and weather integration
import { VegetationPoint, WeatherData, ProductivityData } from "./eos";
import { CROP_THRESHOLDS } from "./eosAnalysis";

export interface YieldForecastModel {
  estimated_yield_tons_ha: number;
  confidence_interval: {
    min_yield: number;
    max_yield: number;
    confidence_level: number; // 0-100%
  };
  yield_potential_realized: number; // 0-100%
  limiting_factors: {
    factor: string;
    impact_percent: number;
    severity: "low" | "medium" | "high";
  }[];
  seasonal_trend: "increasing" | "stable" | "decreasing";
  maturation_estimate: {
    days_to_harvest: number;
    optimal_harvest_window: string;
    quality_indicators: string[];
  };
}

export interface ProfitabilityAnalysis {
  revenue_forecast: {
    base_scenario: number; // €/ha
    optimistic_scenario: number; // €/ha
    pessimistic_scenario: number; // €/ha
  };
  cost_breakdown: {
    inputs_cost: number; // €/ha
    operations_cost: number; // €/ha
    harvest_cost: number; // €/ha
    total_cost: number; // €/ha
  };
  profitability_metrics: {
    gross_margin: number; // €/ha
    roi_percent: number;
    break_even_yield: number; // tons/ha
    risk_adjusted_return: number; // €/ha
  };
  investment_recommendations: {
    action: string;
    expected_roi: number;
    investment_amount: string;
    payback_period: string;
  }[];
}

export interface ComprehensiveYieldAnalysis {
  yield_forecast: YieldForecastModel;
  profitability: ProfitabilityAnalysis;
  comparative_performance: {
    vs_regional_average: number; // % difference
    vs_optimal_conditions: number; // % of potential
    ranking_percentile: number; // 0-100
  };
  improvement_opportunities: string[];
}

// Crop-specific yield models and parameters
const CROP_YIELD_MODELS: Record<string, {
  base_yield: number; // tons/ha under optimal conditions
  ndvi_weight: number;
  ndmi_weight: number;
  weather_weight: number;
  critical_ndvi: number;
  market_price: number; // €/ton
  production_cost: number; // €/ha
}> = {
  wheat: {
    base_yield: 7.5,
    ndvi_weight: 0.4,
    ndmi_weight: 0.3,
    weather_weight: 0.3,
    critical_ndvi: 0.65,
    market_price: 250,
    production_cost: 850
  },
  sunflower: {
    base_yield: 3.2,
    ndvi_weight: 0.45,
    ndmi_weight: 0.35,
    weather_weight: 0.2,
    critical_ndvi: 0.75,
    market_price: 550,
    production_cost: 650
  },
  wine: {
    base_yield: 12.0,
    ndvi_weight: 0.35,
    ndmi_weight: 0.25,
    weather_weight: 0.4,
    critical_ndvi: 0.68,
    market_price: 800,
    production_cost: 1200
  },
  olive: {
    base_yield: 4.5,
    ndvi_weight: 0.3,
    ndmi_weight: 0.25,
    weather_weight: 0.45,
    critical_ndvi: 0.58,
    market_price: 1200,
    production_cost: 900
  }
};

export function calculateNDVIYieldImpact(
  timeSeries: VegetationPoint[],
  cropType: string
): { yield_factor: number; trend: string; limiting_factors: string[] } {
  if (!timeSeries.length) return { yield_factor: 0.5, trend: "unknown", limiting_factors: ["Dati insufficienti"] };

  const model = CROP_YIELD_MODELS[cropType] || CROP_YIELD_MODELS.wheat;
  const recentPoints = timeSeries.slice(-5);
  const avgNdvi = recentPoints.reduce((sum, p) => sum + p.NDVI, 0) / recentPoints.length;
  const maxNdvi = Math.max(...recentPoints.map(p => p.NDVI));
  
  // Calculate yield factor based on NDVI performance
  let yieldFactor = Math.min(1.2, avgNdvi / model.critical_ndvi);
  
  // Trend analysis
  let trend = "stable";
  if (recentPoints.length >= 3) {
    const trendSlope = (recentPoints[recentPoints.length - 1].NDVI - recentPoints[0].NDVI) / recentPoints.length;
    if (trendSlope > 0.01) trend = "increasing";
    else if (trendSlope < -0.01) trend = "decreasing";
  }

  // Identify limiting factors
  const limitingFactors: string[] = [];
  if (avgNdvi < model.critical_ndvi * 0.8) {
    limitingFactors.push("NDVI sotto potenziale");
  }
  if (maxNdvi < model.critical_ndvi) {
    limitingFactors.push("Vigore vegetativo insufficiente");
  }
  
  // Variability penalty
  const ndviVariance = recentPoints.reduce((sum, p) => sum + Math.pow(p.NDVI - avgNdvi, 2), 0) / recentPoints.length;
  if (ndviVariance > 0.02) {
    yieldFactor *= 0.95;
    limitingFactors.push("Disuniformità campo");
  }

  return {
    yield_factor: Math.max(0.3, Math.min(1.2, yieldFactor)),
    trend,
    limiting_factors: limitingFactors
  };
}

export function calculateWeatherYieldImpact(
  weather: WeatherData,
  cropType: string
): { yield_factor: number; stress_factors: string[] } {
  const stressFactors: string[] = [];
  let yieldFactor = 1.0;

  // Temperature stress
  if (weather.temperature_max > 35) {
    yieldFactor *= 0.9;
    stressFactors.push("Stress termico elevato");
  } else if (weather.temperature_max > 30) {
    yieldFactor *= 0.95;
    stressFactors.push("Stress termico moderato");
  }

  // Water stress indicators
  if (weather.humidity_avg < 40) {
    yieldFactor *= 0.92;
    stressFactors.push("Bassa umidità atmosferica");
  }

  // Precipitation adequacy
  if (weather.precipitation_total < 10 && cropType !== "olive") {
    yieldFactor *= 0.88;
    stressFactors.push("Precipitazioni insufficienti");
  } else if (weather.precipitation_total > 80) {
    yieldFactor *= 0.93;
    stressFactors.push("Eccesso precipitazioni");
  }

  // Wind damage potential
  if (weather.wind_speed_max > 15) {
    yieldFactor *= 0.95;
    stressFactors.push("Venti forti potenzialmente dannosi");
  }

  return {
    yield_factor: Math.max(0.6, yieldFactor),
    stress_factors: stressFactors
  };
}

export function forecastYield(
  timeSeries: VegetationPoint[],
  weather: WeatherData,
  cropType: string,
  polygonArea: number
): YieldForecastModel {
  const model = CROP_YIELD_MODELS[cropType] || CROP_YIELD_MODELS.wheat;
  
  // Component analyses
  const ndviImpact = calculateNDVIYieldImpact(timeSeries, cropType);
  const weatherImpact = calculateWeatherYieldImpact(weather, cropType);
  
  // Weighted yield calculation
  const baseYield = model.base_yield;
  const ndviComponent = ndviImpact.yield_factor * model.ndvi_weight;
  const weatherComponent = weatherImpact.yield_factor * model.weather_weight;
  
  // NDMI water stress factor
  const recentNdmi = timeSeries.slice(-3);
  const avgNdmi = recentNdmi.length ? recentNdmi.reduce((sum, p) => sum + p.NDMI, 0) / recentNdmi.length : 0.3;
  const ndmiComponent = Math.min(1.0, Math.max(0.7, avgNdmi / 0.4)) * model.ndmi_weight;
  
  const totalYieldFactor = ndviComponent + weatherComponent + ndmiComponent;
  const estimatedYield = baseYield * totalYieldFactor;
  
  // Confidence calculation
  const dataQuality = Math.min(1.0, timeSeries.length / 10);
  const weatherReliability = 0.8; // Assume moderate weather forecast reliability
  const modelConfidence = dataQuality * weatherReliability * 100;
  
  // Confidence interval
  const uncertainty = Math.max(0.15, 0.3 - (modelConfidence / 100 * 0.15));
  const minYield = estimatedYield * (1 - uncertainty);
  const maxYield = estimatedYield * (1 + uncertainty);
  
  // Collect all limiting factors
  const allLimitingFactors = [
    ...ndviImpact.limiting_factors.map(f => ({ factor: f, impact_percent: 15, severity: "medium" as const })),
    ...weatherImpact.stress_factors.map(f => ({ factor: f, impact_percent: 12, severity: "medium" as const }))
  ];

  if (avgNdmi < 0.25) {
    allLimitingFactors.push({ factor: "Stress idrico severo", impact_percent: 20, severity: "high" as const });
  }

  // Days to harvest estimation (rough based on crop type and season)
  const daysToHarvest = estimateDaysToHarvest(cropType);
  
  return {
    estimated_yield_tons_ha: Math.round(estimatedYield * 100) / 100,
    confidence_interval: {
      min_yield: Math.round(minYield * 100) / 100,
      max_yield: Math.round(maxYield * 100) / 100,
      confidence_level: Math.round(modelConfidence)
    },
    yield_potential_realized: Math.round((estimatedYield / baseYield) * 100),
    limiting_factors: allLimitingFactors.slice(0, 5),
    seasonal_trend: ndviImpact.trend as "increasing" | "stable" | "decreasing",
    maturation_estimate: {
      days_to_harvest: daysToHarvest,
      optimal_harvest_window: getOptimalHarvestWindow(cropType, daysToHarvest),
      quality_indicators: getQualityIndicators(cropType, avgNdmi, weather)
    }
  };
}

export function analyzeProfitability(
  yieldForecast: YieldForecastModel,
  cropType: string,
  polygonArea: number
): ProfitabilityAnalysis {
  const model = CROP_YIELD_MODELS[cropType] || CROP_YIELD_MODELS.wheat;
  
  // Revenue scenarios
  const baseRevenue = yieldForecast.estimated_yield_tons_ha * model.market_price * polygonArea;
  const optimisticRevenue = yieldForecast.confidence_interval.max_yield * model.market_price * polygonArea;
  const pessimisticRevenue = yieldForecast.confidence_interval.min_yield * model.market_price * polygonArea;
  
  // Cost breakdown (per hectare, then multiply by area)
  const inputsCost = model.production_cost * 0.4 * polygonArea; // Seeds, fertilizers, treatments
  const operationsCost = model.production_cost * 0.35 * polygonArea; // Fuel, machinery, labor
  const harvestCost = model.production_cost * 0.25 * polygonArea; // Harvest operations
  const totalCost = inputsCost + operationsCost + harvestCost;
  
  // Profitability metrics
  const grossMargin = baseRevenue - totalCost;
  const roiPercent = totalCost > 0 ? (grossMargin / totalCost) * 100 : 0;
  const breakEvenYield = model.production_cost / model.market_price;
  
  // Risk adjustment based on confidence
  const riskMultiplier = yieldForecast.confidence_interval.confidence_level / 100;
  const riskAdjustedReturn = grossMargin * riskMultiplier;
  
  // Investment recommendations
  const investmentRecommendations = generateInvestmentRecommendations(yieldForecast, cropType);
  
  return {
    revenue_forecast: {
      base_scenario: Math.round(baseRevenue),
      optimistic_scenario: Math.round(optimisticRevenue),
      pessimistic_scenario: Math.round(pessimisticRevenue)
    },
    cost_breakdown: {
      inputs_cost: Math.round(inputsCost),
      operations_cost: Math.round(operationsCost),
      harvest_cost: Math.round(harvestCost),
      total_cost: Math.round(totalCost)
    },
    profitability_metrics: {
      gross_margin: Math.round(grossMargin),
      roi_percent: Math.round(roiPercent * 10) / 10,
      break_even_yield: Math.round(breakEvenYield * 100) / 100,
      risk_adjusted_return: Math.round(riskAdjustedReturn)
    },
    investment_recommendations: investmentRecommendations
  };
}

function estimateDaysToHarvest(cropType: string): number {
  const currentMonth = new Date().getMonth() + 1;
  const harvestMonths = {
    wheat: [6, 7], // June-July
    sunflower: [8, 9], // August-September  
    wine: [9, 10], // September-October
    olive: [10, 11, 12] // October-December
  };
  
  const months = harvestMonths[cropType as keyof typeof harvestMonths] || [8, 9];
  const targetMonth = months[0];
  
  if (currentMonth <= targetMonth) {
    return (targetMonth - currentMonth) * 30;
  } else {
    return (12 - currentMonth + targetMonth) * 30;
  }
}

function getOptimalHarvestWindow(cropType: string, daysToHarvest: number): string {
  if (daysToHarvest < 14) return "Finestra ottimale imminente";
  if (daysToHarvest < 30) return "Preparare raccolta";
  if (daysToHarvest < 60) return "Monitoraggio maturazione";
  return "Fase sviluppo vegetativo";
}

function getQualityIndicators(cropType: string, ndmi: number, weather: WeatherData): string[] {
  const indicators: string[] = [];
  
  if (ndmi > 0.3) indicators.push("Buono stato idrico");
  else indicators.push("Stress idrico da monitorare");
  
  if (weather.temperature_avg > 25 && weather.temperature_avg < 30) {
    indicators.push("Temperature favorevoli maturazione");
  }
  
  if (weather.humidity_avg > 60 && weather.humidity_avg < 80) {
    indicators.push("Umidità ottimale per qualità");
  }
  
  return indicators;
}

function generateInvestmentRecommendations(
  forecast: YieldForecastModel,
  cropType: string
): Array<{ action: string; expected_roi: number; investment_amount: string; payback_period: string }> {
  const recommendations = [];
  
  // Check if irrigation would be beneficial
  const hasWaterStress = forecast.limiting_factors.some(f => f.factor.includes("idrico"));
  if (hasWaterStress && forecast.yield_potential_realized < 80) {
    recommendations.push({
      action: "Implementare irrigazione supplementare",
      expected_roi: 25,
      investment_amount: "800-1200 €/ha",
      payback_period: "2-3 stagioni"
    });
  }
  
  // Check if fertilization optimization is needed
  const hasNutrientStress = forecast.limiting_factors.some(f => f.factor.includes("NDVI"));
  if (hasNutrientStress && forecast.yield_potential_realized < 85) {
    recommendations.push({
      action: "Ottimizzare programma fertilizzazione",
      expected_roi: 15,
      investment_amount: "150-250 €/ha",
      payback_period: "1 stagione"
    });
  }
  
  // Precision agriculture recommendation
  if (forecast.limiting_factors.some(f => f.factor.includes("uniformità"))) {
    recommendations.push({
      action: "Adottare agricoltura di precisione",
      expected_roi: 12,
      investment_amount: "300-500 €/ha",
      payback_period: "3-4 stagioni"
    });
  }
  
  return recommendations;
}

export function generateComprehensiveYieldAnalysis(
  timeSeries: VegetationPoint[],
  weather: WeatherData,
  cropType: string,
  polygonArea: number
): ComprehensiveYieldAnalysis {
  const yieldForecast = forecastYield(timeSeries, weather, cropType, polygonArea);
  const profitability = analyzeProfitability(yieldForecast, cropType, polygonArea);
  
  // Comparative performance (mock data - would be actual regional data in production)
  const regionalAverage = CROP_YIELD_MODELS[cropType]?.base_yield * 0.85 || 3.0;
  const vsRegionalAverage = ((yieldForecast.estimated_yield_tons_ha - regionalAverage) / regionalAverage) * 100;
  
  const improvementOpportunities: string[] = [];
  if (yieldForecast.yield_potential_realized < 80) {
    improvementOpportunities.push("Ottimizzazione irrigazione e nutrizione");
  }
  if (yieldForecast.limiting_factors.length > 2) {
    improvementOpportunities.push("Gestione integrata stress abiotici");
  }
  if (profitability.profitability_metrics.roi_percent < 20) {
    improvementOpportunities.push("Revisione costi di produzione");
  }
  
  return {
    yield_forecast: yieldForecast,
    profitability,
    comparative_performance: {
      vs_regional_average: Math.round(vsRegionalAverage * 10) / 10,
      vs_optimal_conditions: yieldForecast.yield_potential_realized,
      ranking_percentile: Math.min(95, Math.max(5, 50 + vsRegionalAverage))
    },
    improvement_opportunities: improvementOpportunities
  };
}