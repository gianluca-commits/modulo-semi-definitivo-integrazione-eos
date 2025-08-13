import React, { useState, useCallback, useEffect } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { geocodeAddress } from '@/lib/mapbox';
import { useToast } from '@/hooks/use-toast';

interface AddressSearchProps {
  onLocationSelect: (center: [number, number], bbox?: [number, number, number, number]) => void;
  mapboxToken?: string;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({ 
  onLocationSelect, 
  mapboxToken 
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{
    place_name: string;
    center: [number, number];
    bbox?: [number, number, number, number];
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();

  const searchAddress = useCallback(async (searchQuery: string) => {
    console.log('Search triggered for:', searchQuery);
    
    if (!mapboxToken) {
      toast({
        title: "Token Mapbox mancante",
        description: "Configura il token Mapbox per utilizzare la ricerca indirizzi",
        variant: "destructive"
      });
      return;
    }

    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await geocodeAddress(searchQuery, mapboxToken);
      console.log('Search results:', result.suggestions.length);
      setSuggestions(result.suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Errore ricerca",
        description: "Impossibile cercare l'indirizzo",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [mapboxToken]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        searchAddress(query.trim());
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query, searchAddress]);

  const handleLocationSelect = (suggestion: any) => {
    setQuery(suggestion.place_name);
    setShowSuggestions(false);
    onLocationSelect(suggestion.center, suggestion.bbox);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Cerca un indirizzo (es. Via Roma, Milano)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
          onBlur={() => setTimeout(() => setShowSuggestions(false), 300)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto">
          <div className="p-1">
            {suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-start text-left h-auto p-3 whitespace-normal"
                onClick={() => handleLocationSelect(suggestion)}
              >
                <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-muted-foreground" />
                <span className="text-sm">{suggestion.place_name}</span>
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};