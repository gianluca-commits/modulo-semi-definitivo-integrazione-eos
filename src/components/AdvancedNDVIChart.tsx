import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  ReferenceLine,
  Area,
  ComposedChart
} from "recharts";
import { VegetationPoint } from "@/lib/eos";
import { CROP_THRESHOLDS, getSeasonalContext, analyzeTemporalTrends } from "@/lib/eosAnalysis";

interface AdvancedNDVIChartProps {
  timeSeries: VegetationPoint[];
  cropType: string;
  isDemo?: boolean;
}

export const AdvancedNDVIChart: React.FC<AdvancedNDVIChartProps> = ({
  timeSeries,
  cropType,
  isDemo
}) => {
  const thresholds = CROP_THRESHOLDS[cropType] || CROP_THRESHOLDS.wheat;
  const seasonal = getSeasonalContext(cropType);
  
  // Analyze trends for both indicators
  const ndviAnalysis = analyzeTemporalTrends(timeSeries, "NDVI", cropType);
  const ndmiAnalysis = analyzeTemporalTrends(timeSeries, "NDMI", cropType);
  
  const chartData = useMemo(() => {
    return timeSeries.map(point => ({
      ...point,
      formattedDate: new Date(point.date).toLocaleDateString('it-IT', {
        month: 'short',
        day: 'numeric'
      }),
      // Add threshold lines
      excellent: thresholds.ndvi.excellent,
      good: thresholds.ndvi.good,
      moderate: thresholds.ndvi.moderate,
      critical: thresholds.ndvi.critical,
      optimalNDMI: thresholds.ndmi.optimal,
      stressNDMI: thresholds.ndmi.stress_threshold,
      criticalNDMI: thresholds.ndmi.critical_threshold
    }));
  }, [timeSeries, thresholds]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>NDVI: {data.NDVI?.toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>NDMI: {data.NDMI?.toFixed(3)}</span>
            </div>
            {/* Health Status Indicator */}
            <div className="mt-2 text-xs">
              {data.NDVI >= thresholds.ndvi.excellent && "🟢 Vegetazione eccellente"}
              {data.NDVI >= thresholds.ndvi.good && data.NDVI < thresholds.ndvi.excellent && "🟡 Vegetazione buona"}
              {data.NDVI >= thresholds.ndvi.moderate && data.NDVI < thresholds.ndvi.good && "🟠 Vegetazione moderata"}
              {data.NDVI < thresholds.ndvi.moderate && "🔴 Vegetazione critica"}
            </div>
            <div className="text-xs">
              {data.NDMI >= thresholds.ndmi.optimal && "💧 Idratazione ottimale"}
              {data.NDMI >= thresholds.ndmi.stress_threshold && data.NDMI < thresholds.ndmi.optimal && "⚠️ Stress idrico lieve"}
              {data.NDMI < thresholds.ndmi.stress_threshold && "🚨 Stress idrico severo"}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const latestNDVI = timeSeries[timeSeries.length - 1]?.NDVI || 0;
  const latestNDMI = timeSeries[timeSeries.length - 1]?.NDMI || 0;

  return (
    <Card className="border border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>Trend NDVI/NDMI Avanzato</span>
            {isDemo && <Badge variant="secondary" className="text-xs">Demo</Badge>}
          </CardTitle>
          <div className="flex gap-2 text-xs">
            {ndviAnalysis && (
              <Badge variant={ndviAnalysis.trendDirection === "improving" ? "default" : "secondary"}>
                NDVI {ndviAnalysis.trendDirection === "improving" ? "↗️" : ndviAnalysis.trendDirection === "declining" ? "↘️" : "➡️"}
              </Badge>
            )}
            {ndmiAnalysis && (
              <Badge variant={ndmiAnalysis.trendDirection === "declining" ? "destructive" : "secondary"}>
                NDMI {ndmiAnalysis.trendDirection === "improving" ? "↗️" : ndmiAnalysis.trendDirection === "declining" ? "↘️" : "➡️"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Status Summary */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">NDVI Attuale</div>
              <div className="text-lg font-bold text-green-600">{latestNDVI.toFixed(3)}</div>
              <div className="text-xs text-muted-foreground">
                Ottimale: {seasonal.optimalNDVI.toFixed(2)} ({seasonal.expectedPhase})
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">NDMI Attuale</div>
              <div className="text-lg font-bold text-blue-600">{latestNDMI.toFixed(3)}</div>
              <div className="text-xs text-muted-foreground">
                Ottimale: {thresholds.ndmi.optimal.toFixed(2)} per {cropType}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="formattedDate" 
                  fontSize={12}
                  stroke="#64748b"
                />
                <YAxis 
                  domain={[0, 1]}
                  fontSize={12}
                  stroke="#64748b"
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Threshold Reference Lines for NDVI */}
                <ReferenceLine 
                  y={thresholds.ndvi.excellent} 
                  stroke="#22c55e" 
                  strokeDasharray="2 2"
                  label={{ value: "Eccellente", position: "right", fontSize: 10 }}
                />
                <ReferenceLine 
                  y={thresholds.ndvi.good} 
                  stroke="#84cc16" 
                  strokeDasharray="2 2"
                  label={{ value: "Buono", position: "right", fontSize: 10 }}
                />
                <ReferenceLine 
                  y={thresholds.ndvi.moderate} 
                  stroke="#f59e0b" 
                  strokeDasharray="2 2"
                  label={{ value: "Moderato", position: "right", fontSize: 10 }}
                />
                <ReferenceLine 
                  y={thresholds.ndvi.critical} 
                  stroke="#ef4444" 
                  strokeDasharray="2 2"
                  label={{ value: "Critico", position: "right", fontSize: 10 }}
                />
                
                {/* NDVI Line */}
                <Line
                  type="monotone"
                  dataKey="NDVI"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ fill: "#22c55e", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: "#22c55e", strokeWidth: 2 }}
                />
                
                {/* NDMI Line */}
                <Line
                  type="monotone"
                  dataKey="NDMI"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", strokeWidth: 1, r: 3 }}
                  activeDot={{ r: 5, stroke: "#3b82f6", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Trend Analysis Summary */}
          {(ndviAnalysis || ndmiAnalysis) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-muted/30 p-3 rounded">
              {ndviAnalysis && (
                <div className="space-y-1">
                  <div className="font-medium text-green-600">Analisi NDVI:</div>
                  <div>Trend: {ndviAnalysis.trendDirection === "improving" ? "📈 Miglioramento" : 
                              ndviAnalysis.trendDirection === "declining" ? "📉 Peggioramento" : "➡️ Stabile"}</div>
                  <div>Velocità: {ndviAnalysis.velocityLevel}</div>
                  <div>Proiezione 7gg: {ndviAnalysis.projectedValue7d.toFixed(3)}</div>
                  <div>Confidenza: {ndviAnalysis.confidence}%</div>
                </div>
              )}
              {ndmiAnalysis && (
                <div className="space-y-1">
                  <div className="font-medium text-blue-600">Analisi NDMI:</div>
                  <div>Trend: {ndmiAnalysis.trendDirection === "improving" ? "📈 Miglioramento" : 
                              ndmiAnalysis.trendDirection === "declining" ? "📉 Peggioramento" : "➡️ Stabile"}</div>
                  <div>Velocità: {ndmiAnalysis.velocityLevel}</div>
                  <div>Proiezione 7gg: {ndmiAnalysis.projectedValue7d.toFixed(3)}</div>
                  {ndmiAnalysis.trendDirection === "declining" && ndmiAnalysis.velocityLevel === "rapid" && (
                    <div className="text-red-600 font-medium">⚠️ Allerta: Calo rapido NDMI</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-1 bg-green-500 rounded"></div>
              <span>NDVI (Vegetazione)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-1 bg-blue-500 rounded"></div>
              <span>NDMI (Umidità)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-1 border border-gray-400 border-dashed"></div>
              <span>Soglie ottimali</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};