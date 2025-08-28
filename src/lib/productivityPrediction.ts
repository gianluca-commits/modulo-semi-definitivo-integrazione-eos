// Agricultural Productivity Prediction using existing database structure
import { VegetationPoint, WeatherData } from "./eos";

export interface HistoricalProductivityData {
  ref_area_code: string;
  ref_area_name: string;
  type_of_crop_code: string;
  type_of_crop_label: string;
  productivity_qt_ha: number;
  production_qt: number;
  area_ha: number;
  time_period_year: number;
}

export interface ProductivityPrediction {
  predicted_productivity_qt_ha: number;
  confidence_level: number; // 0-100%
  
  baseline: {
    historical_average: number;
    years_of_data: number;
    trend_direction: 'increasing' | 'stable' | 'decreasing';
    trend_percentage: number; // annual change %
  };
  
  satellite_adjustments: {
    ndvi_factor: number;
    ndmi_factor: number;
    weather_factor: number;
    combined_adjustment: number; // % adjustment to baseline
  };
  
  risk_factors: {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    magnitude: number; // % impact
  }[];
  
  comparison: {
    vs_regional_average: number; // % difference
    vs_last_year: number; // % difference
    percentile_rank: number; // 0-100, position relative to historical data
  };
}

// Crop mapping from EOS names to ISTAT codes
const CROP_MAPPING = {
  wheat: 'WHEAT',
  sunflower: 'SUNFLOWER', 
  corn: 'MAIZE',
  rice: 'RICE',
  olive: 'OLIVE',
  wine: 'GRAPE',
  tomato: 'TOMATO',
  potato: 'POTATO',
  soybean: 'SOYBEAN',
  barley: 'BARLEY'
};

// Mock historical productivity data for demo
const MOCK_HISTORICAL_DATA: Record<string, HistoricalProductivityData[]> = {
  'BO': [
    { ref_area_code: 'BO', ref_area_name: 'Bologna', type_of_crop_code: 'WHEAT', type_of_crop_label: 'Grano', productivity_qt_ha: 65, production_qt: 50000, area_ha: 769, time_period_year: 2023 },
    { ref_area_code: 'BO', ref_area_name: 'Bologna', type_of_crop_code: 'WHEAT', type_of_crop_label: 'Grano', productivity_qt_ha: 62, production_qt: 48000, area_ha: 774, time_period_year: 2022 },
    { ref_area_code: 'BO', ref_area_name: 'Bologna', type_of_crop_code: 'SUNFLOWER', type_of_crop_label: 'Girasole', productivity_qt_ha: 32, production_qt: 15000, area_ha: 469, time_period_year: 2023 },
  ],
  'MI': [
    { ref_area_code: 'MI', ref_area_name: 'Milano', type_of_crop_code: 'MAIZE', type_of_crop_label: 'Mais', productivity_qt_ha: 110, production_qt: 75000, area_ha: 682, time_period_year: 2023 },
    { ref_area_code: 'MI', ref_area_name: 'Milano', type_of_crop_code: 'RICE', type_of_crop_label: 'Riso', productivity_qt_ha: 68, production_qt: 45000, area_ha: 662, time_period_year: 2023 },
  ]
};

export async function getHistoricalProductivity(
  provinceCode: string, 
  cropType: string
): Promise<HistoricalProductivityData[]> {
  try {
    const istatCropCode = CROP_MAPPING[cropType as keyof typeof CROP_MAPPING] || cropType.toUpperCase();
    
    // Use mock data for demo - in production this would query istat_productivity table
    const provinceData = MOCK_HISTORICAL_DATA[provinceCode] || [];
    return provinceData.filter(d => d.type_of_crop_code === istatCropCode);
  } catch (error) {
    console.error('Error fetching historical productivity:', error);
    return [];
  }
}

export function analyzeHistoricalTrend(
  historicalData: HistoricalProductivityData[]
): { 
  average: number; 
  trend: 'increasing' | 'stable' | 'decreasing'; 
  trend_percentage: number;
  recent_average: number;
} {
  if (!historicalData.length) {
    return { average: 0, trend: 'stable', trend_percentage: 0, recent_average: 0 };
  }

  // Calculate overall average
  const average = historicalData.reduce((sum, d) => sum + (d.productivity_qt_ha || 0), 0) / historicalData.length;
  
  // Calculate trend using linear regression on last 5 years
  const recentData = historicalData.slice(-5);
  const recent_average = recentData.reduce((sum, d) => sum + (d.productivity_qt_ha || 0), 0) / recentData.length;
  
  if (recentData.length < 3) {
    return { average, trend: 'stable', trend_percentage: 0, recent_average };
  }

  // Simple linear regression
  const years = recentData.map(d => d.time_period_year);
  const productivities = recentData.map(d => d.productivity_qt_ha || 0);
  
  const n = years.length;
  const sumX = years.reduce((a, b) => a + b, 0);
  const sumY = productivities.reduce((a, b) => a + b, 0);
  const sumXY = years.reduce((sum, x, i) => sum + x * productivities[i], 0);
  const sumXX = years.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const trend_percentage = (slope / average) * 100;
  
  let trend: 'increasing' | 'stable' | 'decreasing';
  if (Math.abs(trend_percentage) < 1) {
    trend = 'stable';
  } else if (trend_percentage > 0) {
    trend = 'increasing';
  } else {
    trend = 'decreasing';
  }
  
  return { average, trend, trend_percentage, recent_average };
}

export function calculateSatelliteAdjustments(
  timeSeries: VegetationPoint[],
  weather: WeatherData | null,
  cropType: string
): {
  ndvi_factor: number;
  ndmi_factor: number; 
  weather_factor: number;
  combined_adjustment: number;
} {
  if (!timeSeries.length) {
    return { ndvi_factor: 1, ndmi_factor: 1, weather_factor: 1, combined_adjustment: 0 };
  }

  // NDVI Analysis - Compare to crop-specific optimal ranges
  const recentNdvi = timeSeries.slice(-5);
  const avgNdvi = recentNdvi.reduce((sum, p) => sum + p.NDVI, 0) / recentNdvi.length;
  
  // Crop-specific NDVI optimal ranges
  const optimalNdviRanges = {
    wheat: { min: 0.65, optimal: 0.8, max: 0.95 },
    sunflower: { min: 0.7, optimal: 0.85, max: 0.95 },
    corn: { min: 0.7, optimal: 0.85, max: 0.95 },
    rice: { min: 0.6, optimal: 0.8, max: 0.9 },
    olive: { min: 0.55, optimal: 0.7, max: 0.85 }
  };
  
  const range = optimalNdviRanges[cropType as keyof typeof optimalNdviRanges] || optimalNdviRanges.wheat;
  
  let ndvi_factor: number;
  if (avgNdvi >= range.optimal) {
    ndvi_factor = Math.min(1.2, 1 + (avgNdvi - range.optimal) / (range.max - range.optimal) * 0.2);
  } else if (avgNdvi >= range.min) {
    ndvi_factor = 0.8 + (avgNdvi - range.min) / (range.optimal - range.min) * 0.2;
  } else {
    ndvi_factor = Math.max(0.6, 0.8 * (avgNdvi / range.min));
  }

  // NDMI Analysis (water stress)
  const recentNdmi = timeSeries.slice(-5);
  const avgNdmi = recentNdmi.reduce((sum, p) => sum + p.NDMI, 0) / recentNdmi.length;
  
  let ndmi_factor: number;
  if (avgNdmi > 0.4) {
    ndmi_factor = 1.1; // Good water status
  } else if (avgNdmi > 0.2) {
    ndmi_factor = 1.0; // Normal water status
  } else if (avgNdmi > 0.1) {
    ndmi_factor = 0.9; // Mild water stress
  } else {
    ndmi_factor = 0.8; // Severe water stress
  }

  // Weather Analysis
  let weather_factor = 1.0;
  if (weather) {
    // Temperature stress
    if (weather.temperature_max > 35) {
      weather_factor *= 0.85;
    } else if (weather.temperature_max > 30) {
      weather_factor *= 0.95;
    }
    
    // Precipitation adequacy
    if (weather.precipitation_total < 20) {
      weather_factor *= 0.9;
    } else if (weather.precipitation_total > 100) {
      weather_factor *= 0.95;
    }
    
    // Humidity
    if (weather.humidity_avg < 40) {
      weather_factor *= 0.95;
    }
  }

  // Combine factors (weighted average)
  const combined_adjustment = ((ndvi_factor * 0.5) + (ndmi_factor * 0.3) + (weather_factor * 0.2) - 1) * 100;
  
  return {
    ndvi_factor,
    ndmi_factor,
    weather_factor,
    combined_adjustment
  };
}

export function assessRiskFactors(
  timeSeries: VegetationPoint[],
  weather: WeatherData | null,
  historicalTrend: ReturnType<typeof analyzeHistoricalTrend>
): Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; magnitude: number }> {
  const riskFactors = [];

  // NDVI variability
  if (timeSeries.length > 3) {
    const ndviValues = timeSeries.map(p => p.NDVI);
    const mean = ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length;
    const variance = ndviValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / ndviValues.length;
    const cv = Math.sqrt(variance) / mean; // Coefficient of variation
    
    if (cv > 0.15) {
      riskFactors.push({
        factor: 'Alta variabilità NDVI nel campo',
        impact: 'negative',
        magnitude: Math.min(15, cv * 100)
      });
    }
  }

  // Water stress
  if (timeSeries.length > 0) {
    const recentNdmi = timeSeries.slice(-3);
    const avgNdmi = recentNdmi.reduce((sum, p) => sum + p.NDMI, 0) / recentNdmi.length;
    
    if (avgNdmi < 0.1) {
      riskFactors.push({
        factor: 'Stress idrico severo',
        impact: 'negative',
        magnitude: 20
      });
    } else if (avgNdmi > 0.4) {
      riskFactors.push({
        factor: 'Ottimo stato idrico',
        impact: 'positive',
        magnitude: 10
      });
    }
  }

  // Weather risks
  if (weather) {
    if (weather.temperature_max > 35) {
      riskFactors.push({
        factor: 'Temperature estreme',
        impact: 'negative',
        magnitude: 15
      });
    }
    
    if (weather.precipitation_total < 10) {
      riskFactors.push({
        factor: 'Deficit precipitazioni',
        impact: 'negative',
        magnitude: 12
      });
    }
    
    if (weather.wind_speed_max > 15) {
      riskFactors.push({
        factor: 'Venti forti',
        impact: 'negative',
        magnitude: 8
      });
    }
  }

  // Historical trend
  if (historicalTrend.trend === 'increasing' && historicalTrend.trend_percentage > 2) {
    riskFactors.push({
      factor: 'Trend storico positivo',
      impact: 'positive',
      magnitude: Math.min(10, historicalTrend.trend_percentage)
    });
  } else if (historicalTrend.trend === 'decreasing' && historicalTrend.trend_percentage < -2) {
    riskFactors.push({
      factor: 'Trend storico negativo',
      impact: 'negative',
      magnitude: Math.min(10, Math.abs(historicalTrend.trend_percentage))
    });
  }

  return riskFactors;
}

export async function generateProductivityPrediction(
  provinceCode: string,
  cropType: string,
  timeSeries: VegetationPoint[],
  weather: WeatherData | null
): Promise<ProductivityPrediction> {
  // Get historical data
  const historicalData = await getHistoricalProductivity(provinceCode, cropType);
  const historicalTrend = analyzeHistoricalTrend(historicalData);
  
  // Calculate satellite adjustments
  const satelliteAdj = calculateSatelliteAdjustments(timeSeries, weather, cropType);
  
  // Assess risk factors
  const riskFactors = assessRiskFactors(timeSeries, weather, historicalTrend);
  
  // Calculate base prediction
  const baselineProductivity = historicalTrend.average || 3.5; // Fallback for missing data
  const adjustedProductivity = baselineProductivity * (1 + satelliteAdj.combined_adjustment / 100);
  
  // Apply risk factor adjustments
  const riskAdjustment = riskFactors.reduce((sum, risk) => {
    return sum + (risk.impact === 'positive' ? risk.magnitude : -risk.magnitude);
  }, 0);
  
  const finalProductivity = adjustedProductivity * (1 + riskAdjustment / 100);
  
  // Calculate confidence level
  let confidence = 70; // Base confidence
  if (historicalData.length > 5) confidence += 15; // More historical data
  if (timeSeries.length > 10) confidence += 10; // More satellite observations
  if (weather) confidence += 5; // Weather data available
  confidence = Math.min(95, Math.max(30, confidence));
  
  // Comparison metrics
  const vsRegionalAverage = historicalTrend.average ? 
    ((finalProductivity - historicalTrend.average) / historicalTrend.average) * 100 : 0;
  
  const vsLastYear = historicalData.length > 0 ? 
    ((finalProductivity - historicalData[historicalData.length - 1].productivity_qt_ha) / 
     historicalData[historicalData.length - 1].productivity_qt_ha) * 100 : 0;
  
  // Calculate percentile rank
  const allProductivities = historicalData.map(d => d.productivity_qt_ha).sort((a, b) => a - b);
  const percentileRank = allProductivities.length > 0 ? 
    (allProductivities.filter(p => p < finalProductivity).length / allProductivities.length) * 100 : 50;

  return {
    predicted_productivity_qt_ha: Math.round(finalProductivity * 10) / 10,
    confidence_level: confidence,
    
    baseline: {
      historical_average: Math.round(historicalTrend.average * 10) / 10,
      years_of_data: historicalData.length,
      trend_direction: historicalTrend.trend,
      trend_percentage: Math.round(historicalTrend.trend_percentage * 10) / 10
    },
    
    satellite_adjustments: {
      ndvi_factor: Math.round(satelliteAdj.ndvi_factor * 100) / 100,
      ndmi_factor: Math.round(satelliteAdj.ndmi_factor * 100) / 100,
      weather_factor: Math.round(satelliteAdj.weather_factor * 100) / 100,
      combined_adjustment: Math.round(satelliteAdj.combined_adjustment * 10) / 10
    },
    
    risk_factors: riskFactors,
    
    comparison: {
      vs_regional_average: Math.round(vsRegionalAverage * 10) / 10,
      vs_last_year: Math.round(vsLastYear * 10) / 10,
      percentile_rank: Math.round(percentileRank)
    }
  };
}