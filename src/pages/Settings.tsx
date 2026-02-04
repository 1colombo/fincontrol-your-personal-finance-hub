import { useState } from 'react';
import { Download, Upload, Edit2, Trash2, Plus } from 'lucide-react';
import { useProfiles, Profile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { ExportCSVDialog } from '@/components/settings/ExportCSVDialog';
import { ImportCSVDialog } from '@/components/settings/ImportCSVDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Settings() {
  const { profiles, createProfile, updateProfile, deleteProfile } = useProfiles();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleCreateProfile = async (data: { name: string; description?: string; color?: string }) => {
    await createProfile(data);
  };

  const handleUpdateProfile = async (data: { name?: string; description?: string; color?: string }) => {
    if (editingProfile) {
      await updateProfile(editingProfile.id, data);
    }
  };

  const handleDeleteProfile = async () => {
    if (deleteProfileId) {
      await deleteProfile(deleteProfileId);
      setDeleteProfileId(null);
    }
  };

  const handleExportCSV = () => {
    setExportOpen(true);
  };

  const handleImportCSV = () => {
    setImportOpen(true);
  };

  const handleOpenNew = () => {
    setEditingProfile(null);
    setFormOpen(true);
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground tracking-tight">
          Configurações
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie perfis e configurações do sistema
        </p>
      </div>

      {/* CSV Management */}
      <Card className="card-finance animate-slide-up" style={{ animationDelay: '50ms' }}>
        <CardHeader>
          <CardTitle className="font-display">Importação e Exportação</CardTitle>
          <CardDescription>
            Importe dados de planilhas ou exporte relatórios em CSV
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExportCSV} className="gap-2 press-effect">
              <Download className="h-4 w-4" />
              Exportar Relatório (CSV)
            </Button>
            <Button variant="outline" onClick={handleImportCSV} className="gap-2 press-effect">
              <Upload className="h-4 w-4" />
              Importar Planilha
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Profile Management */}
      <Card className="card-finance animate-slide-up" style={{ animationDelay: '100ms' }}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display">Perfis Financeiros</CardTitle>
            <CardDescription>
              Gerencie os perfis de pessoas ou clientes cujas finanças você administra
            </CardDescription>
          </div>
          <Button onClick={handleOpenNew} className="gap-2 press-effect">
            <Plus className="h-4 w-4" />
            Novo Perfil
          </Button>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum perfil cadastrado. Crie seu primeiro perfil para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-all duration-200 hover-lift"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm transition-transform duration-200"
                      style={{ backgroundColor: profile.color }}
                    >
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{profile.name}</p>
                      {profile.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                          {profile.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(profile)}
                      className="transition-colors duration-200"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive transition-colors duration-200"
                      onClick={() => setDeleteProfileId(profile.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Form Dialog */}
      <ProfileForm
        open={formOpen}
        onOpenChange={setFormOpen}
        profile={editingProfile}
        onSubmit={editingProfile ? handleUpdateProfile : handleCreateProfile}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProfileId} onOpenChange={() => setDeleteProfileId(null)}>
        <AlertDialogContent className="animate-scale-in">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este perfil? Todos os lançamentos associados 
              também serão excluídos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProfile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Dialogs */}
      <ExportCSVDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
