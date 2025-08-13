import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Shapes, Trash2, Edit3, Hand } from 'lucide-react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

interface CustomDrawControlsProps {
  draw: MapboxDraw | null;
  currentMode: string;
  onModeChange: (mode: string) => void;
  className?: string;
}

export const CustomDrawControls: React.FC<CustomDrawControlsProps> = ({
  draw,
  currentMode,
  onModeChange,
  className = ""
}) => {
  
  const handleDrawPolygon = () => {
    if (draw) {
      draw.changeMode('draw_polygon');
      onModeChange('draw_polygon');
    }
  };
  
  const handleSelectMode = () => {
    if (draw) {
      draw.changeMode('simple_select');
      onModeChange('simple_select');
    }
  };
  
  const handleDeleteAll = () => {
    if (draw) {
      draw.deleteAll();
      onModeChange('draw_polygon');
      draw.changeMode('draw_polygon');
    }
  };
  
  if (!draw) return null;
  
  return (
    <Card className={`absolute top-4 left-4 z-10 ${className}`}>
      <div className="flex flex-col">
        <Button
          variant={currentMode === 'draw_polygon' ? 'default' : 'ghost'}
          size="sm"
          onClick={handleDrawPolygon}
          className="rounded-none rounded-t-md border-b border-border"
          title="Disegna poligono"
        >
          <Shapes className="h-4 w-4" />
        </Button>
        
        <Button
          variant={currentMode === 'simple_select' ? 'default' : 'ghost'}
          size="sm"
          onClick={handleSelectMode}
          className="rounded-none border-b border-border"
          title="Seleziona"
        >
          <Hand className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDeleteAll}
          className="rounded-none rounded-b-md text-destructive hover:text-destructive-foreground hover:bg-destructive"
          title="Elimina tutto"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};