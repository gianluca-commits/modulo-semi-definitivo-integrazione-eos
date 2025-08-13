import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Zap, AlertTriangle, CheckCircle } from "lucide-react";
import { EosSummary, EOS_PARAMETER_PROFILES } from "@/lib/eos";

interface EosParameterDisplayProps {
  summary?: EosSummary;
  optimizationProfile?: string;
}

export const EosParameterDisplay: React.FC<EosParameterDisplayProps> = ({ 
  summary, 
  optimizationProfile 
}) => {
  const meta = summary?.meta;
  const usedFilters = meta?.used_filters;
  const optimizationUsed = meta?.optimization_used;
  const escalationUsed = meta?.escalation_used;
  const escalationLevel = meta?.escalation_level;
  const attemptNumber = meta?.attempt_number;
  const observationCount = meta?.observation_count || 0;

  // Get profile description if we know which one was used
  const getProfileDescription = () => {
    if (escalationLevel && escalationLevel in EOS_PARAMETER_PROFILES) {
      return EOS_PARAMETER_PROFILES[escalationLevel].description;
    }
    if (optimizationProfile && optimizationProfile in EOS_PARAMETER_PROFILES) {
      return EOS_PARAMETER_PROFILES[optimizationProfile].description;
    }
    return null;
  };

  const profileDescription = getProfileDescription();

  // Don't show if no metadata available
  if (!meta && !optimizationProfile) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Parametri EOS Utilizzati</CardTitle>
          {optimizationUsed && (
            <Badge variant="secondary" className="text-xs">
              Ottimizzati
            </Badge>
          )}
        </div>
        {profileDescription && (
          <CardDescription className="text-xs">
            {profileDescription}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {/* Parameter Values */}
        {usedFilters && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground">Copertura Nubi</div>
              <Badge variant="outline" className="text-xs font-mono">
                {usedFilters.max_cloud_cover_in_aoi}%
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Esclusione Pixel</div>
              <Badge variant="outline" className="text-xs font-mono">
                {usedFilters.exclude_cover_pixels ? "Sì" : "No"}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Livello Masking</div>
              <Badge variant="outline" className="text-xs font-mono">
                {usedFilters.cloud_masking_level}
              </Badge>
            </div>
          </div>
        )}

        {/* Status Messages */}
        <div className="space-y-2">
          {optimizationUsed && !escalationUsed && (
            <Alert className="py-2">
              <CheckCircle className="h-3 w-3" />
              <AlertDescription className="text-xs">
                Parametri ottimizzati automaticamente per la località e stagione
                {attemptNumber && ` (tentativo ${attemptNumber})`}
              </AlertDescription>
            </Alert>
          )}

          {escalationUsed && (
            <Alert variant="default" className="py-2">
              <Info className="h-3 w-3" />
              <AlertDescription className="text-xs">
                Utilizzati parametri più permissivi per ottenere dati satellitari
                {attemptNumber && ` (tentativo ${attemptNumber})`}
              </AlertDescription>
            </Alert>
          )}

          {meta?.all_attempts_failed && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-3 w-3" />
              <AlertDescription className="text-xs">
                Nessun dato satellitare disponibile con tutti i livelli di parametri
              </AlertDescription>
            </Alert>
          )}

          {observationCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>{observationCount} osservazioni satellitari trovate</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};