// Intelligent alerts system for proactive field management
import { EosSummary, VegetationPoint } from "./eos";
import { getNitrogenAlert, NitrogenAlert } from "./nitrogenAnalysis";
import { getWaterStressAlert } from "./eosAnalysis";

export interface CriticalAlert {
  id: string;
  type: "water_stress" | "nitrogen_deficiency" | "growth_anomaly" | "weather_risk" | "phenology_delay";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  impact: {
    yield_loss_percent: number;
    economic_loss_eur_ha: number;
    time_sensitive: boolean;
  };
  recommendation: {
    action: string;
    urgency_hours: number;
    cost_eur_ha: number;
    expected_roi: number;
  };
  triggers: {
    threshold_value: number;
    current_value: number;
    trend_direction: "stable" | "improving" | "worsening";
  };
  created_at: string;
}

export interface AlertsBundle {
  critical_alerts: CriticalAlert[];
  total_risk_score: number; // 0-100
  immediate_actions: string[];
  economic_summary: {
    potential_loss: number;
    intervention_cost: number;
    net_benefit: number;
  };
}

// Generate comprehensive alerts based on all field data
export function generateIntelligentAlerts(
  summary: EosSummary,
  timeSeries: VegetationPoint[],
  cropType: string,
  marketPrice: number = 250 // €/ton default
): AlertsBundle {
  const alerts: CriticalAlert[] = [];
  const currentTime = new Date().toISOString();

  // 1. Water stress alerts  
  const currentNDMI = summary.ndmi_data.current_value || 0;
  if (currentNDMI < 0.2) {
    const waterAlert = getWaterStressAlert(currentNDMI, undefined, cropType);
    if (waterAlert.urgency >= 3) {
      alerts.push({
        id: `water_${Date.now()}`,
        type: "water_stress",
        severity: waterAlert.urgency >= 4 ? "critical" : "high",
        title: "Stress Idrico Rilevato",
        description: `NDMI: ${currentNDMI.toFixed(3)} - ${waterAlert.description}`,
        impact: {
          yield_loss_percent: waterAlert.urgency * 5,
          economic_loss_eur_ha: waterAlert.urgency * 5 * 0.01 * 5 * marketPrice, // 5 tons/ha average
          time_sensitive: true
        },
        recommendation: {
          action: "Irrigazione immediata 25-35mm",
          urgency_hours: waterAlert.urgency >= 4 ? 24 : 48,
          cost_eur_ha: 45,
          expected_roi: 3.5
        },
        triggers: {
          threshold_value: 0.25,
          current_value: currentNDMI,
          trend_direction: "worsening"
        },
        created_at: currentTime
      });
    }
  }

  // 2. Nitrogen deficiency alerts
  const latestPoint = timeSeries[timeSeries.length - 1];
  if (latestPoint?.ReCI) {
    const previousPoint = timeSeries[timeSeries.length - 2];
    const nitrogenAlert = getNitrogenAlert(latestPoint.ReCI, previousPoint?.ReCI, cropType);
    
    if (nitrogenAlert.severity === "critical" || nitrogenAlert.severity === "warning") {
      alerts.push({
        id: `nitrogen_${Date.now()}`,
        type: "nitrogen_deficiency",
        severity: nitrogenAlert.severity === "critical" ? "critical" : "medium",
        title: nitrogenAlert.title,
        description: nitrogenAlert.description,
        impact: {
          yield_loss_percent: nitrogenAlert.severity === "critical" ? 20 : 10,
          economic_loss_eur_ha: (nitrogenAlert.severity === "critical" ? 20 : 10) * 0.01 * 5 * marketPrice,
          time_sensitive: true
        },
        recommendation: {
          action: nitrogenAlert.action,
          urgency_hours: nitrogenAlert.urgency_days * 24,
          cost_eur_ha: 75,
          expected_roi: 2.8
        },
        triggers: {
          threshold_value: 1.2,
          current_value: latestPoint.ReCI,
          trend_direction: (previousPoint?.ReCI && latestPoint.ReCI < previousPoint.ReCI) ? "worsening" : "stable"
        },
        created_at: currentTime
      });
    }
  }

  // 3. Growth anomaly detection
  if (timeSeries.length >= 3) {
    const recentNDVI = timeSeries.slice(-3).map(p => p.NDVI);
    const avgRecent = recentNDVI.reduce((a, b) => a + b, 0) / recentNDVI.length;
    const expectedNDVI = getExpectedNDVIForSeason(cropType);
    
    if (avgRecent < expectedNDVI * 0.8) {
      alerts.push({
        id: `growth_${Date.now()}`,
        type: "growth_anomaly",
        severity: avgRecent < expectedNDVI * 0.6 ? "high" : "medium",
        title: "Anomalia nella Crescita",
        description: `NDVI medio recente: ${avgRecent.toFixed(3)} vs atteso: ${expectedNDVI.toFixed(3)}`,
        impact: {
          yield_loss_percent: ((expectedNDVI - avgRecent) / expectedNDVI) * 100,
          economic_loss_eur_ha: ((expectedNDVI - avgRecent) / expectedNDVI) * 5 * marketPrice,
          time_sensitive: true
        },
        recommendation: {
          action: "Ispezione campo + analisi fogliare",
          urgency_hours: 72,
          cost_eur_ha: 35,
          expected_roi: 4.2
        },
        triggers: {
          threshold_value: expectedNDVI * 0.8,
          current_value: avgRecent,
          trend_direction: recentNDVI[2] < recentNDVI[0] ? "worsening" : "stable"
        },
        created_at: currentTime
      });
    }
  }

  // 4. Weather risk alerts  
  const weatherRisks = summary.weather_risks;
  if (weatherRisks.heat_stress_risk === "high" || weatherRisks.temperature_stress_days && weatherRisks.temperature_stress_days > 3) {
    alerts.push({
      id: `weather_${Date.now()}`,
      type: "weather_risk",
      severity: "high",
      title: "Rischio Stress Termico",
      description: `Rilevato alto rischio di stress da calore con ${weatherRisks.temperature_stress_days || 0} giorni critici`,
      impact: {
        yield_loss_percent: 8,
        economic_loss_eur_ha: 8 * 0.01 * 5 * marketPrice,
        time_sensitive: true
      },
      recommendation: {
        action: "Irrigazione preventiva + ombreggiamento",
        urgency_hours: 48,
        cost_eur_ha: 60,
        expected_roi: 2.1
      },
      triggers: {
        threshold_value: 3, // giorni di stress
        current_value: weatherRisks.temperature_stress_days || 0,
        trend_direction: "worsening"
      },
      created_at: currentTime
    });
  }

  // Calculate risk score and economic summary
  const totalRiskScore = Math.min(100, alerts.reduce((score, alert) => {
    const severityWeight = { low: 5, medium: 15, high: 25, critical: 40 };
    return score + severityWeight[alert.severity];
  }, 0));

  const economicSummary = alerts.reduce((acc, alert) => ({
    potential_loss: acc.potential_loss + alert.impact.economic_loss_eur_ha,
    intervention_cost: acc.intervention_cost + alert.recommendation.cost_eur_ha,
    net_benefit: acc.net_benefit + (alert.impact.economic_loss_eur_ha - alert.recommendation.cost_eur_ha)
  }), { potential_loss: 0, intervention_cost: 0, net_benefit: 0 });

  const immediateActions = alerts
    .filter(alert => alert.recommendation.urgency_hours <= 48)
    .map(alert => alert.recommendation.action);

  return {
    critical_alerts: alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    }),
    total_risk_score: totalRiskScore,
    immediate_actions: [...new Set(immediateActions)], // Remove duplicates
    economic_summary: economicSummary
  };
}

// Get expected NDVI based on crop type and season
function getExpectedNDVIForSeason(cropType: string): number {
  const currentMonth = new Date().getMonth() + 1;
  
  const seasonalNDVI: Record<string, Record<number, number>> = {
    wheat: {
      3: 0.35, 4: 0.55, 5: 0.75, 6: 0.65, 7: 0.45, 8: 0.25,
      9: 0.15, 10: 0.35, 11: 0.25, 12: 0.20, 1: 0.20, 2: 0.25
    },
    wine: {
      3: 0.25, 4: 0.45, 5: 0.65, 6: 0.75, 7: 0.70, 8: 0.65,
      9: 0.50, 10: 0.35, 11: 0.20, 12: 0.15, 1: 0.15, 2: 0.20
    },
    olive: {
      3: 0.30, 4: 0.50, 5: 0.65, 6: 0.70, 7: 0.65, 8: 0.60,
      9: 0.55, 10: 0.45, 11: 0.35, 12: 0.30, 1: 0.25, 2: 0.25
    }
  };

  return seasonalNDVI[cropType]?.[currentMonth] || seasonalNDVI.wheat[currentMonth] || 0.5;
}

// Priority sorting for alerts
export function prioritizeAlerts(alerts: CriticalAlert[]): CriticalAlert[] {
  return alerts.sort((a, b) => {
    // First by severity
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by economic impact
    const economicDiff = b.impact.economic_loss_eur_ha - a.impact.economic_loss_eur_ha;
    if (economicDiff !== 0) return economicDiff;

    // Finally by urgency
    return a.recommendation.urgency_hours - b.recommendation.urgency_hours;
  });
}