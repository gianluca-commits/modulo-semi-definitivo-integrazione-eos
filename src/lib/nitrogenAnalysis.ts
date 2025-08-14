// Nitrogen analysis using ReCI (Red-edge Chlorophyll Index)
import { VegetationPoint } from "./eos";
import { CROP_THRESHOLDS } from "./eosAnalysis";

export interface NitrogenStatus {
  level: "high" | "medium" | "low" | "deficient";
  color: string;
  description: string;
  recommendations: string[];
  fertilization: {
    needed: boolean;
    timing: string;
    amount: string;
    type: string[];
  };
}

export interface NitrogenAlert {
  severity: "none" | "info" | "warning" | "critical";
  title: string;
  description: string;
  action: string;
  economic_impact: string;
  urgency_days: number;
}

// Analyze nitrogen status using ReCI values
export function getNitrogenStatus(reci: number, cropType: string): NitrogenStatus {
  const thresholds = CROP_THRESHOLDS[cropType] || CROP_THRESHOLDS.wheat;
  
  if (reci >= thresholds.reci.high_nitrogen) {
    return {
      level: "high",
      color: "text-green-600",
      description: "Livelli di azoto ottimali",
      recommendations: [
        "Mantieni il programma di fertilizzazione attuale",
        "Monitora per evitare eccessi"
      ],
      fertilization: {
        needed: false,
        timing: "Non necessaria",
        amount: "0 kg/ha",
        type: []
      }
    };
  } else if (reci >= thresholds.reci.medium_nitrogen) {
    return {
      level: "medium",
      color: "text-yellow-600",
      description: "Livelli di azoto moderati",
      recommendations: [
        "Considera fertilizzazione supplementare",
        "Monitora l'evoluzione nelle prossime settimane"
      ],
      fertilization: {
        needed: true,
        timing: "Entro 10-15 giorni",
        amount: "30-50 kg/ha",
        type: ["Urea", "Nitrato di ammonio"]
      }
    };
  } else if (reci >= thresholds.reci.low_nitrogen) {
    return {
      level: "low",
      color: "text-orange-600",
      description: "Carenza di azoto moderata",
      recommendations: [
        "Fertilizzazione azotata necessaria",
        "Considera applicazione fogliare per risultati rapidi"
      ],
      fertilization: {
        needed: true,
        timing: "Entro 7 giorni",
        amount: "50-80 kg/ha",
        type: ["Urea", "Nitrato di ammonio", "Fertilizzante fogliare"]
      }
    };
  } else {
    return {
      level: "deficient",
      color: "text-red-600",
      description: "Carenza severa di azoto",
      recommendations: [
        "Intervento urgente necessario",
        "Combina fertilizzazione al suolo e fogliare",
        "Monitora giornalmente l'evoluzione"
      ],
      fertilization: {
        needed: true,
        timing: "Immediata (entro 2-3 giorni)",
        amount: "80-120 kg/ha",
        type: ["Urea", "Nitrato di ammonio", "Fertilizzante fogliare", "Fertilizzante liquido"]
      }
    };
  }
}

// Generate nitrogen alert based on ReCI trend and current levels
export function getNitrogenAlert(
  currentReci: number, 
  previousReci: number | undefined, 
  cropType: string
): NitrogenAlert {
  const status = getNitrogenStatus(currentReci, cropType);
  const trend = previousReci ? currentReci - previousReci : 0;
  
  if (status.level === "deficient" || (status.level === "low" && trend < -0.1)) {
    return {
      severity: "critical",
      title: "Carenza Azoto Critica",
      description: `ReCI: ${currentReci.toFixed(2)} - Livelli di azoto insufficienti per crescita ottimale`,
      action: "Fertilizzazione urgente necessaria",
      economic_impact: trend < -0.1 ? "Perdita potenziale: 15-25% della resa" : "Perdita potenziale: 10-15% della resa",
      urgency_days: 3
    };
  } else if (status.level === "low" || trend < -0.05) {
    return {
      severity: "warning",
      title: "Attenzione: Livelli Azoto Bassi",
      description: `ReCI: ${currentReci.toFixed(2)} - Tendenza verso carenza nutrizionale`,
      action: "Pianifica fertilizzazione entro 7 giorni",
      economic_impact: "Perdita potenziale: 5-10% della resa",
      urgency_days: 7
    };
  } else if (status.level === "medium" && trend > 0) {
    return {
      severity: "info",
      title: "Nutrizione in Miglioramento",
      description: `ReCI: ${currentReci.toFixed(2)} - Livelli di azoto in crescita`,
      action: "Continua monitoraggio",
      economic_impact: "Trend positivo per ottimizzazione resa",
      urgency_days: 14
    };
  } else {
    return {
      severity: "none",
      title: "Livelli Azoto Stabili",
      description: `ReCI: ${currentReci.toFixed(2)} - Situazione nutrizionale sotto controllo`,
      action: "Mantieni programma attuale",
      economic_impact: "Nessun impatto negativo previsto",
      urgency_days: 30
    };
  }
}

// Calculate fertilization cost and ROI
export function calculateFertilizationROI(
  status: NitrogenStatus,
  expectedYieldTonsHa: number,
  cropMarketPrice: number
): {
  cost: number;
  expectedBenefit: number;
  roi: number;
  paybackDays: number;
} {
  if (!status.fertilization.needed) {
    return { cost: 0, expectedBenefit: 0, roi: 0, paybackDays: 0 };
  }

  // Extract amount in kg/ha
  const amountMatch = status.fertilization.amount.match(/(\d+)-?(\d+)?/);
  const avgAmount = amountMatch ? 
    (parseInt(amountMatch[1]) + (parseInt(amountMatch[2]) || parseInt(amountMatch[1]))) / 2 : 50;

  // Fertilizer cost (€/kg) - average for urea/ammonium nitrate
  const fertilizerCostPerKg = 1.2;
  const applicationCost = 25; // €/ha for application
  
  const totalCost = (avgAmount * fertilizerCostPerKg) + applicationCost;

  // Expected yield improvement based on nitrogen status
  const yieldImprovementPercent = {
    deficient: 0.20, // 20% improvement
    low: 0.15,       // 15% improvement
    medium: 0.08,    // 8% improvement
    high: 0.02       // 2% improvement
  }[status.level] || 0;

  const expectedBenefit = expectedYieldTonsHa * yieldImprovementPercent * cropMarketPrice * 1000; // Convert to €/ha
  const roi = totalCost > 0 ? (expectedBenefit - totalCost) / totalCost : 0;
  const paybackDays = totalCost > 0 ? (totalCost / (expectedBenefit / 120)) : 0; // Assume 120 days to harvest

  return {
    cost: totalCost,
    expectedBenefit,
    roi,
    paybackDays: Math.min(paybackDays, 120)
  };
}