import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GoogleAddressSearchProps {
  onLocationSelect: (center: [number, number], bbox?: [number, number, number, number]) => void;
}

export const GoogleAddressSearch: React.FC<GoogleAddressSearchProps> = ({
  onLocationSelect
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const { toast } = useToast();
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const isSelectingRef = useRef(false);

  useEffect(() => {
    const initializeServices = () => {
      if (!window.google?.maps?.places) return;

      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      
      // Create a dummy map element for PlacesService (required by API)
      const dummyMap = new google.maps.Map(document.createElement('div'));
      placesServiceRef.current = new google.maps.places.PlacesService(dummyMap);
    };

    if (window.google?.maps?.places) {
      initializeServices();
    } else {
      const checkGoogleMaps = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(checkGoogleMaps);
          initializeServices();
        }
      }, 100);

      return () => clearInterval(checkGoogleMaps);
    }
  }, []);

  const searchAddresses = async (searchQuery: string) => {
    if (!searchQuery.trim() || !autocompleteServiceRef.current) return;

    setLoading(true);
    
    try {
      const request: google.maps.places.AutocompletionRequest = {
        input: searchQuery,
        types: ['geocode'],
        componentRestrictions: { country: 'it' }, // Restrict to Italy
      };

      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (predictions, status) => {
          setLoading(false);
          
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              toast({
                title: "Errore nella ricerca",
                description: "Impossibile cercare l'indirizzo. Riprova.",
                variant: "destructive",
              });
            }
          }
        }
      );
    } catch (error) {
      setLoading(false);
      console.error('Error searching addresses:', error);
      toast({
        title: "Errore",
        description: "Errore durante la ricerca dell'indirizzo",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isSelectingRef.current) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchAddresses(query);
      }, 500);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleLocationSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesServiceRef.current) return;

    isSelectingRef.current = true;
    setQuery(prediction.description);
    setShowSuggestions(false);

    const request: google.maps.places.PlaceDetailsRequest = {
      placeId: prediction.place_id,
      fields: ['geometry', 'formatted_address'],
    };

    placesServiceRef.current.getDetails(request, (place, status) => {
      isSelectingRef.current = false;
      
      if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        let bbox: [number, number, number, number] | undefined;
        
        if (place.geometry.viewport) {
          const northeast = place.geometry.viewport.getNorthEast();
          const southwest = place.geometry.viewport.getSouthWest();
          bbox = [southwest.lng(), southwest.lat(), northeast.lng(), northeast.lat()];
        }
        
        onLocationSelect([lat, lng], bbox);
        
        toast({
          title: "Indirizzo trovato",
          description: prediction.description,
        });
      } else {
        toast({
          title: "Errore",
          description: "Impossibile ottenere i dettagli dell'indirizzo",
          variant: "destructive",
        });
      }
    });
  };


  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Cerca un indirizzo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute top-full z-50 mt-1 w-full border shadow-lg">
          <CardContent className="p-0">
            <div className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={suggestion.place_id}
                  variant="ghost"
                  className="w-full justify-start rounded-none text-left font-normal h-auto p-3 border-b border-border last:border-b-0"
                  onClick={() => handleLocationSelect(suggestion)}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">{suggestion.structured_formatting.main_text}</span>
                    <span className="text-sm text-muted-foreground">
                      {suggestion.structured_formatting.secondary_text}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};