import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

interface ProfileContextType {
  profiles: Profile[];
  selectedProfile: Profile | null;
  setSelectedProfile: (profile: Profile | null) => void;
  isLoading: boolean;
  createProfile: (data: { name: string; description?: string; color?: string }) => Promise<void>;
  updateProfile: (id: string, data: { name?: string; description?: string; color?: string }) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  refetch: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading, refetch } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Profile[];
    },
  });

  useEffect(() => {
    if (profiles.length > 0 && !selectedProfile) {
      setSelectedProfile(profiles[0]);
    }
  }, [profiles, selectedProfile]);

  const createProfileMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          name: data.name,
          description: data.description || null,
          color: data.color || '#0891b2',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Perfil criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar perfil: ' + error.message);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; color?: string } }) => {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Perfil atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar perfil: ' + error.message);
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setSelectedProfile(null);
      toast.success('Perfil excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir perfil: ' + error.message);
    },
  });

  const value: ProfileContextType = {
    profiles,
    selectedProfile,
    setSelectedProfile,
    isLoading,
    createProfile: async (data) => {
      await createProfileMutation.mutateAsync(data);
    },
    updateProfile: async (id, data) => {
      await updateProfileMutation.mutateAsync({ id, data });
    },
    deleteProfile: async (id) => {
      await deleteProfileMutation.mutateAsync(id);
    },
    refetch,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfiles must be used within a ProfileProvider');
  }
  return context;
}
