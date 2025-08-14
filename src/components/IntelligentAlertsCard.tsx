import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  Clock, 
  TrendingDown, 
  Euro, 
  Droplets, 
  Sprout, 
  CloudRain,
  Activity,
  CheckCircle
} from "lucide-react";
import { AlertsBundle, CriticalAlert } from "@/lib/intelligentAlerts";

interface IntelligentAlertsCardProps {
  alertsBundle: AlertsBundle;
}

export function IntelligentAlertsCard({ alertsBundle }: IntelligentAlertsCardProps) {
  const getSeverityColor = (severity: CriticalAlert["severity"]) => {
    switch (severity) {
      case "critical": return "text-destructive";
      case "high": return "text-warning";
      case "medium": return "text-warning";
      case "low": return "text-muted-foreground";
    }
  };

  const getSeverityVariant = (severity: CriticalAlert["severity"]) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "secondary";
      case "medium": return "outline";
      case "low": return "outline";
    }
  };

  const getTypeIcon = (type: CriticalAlert["type"]) => {
    switch (type) {
      case "water_stress": return <Droplets className="h-4 w-4" />;
      case "nitrogen_deficiency": return <Sprout className="h-4 w-4" />;
      case "growth_anomaly": return <Activity className="h-4 w-4" />;
      case "weather_risk": return <CloudRain className="h-4 w-4" />;
      case "phenology_delay": return <Clock className="h-4 w-4" />;
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 70) return "text-destructive";
    if (score >= 40) return "text-warning";
    return "text-success";
  };

  const formatCurrency = (value: number) => `€${value.toFixed(0)}`;
  const formatUrgency = (hours: number) => {
    if (hours <= 24) return `${hours}h`;
    return `${Math.ceil(hours / 24)}gg`;
  };

  if (alertsBundle.critical_alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            Sistema di Allerte - Tutto OK
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription>
              Non sono state rilevate criticità che richiedono interventi immediati. 
              Continua il monitoraggio regolare.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Sistema di Allerte Intelligenti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Risk Score Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Punteggio di Rischio Totale</span>
            <Badge variant={alertsBundle.total_risk_score >= 70 ? "destructive" : alertsBundle.total_risk_score >= 40 ? "secondary" : "default"}>
              {alertsBundle.total_risk_score}/100
            </Badge>
          </div>
          <Progress value={alertsBundle.total_risk_score} className="h-3" />
          <p className={`text-sm font-medium ${getRiskScoreColor(alertsBundle.total_risk_score)}`}>
            {alertsBundle.total_risk_score >= 70 ? "Rischio Elevato - Intervento Urgente" :
             alertsBundle.total_risk_score >= 40 ? "Rischio Moderato - Monitoraggio Attivo" :
             "Rischio Basso - Situazione Controllata"}
          </p>
        </div>

        <Separator />

        {/* Economic Summary */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Perdita Potenziale</span>
            </div>
            <p className="font-bold text-destructive">
              {formatCurrency(alertsBundle.economic_summary.potential_loss)}/ha
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Euro className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Costo Interventi</span>
            </div>
            <p className="font-bold text-warning">
              {formatCurrency(alertsBundle.economic_summary.intervention_cost)}/ha
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Beneficio Netto</span>
            </div>
            <p className="font-bold text-success">
              {formatCurrency(alertsBundle.economic_summary.net_benefit)}/ha
            </p>
          </div>
        </div>

        {/* Immediate Actions */}
        {alertsBundle.immediate_actions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Azioni Immediate (48h)
            </h4>
            <div className="space-y-1">
              {alertsBundle.immediate_actions.map((action, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-warning/10 rounded text-sm">
                  <AlertTriangle className="h-3 w-3 text-warning" />
                  {action}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Critical Alerts List */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Allerte Attive ({alertsBundle.critical_alerts.length})</h4>
          {alertsBundle.critical_alerts.map((alert) => (
            <Alert key={alert.id} className={`border-l-4 ${
              alert.severity === "critical" ? "border-l-destructive" :
              alert.severity === "high" ? "border-l-warning" :
              "border-l-info"
            }`}>
              <div className="space-y-3">
                {/* Alert Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(alert.type)}
                    <AlertDescription className="font-medium">
                      {alert.title}
                    </AlertDescription>
                  </div>
                  <Badge variant={getSeverityVariant(alert.severity)}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                </div>

                {/* Alert Description */}
                <AlertDescription>{alert.description}</AlertDescription>

                {/* Impact and Recommendation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Impatto:</span>
                    <p className="text-destructive font-medium">
                      -{alert.impact.yield_loss_percent.toFixed(1)}% resa
                    </p>
                    <p className="text-destructive">
                      {formatCurrency(alert.impact.economic_loss_eur_ha)}/ha
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Raccomandazione:</span>
                    <p className="font-medium">{alert.recommendation.action}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Urgenza: {formatUrgency(alert.recommendation.urgency_hours)}
                    </div>
                  </div>
                </div>

                {/* Trend Information */}
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                  <span>
                    Soglia: {alert.triggers.threshold_value.toFixed(2)} | 
                    Attuale: {alert.triggers.current_value.toFixed(2)}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {alert.triggers.trend_direction === "worsening" ? "⬇️ Peggioramento" :
                     alert.triggers.trend_direction === "improving" ? "⬆️ Miglioramento" :
                     "➡️ Stabile"}
                  </Badge>
                </div>
              </div>
            </Alert>
          ))}
        </div>

        {/* Action Button */}
        {alertsBundle.critical_alerts.some(alert => alert.severity === "critical") && (
          <Button className="w-full" variant="destructive">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Pianifica Interventi Urgenti
          </Button>
        )}
      </CardContent>
    </Card>
  );
}