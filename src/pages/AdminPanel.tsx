import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserTypeSwitcher } from "@/components/UserTypeSwitcher";
import { 
  Upload, 
  FileText, 
  Image, 
  MapPin, 
  Calendar,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database
} from "lucide-react";

interface UploadRecord {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  rows_imported?: number;
  created_at: string;
  updated_at: string;
}

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          navigate('/');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();

        if (!profile?.is_admin) {
          toast({
            title: "Accesso negato",
            description: "Non hai i privilegi di amministratore",
            variant: "destructive"
          });
          navigate('/');
          return;
        }

        setIsAdmin(true);
        await loadUploads();
      } catch (error) {
        console.error('Error checking admin access:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [navigate]);

  const loadUploads = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_uploads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUploads(data || []);
    } catch (error) {
      console.error('Error loading uploads:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare la lista dei file",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (file: File, type: string) => {
    if (!file) return;

    setUploading(type);
    
    try {
      // Record upload in database first
      const { data: uploadRecord, error: dbError } = await supabase
        .from('admin_uploads')
        .insert({
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          status: 'uploading'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Simulate file processing (in a real app, this would process the file)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update status to completed
      const { error: updateError } = await supabase
        .from('admin_uploads')
        .update({ 
          status: 'completed',
          rows_imported: Math.floor(Math.random() * 1000) + 100 // Mock data
        })
        .eq('id', uploadRecord.id);

      if (updateError) throw updateError;

      toast({
        title: "File caricato con successo",
        description: `${file.name} è stato elaborato correttamente`
      });

      await loadUploads();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Errore upload",
        description: "Si è verificato un errore durante il caricamento",
        variant: "destructive"
      });
    } finally {
      setUploading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Pannello Amministratore</h1>
          </div>
          <div className="flex items-center gap-2">
            <UserTypeSwitcher currentMode="admin" />
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Torna all'analisi
            </Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Upload Section */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* ISTAT Historical Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Dati ISTAT
              </CardTitle>
              <CardDescription>
                Carica dati storici di produttività agricola
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">
                  Formato: CSV con colonne provincia, coltura, produttività
                </Label>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'istat')}
                    disabled={uploading === 'istat'}
                    className="cursor-pointer"
                  />
                  {uploading === 'istat' && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Environmental Risk Maps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5" />
                Mappe di Rischio
              </CardTitle>
              <CardDescription>
                Carica mappe ambientali di rischio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">
                  Formato: XML con dati georeferenziati
                </Label>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".xml"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'risk-maps')}
                    disabled={uploading === 'risk-maps'}
                    className="cursor-pointer"
                  />
                  {uploading === 'risk-maps' && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Soil Characteristic Maps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Image className="w-5 h-5" />
                Mappe Suolo
              </CardTitle>
              <CardDescription>
                Carica caratteristiche pedologiche
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">
                  Formato: JPEG georeferenziati
                </Label>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".jpg,.jpeg"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'soil-maps')}
                    disabled={uploading === 'soil-maps'}
                    className="cursor-pointer"
                  />
                  {uploading === 'soil-maps' && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Crop Phenology Calendars */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5" />
                Calendari Fenologici
              </CardTitle>
              <CardDescription>
                Carica calendari di sviluppo colturale
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">
                  Formato: PDF con fasi fenologiche
                </Label>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'phenology')}
                    disabled={uploading === 'phenology'}
                    className="cursor-pointer"
                  />
                  {uploading === 'phenology' && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload History */}
        <Card>
          <CardHeader>
            <CardTitle>Storico Caricamenti</CardTitle>
            <CardDescription>
              Cronologia dei file caricati e processati
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nessun file caricato ancora</p>
              </div>
            ) : (
              <div className="space-y-3">
                {uploads.map((upload) => (
                  <div 
                    key={upload.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(upload.status)}
                      <div>
                        <p className="font-medium">{upload.filename}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(upload.size_bytes)} • {new Date(upload.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {upload.rows_imported && (
                        <Badge variant="secondary">
                          {upload.rows_imported} righe
                        </Badge>
                      )}
                      <Badge 
                        variant={
                          upload.status === 'completed' ? 'default' : 
                          upload.status === 'uploading' ? 'secondary' : 
                          'destructive'
                        }
                      >
                        {upload.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default AdminPanel;