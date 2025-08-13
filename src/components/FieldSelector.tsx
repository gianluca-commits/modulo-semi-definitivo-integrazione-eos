import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MapPin, Crop } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EosField {
  id: string;
  name: string;
  area_ha: number;
  crop_type: string;
  coordinates: [number, number][];
  geojson: string | null;
}

interface FieldSelectorProps {
  onFieldSelect: (field: EosField) => void;
  selectedFieldId?: string;
}

export const FieldSelector: React.FC<FieldSelectorProps> = ({ onFieldSelect, selectedFieldId }) => {
  const [fields, setFields] = useState<EosField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFields = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("eos-proxy", {
        body: { action: "fields" }
      });

      if (error) {
        throw new Error(error.message || "Failed to fetch fields");
      }

      if (!data?.fields) {
        throw new Error("No fields data received");
      }

      setFields(data.fields);
      toast({
        title: "Campi caricati",
        description: `Trovati ${data.fields.length} campi nel tuo account EOS`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      console.error("Error fetching EOS fields:", err);
      toast({
        title: "Errore caricamento campi",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, []);

  const handleFieldSelect = (field: EosField) => {
    onFieldSelect(field);
    toast({
      title: "Campo selezionato",
      description: `${field.name} - ${field.area_ha} ha`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crop className="w-5 h-5" />
          Campi EOS Disponibili
        </CardTitle>
        <CardDescription>
          Seleziona un campo esistente dal tuo account EOS Data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Caricamento campi EOS...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchFields}
                className="ml-2"
              >
                Riprova
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && fields.length === 0 && (
          <Alert>
            <AlertDescription>
              Nessun campo trovato nel tuo account EOS. Assicurati di aver configurato almeno un campo.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && fields.length > 0 && (
          <div className="space-y-3">
            {fields.map((field) => (
              <div
                key={field.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-muted ${
                  selectedFieldId === field.id ? "bg-muted border-primary" : ""
                }`}
                onClick={() => handleFieldSelect(field)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{field.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{field.area_ha} ha</Badge>
                    <Badge variant="outline">{field.crop_type}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Campo ID: {field.id}
                </p>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && (
          <Button 
            variant="outline" 
            onClick={fetchFields}
            className="w-full"
          >
            Ricarica Campi
          </Button>
        )}
      </CardContent>
    </Card>
  );
};