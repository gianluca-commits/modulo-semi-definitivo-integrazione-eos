// Phytosanitary Risk Analysis based on weather patterns and NDVI deviations
import { VegetationPoint, WeatherData } from "./eos";
import { CROP_THRESHOLDS } from "./eosAnalysis";

export interface PestDiseaseRisk {
  risk_type: "fungi" | "insects" | "bacteria" | "virus" | "abiotic";
  pathogen_name: string;
  risk_level: "low" | "medium" | "high" | "critical";
  probability: number; // 0-100%
  severity_potential: number; // 0-100%
  weather_conditions: string[];
  ndvi_indicators: string[];
  prevention_window_days: number;
  economic_impact_percent: number;
}

export interface PhytosanitaryAnalysis {
  overall_risk_score: number; // 0-100
  dominant_risks: PestDiseaseRisk[];
  weather_stress_factors: string[];
  vegetation_vulnerability: string[];
  immediate_actions: string[];
  preventive_treatments: {
    product_type: string;
    timing: string;
    priority: "low" | "medium" | "high";
    cost_estimate: string;
  }[];
}

// Crop-specific pest and disease thresholds
const CROP_PEST_PROFILES: Record<string, {
  common_diseases: string[];
  weather_triggers: Record<string, { temp_min: number; temp_max: number; humidity_min: number; rainfall_mm: number }>;
  ndvi_vulnerability_threshold: number;
}> = {
  wheat: {
    common_diseases: ["Septoria", "Ruggine", "Fusariosi", "Oidio"],
    weather_triggers: {
      "Septoria": { temp_min: 15, temp_max: 25, humidity_min: 80, rainfall_mm: 15 },
      "Ruggine": { temp_min: 15, temp_max: 22, humidity_min: 85, rainfall_mm: 20 },
      "Fusariosi": { temp_min: 20, temp_max: 30, humidity_min: 75, rainfall_mm: 10 },
      "Oidio": { temp_min: 15, temp_max: 28, humidity_min: 50, rainfall_mm: 5 },
    },
    ndvi_vulnerability_threshold: 0.6
  },
  wine: {
    common_diseases: ["Peronospora", "Oidio", "Botrite", "Escoriosi"],
    weather_triggers: {
      "Peronospora": { temp_min: 12, temp_max: 25, humidity_min: 85, rainfall_mm: 25 },
      "Oidio": { temp_min: 20, temp_max: 27, humidity_min: 40, rainfall_mm: 0 },
      "Botrite": { temp_min: 15, temp_max: 25, humidity_min: 90, rainfall_mm: 30 },
      "Escoriosi": { temp_min: 8, temp_max: 15, humidity_min: 80, rainfall_mm: 20 },
    },
    ndvi_vulnerability_threshold: 0.65
  },
  olive: {
    common_diseases: ["Occhio di pavone", "Rogna", "Lebbra", "Mosca olearia"],
    weather_triggers: {
      "Occhio di pavone": { temp_min: 15, temp_max: 24, humidity_min: 85, rainfall_mm: 20 },
      "Rogna": { temp_min: 20, temp_max: 30, humidity_min: 60, rainfall_mm: 10 },
      "Lebbra": { temp_min: 18, temp_max: 26, humidity_min: 75, rainfall_mm: 15 },
      "Mosca olearia": { temp_min: 22, temp_max: 30, humidity_min: 70, rainfall_mm: 5 },
    },
    ndvi_vulnerability_threshold: 0.55
  },
  sunflower: {
    common_diseases: ["Sclerotinia", "Alternaria", "Peronospora", "Verticillium"],
    weather_triggers: {
      "Sclerotinia": { temp_min: 15, temp_max: 25, humidity_min: 80, rainfall_mm: 25 },
      "Alternaria": { temp_min: 25, temp_max: 35, humidity_min: 60, rainfall_mm: 5 },
      "Peronospora": { temp_min: 12, temp_max: 22, humidity_min: 90, rainfall_mm: 30 },
      "Verticillium": { temp_min: 20, temp_max: 28, humidity_min: 70, rainfall_mm: 10 },
    },
    ndvi_vulnerability_threshold: 0.7
  }
};

export function calculateWeatherRisk(
  weather: WeatherData,
  cropType: string
): { pathogen: string; risk_score: number; conditions_met: string[] }[] {
  const profile = CROP_PEST_PROFILES[cropType] || CROP_PEST_PROFILES.wheat;
  const results: { pathogen: string; risk_score: number; conditions_met: string[] }[] = [];

  Object.entries(profile.weather_triggers).forEach(([pathogen, triggers]) => {
    const conditionsMet: string[] = [];
    let riskScore = 0;

    // Temperature check
    if (weather.temperature_avg >= triggers.temp_min && weather.temperature_avg <= triggers.temp_max) {
      conditionsMet.push("Temperatura favorevole");
      riskScore += 30;
    }

    // Humidity check
    if (weather.humidity_avg >= triggers.humidity_min) {
      conditionsMet.push("Umidità elevata");
      riskScore += 25;
    }

    // Precipitation check (using accumulated precipitation as proxy)
    if (weather.precipitation_total >= triggers.rainfall_mm) {
      conditionsMet.push("Precipitazioni sufficienti");
      riskScore += 25;
    }

    // Wind factor (high wind reduces some diseases)
    if (weather.wind_speed_avg > 5 && (pathogen === "Oidio" || pathogen === "Botrite")) {
      riskScore -= 15;
      conditionsMet.push("Ventilazione riduce rischio");
    }

    results.push({
      pathogen,
      risk_score: Math.max(0, Math.min(100, riskScore)),
      conditions_met: conditionsMet
    });
  });

  return results.sort((a, b) => b.risk_score - a.risk_score);
}

export function assessVegetationVulnerability(
  timeSeries: VegetationPoint[],
  cropType: string
): { vulnerability_score: number; indicators: string[] } {
  if (!timeSeries.length) return { vulnerability_score: 0, indicators: [] };

  const profile = CROP_PEST_PROFILES[cropType] || CROP_PEST_PROFILES.wheat;
  const recentPoints = timeSeries.slice(-5);
  const indicators: string[] = [];
  let vulnerabilityScore = 0;

  // NDVI trend analysis
  const avgNdvi = recentPoints.reduce((sum, p) => sum + p.NDVI, 0) / recentPoints.length;
  if (avgNdvi < profile.ndvi_vulnerability_threshold) {
    vulnerabilityScore += 30;
    indicators.push("NDVI sotto soglia critica");
  }

  // NDVI variability (stress indicator)
  const ndviVariance = recentPoints.reduce((sum, p) => sum + Math.pow(p.NDVI - avgNdvi, 2), 0) / recentPoints.length;
  if (ndviVariance > 0.01) {
    vulnerabilityScore += 20;
    indicators.push("Elevata variabilità NDVI");
  }

  // NDVI decline trend
  if (recentPoints.length >= 3) {
    const trend = (recentPoints[recentPoints.length - 1].NDVI - recentPoints[0].NDVI) / recentPoints.length;
    if (trend < -0.01) {
      vulnerabilityScore += 25;
      indicators.push("Trend NDVI in diminuzione");
    }
  }

  // NDMI stress correlation
  const avgNdmi = recentPoints.reduce((sum, p) => sum + p.NDMI, 0) / recentPoints.length;
  if (avgNdmi < 0.2) {
    vulnerabilityScore += 15;
    indicators.push("Stress idrico aumenta vulnerabilità");
  }

  return {
    vulnerability_score: Math.min(100, vulnerabilityScore),
    indicators
  };
}

export function analyzePhytosanitaryRisk(
  timeSeries: VegetationPoint[],
  weather: WeatherData,
  cropType: string
): PhytosanitaryAnalysis {
  const weatherRisks = calculateWeatherRisk(weather, cropType);
  const vulnerabilityData = assessVegetationVulnerability(timeSeries, cropType);
  
  // Convert weather risks to PestDiseaseRisk format
  const dominantRisks: PestDiseaseRisk[] = weatherRisks.slice(0, 3).map(wr => {
    const riskLevel = wr.risk_score >= 70 ? "critical" : 
                     wr.risk_score >= 50 ? "high" : 
                     wr.risk_score >= 30 ? "medium" : "low";
    
    return {
      risk_type: getPathogenType(wr.pathogen),
      pathogen_name: wr.pathogen,
      risk_level: riskLevel,
      probability: wr.risk_score,
      severity_potential: Math.min(100, wr.risk_score + vulnerabilityData.vulnerability_score * 0.3),
      weather_conditions: wr.conditions_met,
      ndvi_indicators: vulnerabilityData.indicators,
      prevention_window_days: riskLevel === "critical" ? 3 : riskLevel === "high" ? 7 : 14,
      economic_impact_percent: riskLevel === "critical" ? 25 : riskLevel === "high" ? 15 : 8
    };
  });

  // Calculate overall risk score
  const overallRiskScore = Math.round(
    (weatherRisks.reduce((sum, wr) => sum + wr.risk_score, 0) / weatherRisks.length * 0.7) +
    (vulnerabilityData.vulnerability_score * 0.3)
  );

  // Generate immediate actions
  const immediateActions: string[] = [];
  const criticalRisks = dominantRisks.filter(dr => dr.risk_level === "critical");
  if (criticalRisks.length > 0) {
    immediateActions.push(`Trattamento urgente contro ${criticalRisks[0].pathogen_name}`);
    immediateActions.push("Intensifica monitoraggio campo");
  }

  // Generate preventive treatments
  const preventiveTreatments = dominantRisks.map(risk => ({
    product_type: getRecommendedTreatment(risk.pathogen_name, cropType),
    timing: risk.prevention_window_days <= 3 ? "Immediato" : 
            risk.prevention_window_days <= 7 ? "Entro settimana" : "Programmato",
    priority: risk.risk_level === "critical" ? "high" as const :
              risk.risk_level === "high" ? "medium" as const : "low" as const,
    cost_estimate: estimateTreatmentCost(risk.pathogen_name, cropType)
  }));

  return {
    overall_risk_score: overallRiskScore,
    dominant_risks: dominantRisks,
    weather_stress_factors: weatherRisks.filter(wr => wr.risk_score > 40).map(wr => wr.pathogen),
    vegetation_vulnerability: vulnerabilityData.indicators,
    immediate_actions: immediateActions,
    preventive_treatments: preventiveTreatments
  };
}

function getPathogenType(pathogen: string): "fungi" | "insects" | "bacteria" | "virus" | "abiotic" {
  const fungiPathogens = ["Septoria", "Ruggine", "Fusariosi", "Oidio", "Peronospora", "Botrite", "Sclerotinia", "Alternaria"];
  const insectPathogens = ["Mosca olearia", "Afidi", "Tripidi"];
  
  if (fungiPathogens.some(f => pathogen.includes(f))) return "fungi";
  if (insectPathogens.some(i => pathogen.includes(i))) return "insects";
  return "abiotic";
}

function getRecommendedTreatment(pathogen: string, cropType: string): string {
  const treatments: Record<string, string> = {
    "Septoria": "Fungicida triazolico",
    "Ruggine": "Fungicida strobilurina",
    "Fusariosi": "Fungicida tebuconazolo",
    "Oidio": "Fungicida zolfo bagnabile",
    "Peronospora": "Fungicida rameico",
    "Botrite": "Fungicida botricida",
    "Sclerotinia": "Fungicida iprodione",
    "Mosca olearia": "Insetticida deltametrina"
  };
  return treatments[pathogen] || "Fungicida generico";
}

function estimateTreatmentCost(pathogen: string, cropType: string): string {
  const costs: Record<string, string> = {
    "Septoria": "45-60 €/ha",
    "Ruggine": "40-55 €/ha", 
    "Fusariosi": "50-70 €/ha",
    "Oidio": "25-35 €/ha",
    "Peronospora": "30-45 €/ha",
    "Botrite": "60-80 €/ha",
    "Sclerotinia": "55-75 €/ha",
    "Mosca olearia": "35-50 €/ha"
  };
  return costs[pathogen] || "40-60 €/ha";
}