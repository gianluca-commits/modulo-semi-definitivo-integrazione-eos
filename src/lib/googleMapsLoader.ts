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
  private callbackName: string = 'initGoogleMapsCallback';

  private constructor() {
    // Set up global callback
    (window as any)[this.callbackName] = this.onGoogleMapsLoaded.bind(this);
  }

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

  private onGoogleMapsLoaded(): void {
    console.log('Google Maps API fully loaded with callback');
    this.isLoaded = true;
  }

  private async loadGoogleMaps(): Promise<void> {
    try {
      // Fetch API key from Supabase function
      if (!this.apiKey) {
        console.log('Fetching Google Maps API key...');
        const { data, error } = await supabase.functions.invoke<GoogleMapsConfig>('google-maps-config');
        
        if (error) {
          throw new Error(`Failed to fetch Google Maps config: ${error.message}`);
        }

        if (!data?.googleMapsApiKey) {
          throw new Error('Google Maps API key not available');
        }

        this.apiKey = data.googleMapsApiKey;
        console.log('Google Maps API key retrieved successfully');
      }

      // Check if Google Maps is already fully loaded
      if (this.isGoogleMapsFullyLoaded()) {
        console.log('Google Maps already loaded');
        this.isLoaded = true;
        return;
      }

      // Create script element and load Google Maps with callback
      return new Promise((resolve, reject) => {
        console.log('Loading Google Maps script...');
        
        // Store resolve/reject for the callback to use
        (window as any)._googleMapsResolve = resolve;
        (window as any)._googleMapsReject = reject;
        
        // Update callback to resolve the promise
        (window as any)[this.callbackName] = () => {
          console.log('Google Maps callback triggered');
          this.onGoogleMapsLoaded();
          
          // Wait a bit more for drawing manager to be ready
          setTimeout(() => {
            if (this.isGoogleMapsFullyLoaded()) {
              console.log('Google Maps fully loaded and ready');
              (window as any)._googleMapsResolve?.();
            } else {
              console.error('Google Maps loaded but drawing manager not available');
              (window as any)._googleMapsReject?.(new Error('Drawing manager not available'));
            }
          }, 100);
        };

        const script = document.createElement('script');
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=geometry,drawing,places&callback=${this.callbackName}`;
        
        script.onerror = () => {
          console.error('Failed to load Google Maps script');
          this.loadPromise = null;
          (window as any)._googleMapsReject?.(new Error('Failed to load Google Maps script'));
        };

        // Add timeout for slow networks
        const timeout = setTimeout(() => {
          console.error('Google Maps loading timeout');
          this.loadPromise = null;
          (window as any)._googleMapsReject?.(new Error('Google Maps loading timeout'));
        }, 10000);

        // Clear timeout on success
        const originalResolve = (window as any)._googleMapsResolve;
        (window as any)._googleMapsResolve = () => {
          clearTimeout(timeout);
          originalResolve?.();
        };

        document.head.appendChild(script);
      });
    } catch (error) {
      console.error('Error loading Google Maps:', error);
      this.loadPromise = null;
      throw error;
    }
  }

  private isGoogleMapsFullyLoaded(): boolean {
    return !!(
      window.google?.maps?.Map &&
      window.google?.maps?.MapTypeId &&
      window.google?.maps?.drawing?.DrawingManager &&
      window.google?.maps?.Polygon &&
      window.google?.maps?.LatLngBounds
    );
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  isGoogleMapsLoaded(): boolean {
    return this.isLoaded && this.isGoogleMapsFullyLoaded();
  }
}

export const googleMapsLoader = GoogleMapsLoader.getInstance();