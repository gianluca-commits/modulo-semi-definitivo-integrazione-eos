// Enhanced EOS data analysis and interpretation
import { EosSummary, VegetationPoint, EosConfig } from "./eos";

export interface CropThresholds {
  ndvi: {
    excellent: number;
    good: number;
    moderate: number;
    critical: number;
  };
  ndmi: {
    optimal: number;
    stress_threshold: number;
    critical_threshold: number;
  };
}

export const CROP_THRESHOLDS: Record<string, CropThresholds> = {
  wheat: {
    ndvi: { excellent: 0.8, good: 0.65, moderate: 0.45, critical: 0.3 },
    ndmi: { optimal: 0.4, stress_threshold: 0.25, critical_threshold: 0.15 }
  },
  wine: {
    ndvi: { excellent: 0.75, good: 0.6, moderate: 0.4, critical: 0.25 },
    ndmi: { optimal: 0.35, stress_threshold: 0.2, critical_threshold: 0.1 }
  },
  olive: {
    ndvi: { excellent: 0.7, good: 0.55, moderate: 0.35, critical: 0.2 },
    ndmi: { optimal: 0.3, stress_threshold: 0.18, critical_threshold: 0.08 }
  },
  sunflower: {
    ndvi: { excellent: 0.85, good: 0.7, moderate: 0.5, critical: 0.35 },
    ndmi: { optimal: 0.45, stress_threshold: 0.3, critical_threshold: 0.2 }
  }
};

export interface HealthStatus {
  level: "excellent" | "good" | "moderate" | "critical";
  color: string;
  description: string;
  recommendations: string[];
}

export interface WaterStressAlert {
  level: "none" | "early" | "moderate" | "severe" | "critical";
  color: string;
  icon: string;
  title: string;
  description: string;
  actions: string[];
  urgency: number; // 1-5 scale
}

export interface SeasonalContext {
  season: "spring" | "summer" | "autumn" | "winter";
  month: number;
  expectedPhase: string;
  optimalNDVI: number;
  optimalNDMI: number;
}

// Get crop-specific health status for NDVI
export function getHealthStatus(ndvi: number, cropType: string): HealthStatus {
  const thresholds = CROP_THRESHOLDS[cropType] || CROP_THRESHOLDS.wheat;
  
  if (ndvi >= thresholds.ndvi.excellent) {
    return {
      level: "excellent",
      color: "text-green-600",
      description: "Vegetazione eccellente",
      recommendations: ["Continua il programma attuale", "Monitora per mantenere lo stato"]
    };
  } else if (ndvi >= thresholds.ndvi.good) {
    return {
      level: "good",
      color: "text-green-500", 
      description: "Vegetazione in buona salute",
      recommendations: ["Mantieni irrigazione regolare", "Controlla zone meno vigorose"]
    };
  } else if (ndvi >= thresholds.ndvi.moderate) {
    return {
      level: "moderate",
      color: "text-yellow-500",
      description: "Vegetazione moderata",
      recommendations: ["Aumenta frequenza irrigazione", "Verifica nutrizione", "Monitora stress"]
    };
  } else {
    return {
      level: "critical",
      color: "text-red-500",
      description: "Vegetazione in stress severo",
      recommendations: ["Irrigazione immediata", "Ispezione campo urgente", "Verifica sistema radicale"]
    };
  }
}

// Enhanced water stress analysis with early warning
export function getWaterStressAlert(ndmi: number, trend: number | undefined, cropType: string): WaterStressAlert {
  const thresholds = CROP_THRESHOLDS[cropType] || CROP_THRESHOLDS.wheat;
  
  // Calculate trend velocity (change per week)
  const trendVelocity = trend ? Math.abs(trend) / 2 : 0; // Convert 14-day to weekly
  
  if (ndmi >= thresholds.ndmi.optimal) {
    if (trend && trend < -10) {
      return {
        level: "early",
        color: "text-yellow-500",
        icon: "⚠️",
        title: "Allerta Precoce",
        description: "NDMI in calo rapido, possibile stress in sviluppo",
        actions: ["Programma irrigazione preventiva", "Monitora da vicino"],
        urgency: 2
      };
    }
    return {
      level: "none",
      color: "text-green-600",
      icon: "✅",
      title: "Stato Idrico Ottimale",
      description: "Livello di umidità adeguato per la coltura",
      actions: ["Mantieni programma irrigazione attuale"],
      urgency: 1
    };
  } else if (ndmi >= thresholds.ndmi.stress_threshold) {
    return {
      level: "moderate",
      color: "text-orange-500",
      icon: "🔶",
      title: "Stress Idrico Moderato",
      description: "Iniziali segni di deficit idrico",
      actions: ["Aumenta frequenza irrigazione", "Verifica uniformità irrigua"],
      urgency: 3
    };
  } else if (ndmi >= thresholds.ndmi.critical_threshold) {
    return {
      level: "severe",
      color: "text-red-500", 
      icon: "🔴",
      title: "Stress Idrico Severo",
      description: "Deficit idrico significativo",
      actions: ["Irrigazione immediata", "Ridurre stress aggiuntivi", "Monitoraggio continuo"],
      urgency: 4
    };
  } else {
    return {
      level: "critical",
      color: "text-red-700",
      icon: "🚨",
      title: "Emergenza Idrica",
      description: "Stress idrico critico - rischio danni permanenti",
      actions: ["Intervento urgente", "Irrigazione intensiva", "Ispezione immediata campo"],
      urgency: 5
    };
  }
}

// Get seasonal context for better interpretation
export function getSeasonalContext(cropType: string, date?: string): SeasonalContext {
  const currentDate = date ? new Date(date) : new Date();
  const month = currentDate.getMonth() + 1; // 1-12
  
  let season: SeasonalContext["season"];
  let expectedPhase: string;
  let optimalNDVI: number;
  let optimalNDMI: number;
  
  const thresholds = CROP_THRESHOLDS[cropType] || CROP_THRESHOLDS.wheat;
  
  if (month >= 3 && month <= 5) {
    season = "spring";
    expectedPhase = "Crescita attiva";
    optimalNDVI = thresholds.ndvi.good;
    optimalNDMI = thresholds.ndmi.optimal;
  } else if (month >= 6 && month <= 8) {
    season = "summer";
    expectedPhase = "Massimo sviluppo";
    optimalNDVI = thresholds.ndvi.excellent;
    optimalNDMI = thresholds.ndmi.stress_threshold; // More stress expected in summer
  } else if (month >= 9 && month <= 11) {
    season = "autumn";
    expectedPhase = "Maturazione";
    optimalNDVI = thresholds.ndvi.moderate;
    optimalNDMI = thresholds.ndmi.optimal;
  } else {
    season = "winter";
    expectedPhase = "Dormienza/Riposo";
    optimalNDVI = thresholds.ndvi.moderate;
    optimalNDMI = thresholds.ndmi.optimal;
  }
  
  return { season, month, expectedPhase, optimalNDVI, optimalNDMI };
}

// Calculate irrigation recommendations
export interface IrrigationRecommendation {
  urgency: "none" | "low" | "medium" | "high" | "immediate";
  timing: string;
  amount: string;
  frequency: string;
  reasoning: string[];
  weatherConsiderations: string[];
}

export function getIrrigationRecommendation(
  summary: EosSummary,
  cropType: string
): IrrigationRecommendation {
  const ndmi = summary.ndmi_data.current_value || 0;
  const waterStress = getWaterStressAlert(ndmi, summary.ndmi_data.trend_14_days, cropType);
  const seasonal = getSeasonalContext(cropType, summary.meta?.end_date);
  
  const precipitationDeficit = summary.weather_risks.precipitation_deficit_mm || 0;
  const heatStress = summary.weather_risks.heat_stress_risk || "low";
  
  let urgency: IrrigationRecommendation["urgency"];
  let timing: string;
  let amount: string;
  let frequency: string;
  let reasoning: string[] = [];
  let weatherConsiderations: string[] = [];
  
  // Base recommendations on water stress level
  switch (waterStress.level) {
    case "none":
      urgency = "none";
      timing = "Prossima irrigazione programmata";
      amount = "Normale (20-30mm)";
      frequency = "Secondo programma";
      reasoning.push("Livello idrico ottimale");
      break;
      
    case "early":
      urgency = "low";
      timing = "Entro 7-10 giorni";
      amount = "Preventiva (15-25mm)";
      frequency = "Anticipa leggermente";
      reasoning.push("Trend NDMI in calo", "Prevenzione stress");
      break;
      
    case "moderate":
      urgency = "medium";
      timing = "Entro 3-5 giorni";
      amount = "Moderata (25-35mm)";
      frequency = "Aumenta del 20%";
      reasoning.push("Stress idrico rilevato", "Recupero necessario");
      break;
      
    case "severe":
      urgency = "high";
      timing = "Entro 24-48 ore";
      amount = "Abbondante (35-50mm)";
      frequency = "Irrigazioni ravvicinate";
      reasoning.push("Stress severo", "Rischio danni");
      break;
      
    case "critical":
      urgency = "immediate";
      timing = "Immediatamente";
      amount = "Emergenza (50+ mm)";
      frequency = "Multiple irrigazioni";
      reasoning.push("Emergenza idrica", "Rischio perdite gravi");
      break;
  }
  
  // Weather considerations
  if (precipitationDeficit > 20) {
    weatherConsiderations.push(`Deficit ${precipitationDeficit}mm nelle ultime settimane`);
  }
  
  if (heatStress === "high") {
    weatherConsiderations.push("Stress termico elevato");
    timing = timing.replace(/\d+/, (match) => String(Math.max(1, parseInt(match) - 1)));
  }
  
  if (seasonal.season === "summer") {
    weatherConsiderations.push("Stagione estiva - maggiore fabbisogno idrico");
  }
  
  return {
    urgency,
    timing,
    amount,
    frequency,
    reasoning,
    weatherConsiderations
  };
}

// Analyze temporal trends for insights
export interface TemporalAnalysis {
  trendDirection: "improving" | "stable" | "declining";
  velocityLevel: "slow" | "moderate" | "rapid";
  seasonalComparison: "ahead" | "normal" | "behind";
  projectedValue7d: number;
  projectedValue14d: number;
  confidence: number;
}

export function analyzeTemporalTrends(
  timeSeries: VegetationPoint[],
  indicator: "NDVI" | "NDMI",
  cropType: string
): TemporalAnalysis | null {
  if (!timeSeries || timeSeries.length < 3) return null;
  
  const values = timeSeries.map(p => p[indicator]).filter(v => v != null) as number[];
  const recent = values.slice(-5); // Last 5 observations
  
  // Calculate trend
  let trendDirection: TemporalAnalysis["trendDirection"];
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = values.slice(0, Math.min(5, values.length - 5))
    .reduce((a, b) => a + b, 0) / Math.min(5, values.length - 5);
  
  const change = recentAvg - earlierAvg;
  const changePercent = Math.abs((change / earlierAvg) * 100);
  
  if (change > 0.02) trendDirection = "improving";
  else if (change < -0.02) trendDirection = "declining";
  else trendDirection = "stable";
  
  // Velocity assessment
  let velocityLevel: TemporalAnalysis["velocityLevel"];
  if (changePercent > 15) velocityLevel = "rapid";
  else if (changePercent > 5) velocityLevel = "moderate";
  else velocityLevel = "slow";
  
  // Simple linear projection
  const dailyChange = change / 14; // Assume 14 days between recent and earlier
  const projectedValue7d = Math.max(0, Math.min(1, recentAvg + (dailyChange * 7)));
  const projectedValue14d = Math.max(0, Math.min(1, recentAvg + (dailyChange * 14)));
  
  return {
    trendDirection,
    velocityLevel,
    seasonalComparison: "normal", // Simplified for now
    projectedValue7d: Number(projectedValue7d.toFixed(3)),
    projectedValue14d: Number(projectedValue14d.toFixed(3)),
    confidence: Math.min(95, 60 + (values.length * 2)) // More data = higher confidence
  };
}