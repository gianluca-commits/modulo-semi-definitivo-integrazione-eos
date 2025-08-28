import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

export interface UserProfile {
  id: string;
  is_admin: boolean;
  email?: string;
  full_name?: string;
}

interface UserTypeSwitcherProps {
  currentMode?: 'user' | 'admin';
}

export const UserTypeSwitcher: React.FC<UserTypeSwitcherProps> = ({ currentMode = 'user' }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (error) {
            console.error('Error loading profile:', error);
          } else {
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleModeSwitch = (mode: 'user' | 'admin') => {
    if (mode === 'admin') {
      if (!profile?.is_admin) {
        toast({
          title: "Accesso negato",
          description: "Non hai i privilegi di amministratore",
          variant: "destructive"
        });
        return;
      }
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  if (loading) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={currentMode === 'user' ? 'default' : 'outline'}
        size="sm"
        onClick={() => handleModeSwitch('user')}
        className="flex items-center gap-2"
      >
        <User className="w-4 h-4" />
        Utente
      </Button>
      
      {profile?.is_admin && (
        <Button
          variant={currentMode === 'admin' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleModeSwitch('admin')}
          className="flex items-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Admin
        </Button>
      )}
      
      {profile && (
        <Badge variant="secondary" className="ml-2">
          {profile.email || 'User'}
        </Badge>
      )}
    </div>
  );
};