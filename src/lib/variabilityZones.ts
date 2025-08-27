// Management and Variability Zones Analysis using NDVI clustering
import { VegetationPoint } from "./eos";

export interface VigorZone {
  zone_id: string;
  vigor_class: "very_high" | "high" | "medium" | "low" | "very_low";
  avg_ndvi: number;
  area_percentage: number;
  color: string;
  description: string;
  management_priority: "immediate" | "high" | "medium" | "low";
  recommended_actions: string[];
  scouting_frequency: "daily" | "weekly" | "biweekly" | "monthly";
}

export interface VariabilityAnalysis {
  overall_uniformity: number; // 0-100%
  vigor_zones: VigorZone[];
  spatial_trends: {
    dominant_pattern: "uniform" | "gradient" | "patchy" | "edge_effects" | "random";
    variability_coefficient: number;
    hot_spots: number;
    cold_spots: number;
  };
  management_recommendations: {
    zone_specific: string[];
    field_level: string[];
    monitoring_priorities: string[];
  };
  economic_optimization: {
    high_potential_areas_percent: number;
    investment_priorities: string[];
    expected_improvement_percent: number;
  };
}

export interface ScoutingPlan {
  priority_zones: string[];
  inspection_schedule: {
    zone_id: string;
    next_inspection_days: number;
    inspection_type: "visual" | "sampling" | "detailed";
    focus_areas: string[];
  }[];
  resource_allocation: {
    high_priority_time_percent: number;
    medium_priority_time_percent: number;
    low_priority_time_percent: number;
  };
}

// NDVI thresholds for vigor classification
const VIGOR_THRESHOLDS = {
  very_high: 0.8,
  high: 0.7,
  medium: 0.6,
  low: 0.4,
  very_low: 0.0
};

const VIGOR_COLORS = {
  very_high: "#006400", // Dark Green
  high: "#32CD32",      // Lime Green
  medium: "#FFD700",    // Gold
  low: "#FF8C00",       // Dark Orange
  very_low: "#FF4500"   // Red Orange
};

export function classifyVigorZones(
  timeSeries: VegetationPoint[],
  cropType: string
): VigorZone[] {
  if (!timeSeries.length) return [];

  // Use recent NDVI values for classification
  const recentPoints = timeSeries.slice(-3);
  const avgNdvi = recentPoints.reduce((sum, p) => sum + p.NDVI, 0) / recentPoints.length;
  
  // Simulate spatial variability (in real implementation, this would use spatial NDVI data)
  const zones: VigorZone[] = [];
  const vigorLevels = Object.keys(VIGOR_THRESHOLDS) as Array<keyof typeof VIGOR_THRESHOLDS>;
  
  vigorLevels.forEach((vigor, index) => {
    const threshold = VIGOR_THRESHOLDS[vigor];
    const nextThreshold = vigorLevels[index + 1] ? VIGOR_THRESHOLDS[vigorLevels[index + 1]] : 1.0;
    
    // Simulate zone with NDVI in this range
    if (avgNdvi >= threshold && avgNdvi < nextThreshold) {
      const zone = createVigorZone(vigor, avgNdvi, cropType, 60); // Main zone
      zones.push(zone);
      
      // Add some variability zones
      if (zones.length === 0) { // Only for the main vigor class
        addVariabilityZones(zones, vigor, avgNdvi, cropType);
      }
    }
  });

  // If no zones created, create based on current NDVI
  if (zones.length === 0) {
    const vigorClass = determineVigorClass(avgNdvi);
    zones.push(createVigorZone(vigorClass, avgNdvi, cropType, 100));
  }

  return zones;
}

function createVigorZone(
  vigorClass: keyof typeof VIGOR_THRESHOLDS,
  ndviValue: number,
  cropType: string,
  areaPercentage: number
): VigorZone {
  const zoneId = `zone_${vigorClass}_${Math.random().toString(36).substr(2, 4)}`;
  
  const managementPriority = getManagementPriority(vigorClass);
  const recommendedActions = getRecommendedActions(vigorClass, cropType);
  const scoutingFrequency = getScoutingFrequency(vigorClass);
  
  return {
    zone_id: zoneId,
    vigor_class: vigorClass,
    avg_ndvi: Math.round(ndviValue * 1000) / 1000,
    area_percentage: areaPercentage,
    color: VIGOR_COLORS[vigorClass],
    description: getVigorDescription(vigorClass),
    management_priority: managementPriority,
    recommended_actions: recommendedActions,
    scouting_frequency: scoutingFrequency
  };
}

function addVariabilityZones(
  zones: VigorZone[],
  mainVigor: keyof typeof VIGOR_THRESHOLDS,
  baseNdvi: number,
  cropType: string
): void {
  // Add a lower vigor zone (stress area)
  const lowerVigorIndex = Object.keys(VIGOR_THRESHOLDS).indexOf(mainVigor) + 1;
  if (lowerVigorIndex < Object.keys(VIGOR_THRESHOLDS).length) {
    const lowerVigor = Object.keys(VIGOR_THRESHOLDS)[lowerVigorIndex] as keyof typeof VIGOR_THRESHOLDS;
    zones.push(createVigorZone(lowerVigor, baseNdvi * 0.8, cropType, 25));
  }
  
  // Add a higher vigor zone (optimal area)
  const higherVigorIndex = Object.keys(VIGOR_THRESHOLDS).indexOf(mainVigor) - 1;
  if (higherVigorIndex >= 0) {
    const higherVigor = Object.keys(VIGOR_THRESHOLDS)[higherVigorIndex] as keyof typeof VIGOR_THRESHOLDS;
    zones.push(createVigorZone(higherVigor, Math.min(0.95, baseNdvi * 1.15), cropType, 15));
  }
}

function determineVigorClass(ndvi: number): keyof typeof VIGOR_THRESHOLDS {
  if (ndvi >= VIGOR_THRESHOLDS.very_high) return "very_high";
  if (ndvi >= VIGOR_THRESHOLDS.high) return "high";
  if (ndvi >= VIGOR_THRESHOLDS.medium) return "medium";
  if (ndvi >= VIGOR_THRESHOLDS.low) return "low";
  return "very_low";
}

function getManagementPriority(vigor: keyof typeof VIGOR_THRESHOLDS): "immediate" | "high" | "medium" | "low" {
  const priorityMap = {
    very_low: "immediate" as const,
    low: "high" as const,
    medium: "medium" as const,
    high: "low" as const,
    very_high: "low" as const
  };
  return priorityMap[vigor];
}

function getRecommendedActions(vigor: keyof typeof VIGOR_THRESHOLDS, cropType: string): string[] {
  const actionMap = {
    very_low: [
      "Analisi suolo urgente",
      "Verifica sistema irrigazione",
      "Controllo malattie e parassiti",
      "Fertilizzazione correttiva immediata"
    ],
    low: [
      "Fertilizzazione azotata supplementare",
      "Aumento frequenza irrigazione",
      "Monitoraggio stress abiotici",
      "Trattamenti fogliari nutritivi"
    ],
    medium: [
      "Mantenimento programma standard",
      "Monitoraggio regolare",
      "Ottimizzazione input secondo necessità"
    ],
    high: [
      "Conferma programma attuale",
      "Monitoraggio per mantenimento livelli",
      "Possibile riduzione input"
    ],
    very_high: [
      "Mantenimento condizioni ottimali",
      "Monitoraggio per prevenire eccessi",
      "Modello di riferimento per altre zone"
    ]
  };
  
  return actionMap[vigor];
}

function getScoutingFrequency(vigor: keyof typeof VIGOR_THRESHOLDS): "daily" | "weekly" | "biweekly" | "monthly" {
  const frequencyMap = {
    very_low: "daily" as const,
    low: "weekly" as const,
    medium: "biweekly" as const,
    high: "biweekly" as const,
    very_high: "monthly" as const
  };
  return frequencyMap[vigor];
}

function getVigorDescription(vigor: keyof typeof VIGOR_THRESHOLDS): string {
  const descriptionMap = {
    very_high: "Vigore eccellente - Condizioni ottimali",
    high: "Vigore elevato - Performance superiori",
    medium: "Vigore normale - Sviluppo standard",
    low: "Vigore ridotto - Necessita interventi",
    very_low: "Vigore critico - Intervento urgente"
  };
  return descriptionMap[vigor];
}

export function analyzeFieldVariability(
  timeSeries: VegetationPoint[],
  cropType: string
): VariabilityAnalysis {
  const vigorZones = classifyVigorZones(timeSeries, cropType);
  
  // Calculate overall uniformity
  const ndviValues = timeSeries.slice(-5).map(p => p.NDVI);
  const avgNdvi = ndviValues.reduce((sum, val) => sum + val, 0) / ndviValues.length;
  const variance = ndviValues.reduce((sum, val) => sum + Math.pow(val - avgNdvi, 2), 0) / ndviValues.length;
  const coefficient = variance / (avgNdvi * avgNdvi);
  const uniformity = Math.max(0, 100 - (coefficient * 1000)); // Convert to percentage
  
  // Analyze spatial trends
  const lowVigorZones = vigorZones.filter(z => z.vigor_class === "low" || z.vigor_class === "very_low");
  const highVigorZones = vigorZones.filter(z => z.vigor_class === "high" || z.vigor_class === "very_high");
  
  let dominantPattern: "uniform" | "gradient" | "patchy" | "edge_effects" | "random" = "uniform";
  if (coefficient > 0.15) dominantPattern = "patchy";
  else if (coefficient > 0.08) dominantPattern = "gradient";
  
  // Management recommendations
  const zoneSpecific = vigorZones
    .filter(z => z.management_priority === "immediate" || z.management_priority === "high")
    .map(z => `Zona ${z.vigor_class}: ${z.recommended_actions[0]}`);
  
  const fieldLevel = [
    uniformity < 70 ? "Implementare gestione a rateo variabile" : "Mantenere gestione uniforme",
    lowVigorZones.length > 0 ? "Priorità su zone a basso vigore" : "Ottimizzazione generale performance"
  ];
  
  const monitoringPriorities = [
    ...vigorZones.filter(z => z.scouting_frequency === "daily").map(z => `Controllo giornaliero zona ${z.vigor_class}`),
    ...vigorZones.filter(z => z.scouting_frequency === "weekly").map(z => `Controllo settimanale zona ${z.vigor_class}`)
  ].slice(0, 3);
  
  // Economic optimization
  const highPotentialPercent = highVigorZones.reduce((sum, z) => sum + z.area_percentage, 0);
  const investmentPriorities = [
    lowVigorZones.length > 0 ? "Recupero zone sottoperformanti" : "Ottimizzazione zone standard",
    highPotentialPercent < 30 ? "Miglioramento condizioni generali" : "Mantenimento zone eccellenti"
  ];
  
  return {
    overall_uniformity: Math.round(uniformity),
    vigor_zones: vigorZones,
    spatial_trends: {
      dominant_pattern: dominantPattern,
      variability_coefficient: Math.round(coefficient * 1000) / 1000,
      hot_spots: highVigorZones.length,
      cold_spots: lowVigorZones.length
    },
    management_recommendations: {
      zone_specific: zoneSpecific,
      field_level: fieldLevel,
      monitoring_priorities: monitoringPriorities
    },
    economic_optimization: {
      high_potential_areas_percent: Math.round(highPotentialPercent),
      investment_priorities: investmentPriorities,
      expected_improvement_percent: Math.min(25, Math.max(5, (100 - uniformity) / 2))
    }
  };
}

export function generateScoutingPlan(
  variabilityAnalysis: VariabilityAnalysis,
  cropType: string
): ScoutingPlan {
  const priorityZones = variabilityAnalysis.vigor_zones
    .filter(z => z.management_priority === "immediate" || z.management_priority === "high")
    .map(z => z.zone_id);
  
  const inspectionSchedule = variabilityAnalysis.vigor_zones.map(zone => {
    const nextInspectionDays = getNextInspectionDays(zone.scouting_frequency);
    const inspectionType = getInspectionType(zone.vigor_class);
    const focusAreas = getFocusAreas(zone.vigor_class, cropType);
    
    return {
      zone_id: zone.zone_id,
      next_inspection_days: nextInspectionDays,
      inspection_type: inspectionType,
      focus_areas: focusAreas
    };
  });
  
  // Calculate resource allocation percentages
  const totalZones = variabilityAnalysis.vigor_zones.length;
  const highPriorityZones = variabilityAnalysis.vigor_zones.filter(z => 
    z.management_priority === "immediate" || z.management_priority === "high"
  ).length;
  const mediumPriorityZones = variabilityAnalysis.vigor_zones.filter(z => 
    z.management_priority === "medium"
  ).length;
  
  const highPriorityPercent = totalZones > 0 ? Math.round((highPriorityZones / totalZones) * 60) : 0;
  const mediumPriorityPercent = totalZones > 0 ? Math.round((mediumPriorityZones / totalZones) * 30) : 0;
  const lowPriorityPercent = 100 - highPriorityPercent - mediumPriorityPercent;
  
  return {
    priority_zones: priorityZones,
    inspection_schedule: inspectionSchedule,
    resource_allocation: {
      high_priority_time_percent: Math.max(20, highPriorityPercent),
      medium_priority_time_percent: Math.max(15, mediumPriorityPercent),
      low_priority_time_percent: Math.max(10, lowPriorityPercent)
    }
  };
}

function getNextInspectionDays(frequency: "daily" | "weekly" | "biweekly" | "monthly"): number {
  const dayMap = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30
  };
  return dayMap[frequency];
}

function getInspectionType(vigor: keyof typeof VIGOR_THRESHOLDS): "visual" | "sampling" | "detailed" {
  if (vigor === "very_low" || vigor === "low") return "detailed";
  if (vigor === "medium") return "sampling";
  return "visual";
}

function getFocusAreas(vigor: keyof typeof VIGOR_THRESHOLDS, cropType: string): string[] {
  const focusMap = {
    very_low: ["Sintomi stress", "Malattie", "Parassiti", "Condizioni suolo"],
    low: ["Nutrizione", "Irrigazione", "Sviluppo vegetativo"],
    medium: ["Uniformità", "Stato generale"],
    high: ["Mantenimento condizioni", "Possibili eccessi"],
    very_high: ["Stabilità performance", "Parametri qualitativi"]
  };
  
  return focusMap[vigor];
}