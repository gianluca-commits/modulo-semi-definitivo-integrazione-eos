import { supabase } from '@/integrations/supabase/client';

interface GoogleMapsConfig {
  googleMapsApiKey: string;
  success: boolean;
}

class GoogleMapsLoader {
  private static instance: GoogleMapsLoader;
  private loadPromise: Promise<void> | null = null;
  private isLoaded = false;
  private apiKey: string | null = null;

  private constructor() {}

  static getInstance(): GoogleMapsLoader {
    if (!GoogleMapsLoader.instance) {
      GoogleMapsLoader.instance = new GoogleMapsLoader();
    }
    return GoogleMapsLoader.instance;
  }

  async load(): Promise<void> {
    if (this.isLoaded) {
      return Promise.resolve();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loadGoogleMaps();
    return this.loadPromise;
  }

  private async loadGoogleMaps(): Promise<void> {
    try {
      // Fetch API key from Supabase function
      if (!this.apiKey) {
        const { data, error } = await supabase.functions.invoke<GoogleMapsConfig>('google-maps-config');
        
        if (error) {
          throw new Error(`Failed to fetch Google Maps config: ${error.message}`);
        }

        if (!data?.googleMapsApiKey) {
          throw new Error('Google Maps API key not available');
        }

        this.apiKey = data.googleMapsApiKey;
      }

      // Check if Google Maps is already loaded
      if (window.google?.maps) {
        this.isLoaded = true;
        return;
      }

      // Create script element and load Google Maps
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=geometry,drawing,places&loading=async`;
        
        script.onload = () => {
          this.isLoaded = true;
          resolve();
        };
        
        script.onerror = () => {
          this.loadPromise = null;
          reject(new Error('Failed to load Google Maps script'));
        };

        document.head.appendChild(script);
      });
    } catch (error) {
      this.loadPromise = null;
      throw error;
    }
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  isGoogleMapsLoaded(): boolean {
    return this.isLoaded && !!window.google?.maps;
  }
}

export const googleMapsLoader = GoogleMapsLoader.getInstance();