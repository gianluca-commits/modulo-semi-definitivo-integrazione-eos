// BBCH Phenological Stage Analysis using NDVI progression and GDD
import { VegetationPoint, WeatherData } from "./eos";
import { CROP_THRESHOLDS } from "./eosAnalysis";

export interface PhenologicalStage {
  bbch_code: number;
  stage_name: string;
  description: string;
  expected_duration_days: number;
  critical_factors: string[];
}

export interface PhenologyAnalysis {
  current_stage: PhenologicalStage;
  estimated_progress: number; // 0-100%
  days_since_planting: number;
  expected_days_to_next_stage: number;
  gdd_accumulated: number;
  gdd_required_next_stage: number;
  confidence: "high" | "medium" | "low";
  alerts: string[];
  recommendations: string[];
}

// BBCH stages for major crops
const CROP_PHENOLOGY: Record<string, PhenologicalStage[]> = {
  wheat: [
    { bbch_code: 10, stage_name: "Germinazione", description: "Prime foglie emergenti", expected_duration_days: 14, critical_factors: ["Umidità suolo", "Temperatura"] },
    { bbch_code: 21, stage_name: "Accestimento", description: "Sviluppo germogli laterali", expected_duration_days: 35, critical_factors: ["Azoto", "Temperatura"] },
    { bbch_code: 31, stage_name: "Levata", description: "Allungamento stelo", expected_duration_days: 21, critical_factors: ["Acqua", "Nutrienti"] },
    { bbch_code: 51, stage_name: "Spigatura", description: "Emergenza spiga", expected_duration_days: 14, critical_factors: ["Stress idrico", "Funghi"] },
    { bbch_code: 65, stage_name: "Fioritura", description: "Antesi completa", expected_duration_days: 10, critical_factors: ["Temperatura", "Umidità"] },
    { bbch_code: 75, stage_name: "Riempimento", description: "Granella lattiginosa", expected_duration_days: 21, critical_factors: ["Acqua", "Temperatura"] },
    { bbch_code: 87, stage_name: "Maturazione", description: "Granella dura", expected_duration_days: 14, critical_factors: ["Siccità", "Malattie"] },
  ],
  sunflower: [
    { bbch_code: 12, stage_name: "Cotyledoni", description: "Prime foglie vere", expected_duration_days: 10, critical_factors: ["Umidità", "Temperatura"] },
    { bbch_code: 16, stage_name: "Foglie", description: "6-8 foglie vere", expected_duration_days: 25, critical_factors: ["Azoto", "Acqua"] },
    { bbch_code: 51, stage_name: "Bottone", description: "Infiorescenza visibile", expected_duration_days: 20, critical_factors: ["Fosforo", "Potassio"] },
    { bbch_code: 61, stage_name: "Fioritura", description: "Prime lingule aperte", expected_duration_days: 15, critical_factors: ["Impollinazione", "Acqua"] },
    { bbch_code: 69, stage_name: "Fine fioritura", description: "Caduta petali", expected_duration_days: 10, critical_factors: ["Stress idrico"] },
    { bbch_code: 75, stage_name: "Riempimento", description: "Riempimento acheni", expected_duration_days: 30, critical_factors: ["Acqua", "Potassio"] },
    { bbch_code: 87, stage_name: "Maturazione", description: "Acheni maturi", expected_duration_days: 15, critical_factors: ["Siccità fisiologica"] },
  ],
  wine: [
    { bbch_code: 9, stage_name: "Gemma gonfia", description: "Rottura gemme", expected_duration_days: 14, critical_factors: ["Temperatura", "Gelate"] },
    { bbch_code: 15, stage_name: "Foglie separate", description: "3-4 foglie distese", expected_duration_days: 21, critical_factors: ["Peronospora", "Oidio"] },
    { bbch_code: 57, stage_name: "Grappoli separati", description: "Infiorescenze ben separate", expected_duration_days: 14, critical_factors: ["Botrite", "Nutrizione"] },
    { bbch_code: 65, stage_name: "Fioritura", description: "50% cappucci caduti", expected_duration_days: 10, critical_factors: ["Allegagione", "Meteo"] },
    { bbch_code: 79, stage_name: "Invaiatura", description: "Inizio colorazione", expected_duration_days: 21, critical_factors: ["Stress idrico", "Maturazione"] },
    { bbch_code: 85, stage_name: "Maturazione", description: "Zuccheri ottimali", expected_duration_days: 14, critical_factors: ["Qualità", "Raccolta"] },
  ],
  olive: [
    { bbch_code: 11, stage_name: "Germogliamento", description: "Schiusura gemme", expected_duration_days: 20, critical_factors: ["Temperatura", "Potatura"] },
    { bbch_code: 15, stage_name: "Foglie giovani", description: "Sviluppo vegetativo", expected_duration_days: 40, critical_factors: ["Azoto", "Irrigazione"] },
    { bbch_code: 57, stage_name: "Mignolatura", description: "Infiorescenze sviluppate", expected_duration_days: 15, critical_factors: ["Alternanza", "Nutrizione"] },
    { bbch_code: 65, stage_name: "Fioritura", description: "Antesi", expected_duration_days: 10, critical_factors: ["Impollinazione", "Vento"] },
    { bbch_code: 71, stage_name: "Allegagione", description: "Frutti allegati", expected_duration_days: 30, critical_factors: ["Cascola", "Acqua"] },
    { bbch_code: 81, stage_name: "Indurimento", description: "Indurimento nocciolo", expected_duration_days: 45, critical_factors: ["Stress idrico", "Mosca"] },
    { bbch_code: 85, stage_name: "Invaiatura", description: "Inizio colorazione", expected_duration_days: 30, critical_factors: ["Maturazione", "Qualità olio"] },
  ],
};

// GDD requirements for stage transitions
const GDD_REQUIREMENTS: Record<string, number[]> = {
  wheat: [150, 400, 800, 1200, 1400, 1800, 2200],
  sunflower: [120, 350, 650, 950, 1100, 1500, 1800],
  wine: [100, 300, 600, 900, 1400, 1800],
  olive: [200, 500, 900, 1100, 1300, 1800, 2400],
};

export function calculateGDD(tempMin: number, tempMax: number, baseTemp: number): number {
  const avgTemp = (tempMin + tempMax) / 2;
  return Math.max(0, avgTemp - baseTemp);
}

export function analyzePhenology(
  timeSeries: VegetationPoint[],
  cropType: string,
  plantingDate: string | undefined,
  weather?: WeatherData
): PhenologyAnalysis {
  const stages = CROP_PHENOLOGY[cropType] || CROP_PHENOLOGY.wheat;
  const gddReqs = GDD_REQUIREMENTS[cropType] || GDD_REQUIREMENTS.wheat;
  
  // Calculate days since planting
  const plantingDay = plantingDate ? new Date(plantingDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const daysSincePlanting = Math.floor((Date.now() - plantingDay.getTime()) / (24 * 60 * 60 * 1000));
  
  // Estimate GDD accumulation
  const baseTemp = cropType === "wheat" ? 0 : cropType === "wine" ? 10 : 5;
  let gddAccumulated = 0;
  
  if (weather?.temperature_min && weather?.temperature_max) {
    // Use current weather data for GDD estimation
    const dailyGdd = calculateGDD(weather.temperature_min, weather.temperature_max, baseTemp);
    gddAccumulated = dailyGdd * daysSincePlanting; // Rough extrapolation
  } else {
    // Fallback estimation based on time
    gddAccumulated = daysSincePlanting * 15; // Rough estimation
  }
  
  // Determine current stage based on GDD
  let currentStageIndex = 0;
  for (let i = 0; i < gddReqs.length; i++) {
    if (gddAccumulated >= gddReqs[i]) {
      currentStageIndex = i;
    }
  }
  
  const currentStage = stages[currentStageIndex];
  const nextGddReq = gddReqs[currentStageIndex + 1] || gddReqs[gddReqs.length - 1];
  const stageProgress = currentStageIndex < gddReqs.length - 1 ? 
    ((gddAccumulated - gddReqs[currentStageIndex]) / (nextGddReq - gddReqs[currentStageIndex])) * 100 : 100;
  
  // Analyze NDVI trend for validation
  const ndviTrend = timeSeries.slice(-5);
  const ndviIncreasing = ndviTrend.length > 1 && 
    ndviTrend[ndviTrend.length - 1].NDVI > ndviTrend[0].NDVI;
  
  // Determine confidence based on data quality
  let confidence: "high" | "medium" | "low" = "medium";
  if (timeSeries.length > 10 && weather?.temperature_avg) {
    confidence = "high";
  } else if (timeSeries.length < 5 || !plantingDate) {
    confidence = "low";
  }
  
  // Generate alerts and recommendations
  const alerts: string[] = [];
  const recommendations: string[] = [];
  
  if (currentStageIndex >= 3 && !ndviIncreasing) {
    alerts.push("NDVI in calo durante fase critica");
  }
  
  if (daysSincePlanting > 120 && currentStageIndex < 3) {
    alerts.push("Sviluppo fenologico ritardato");
    recommendations.push("Verifica nutrizione e irrigazione");
  }
  
  // Stage-specific recommendations
  currentStage.critical_factors.forEach(factor => {
    if (factor === "Azoto" && currentStageIndex <= 2) {
      recommendations.push("Monitora livelli azoto per crescita vegetativa");
    } else if (factor === "Acqua" && currentStageIndex >= 3) {
      recommendations.push("Assicura irrigazione adeguata in fase riproduttiva");
    }
  });
  
  const daysToNext = Math.ceil((nextGddReq - gddAccumulated) / 15);
  
  return {
    current_stage: currentStage,
    estimated_progress: Math.round(stageProgress),
    days_since_planting: daysSincePlanting,
    expected_days_to_next_stage: Math.max(0, daysToNext),
    gdd_accumulated: Math.round(gddAccumulated),
    gdd_required_next_stage: nextGddReq,
    confidence,
    alerts,
    recommendations
  };
}