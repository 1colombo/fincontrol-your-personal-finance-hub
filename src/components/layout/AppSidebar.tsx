import { LayoutDashboard, Receipt, Upload, Settings, LogOut, Moon, Sun, ChevronDown, Plus, User } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles, Profile } from '@/contexts/ProfileContext';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const navItems = [{
  title: 'Dashboard',
  url: '/',
  icon: LayoutDashboard
}, {
  title: 'Lançamentos',
  url: '/lancamentos',
  icon: Receipt
}, {
  title: 'Importação',
  url: '/importacao',
  icon: Upload
}, {
  title: 'Configurações',
  url: '/configuracoes',
  icon: Settings
}];
export function AppSidebar() {
  const location = useLocation();
  const {
    theme,
    setTheme
  } = useTheme();
  const {
    signOut,
    user
  } = useAuth();
  const {
    profiles,
    selectedProfile,
    setSelectedProfile
  } = useProfiles();
  const isActive = (path: string) => location.pathname === path;
  return <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-display font-bold text-lg">N</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-sidebar-foreground">Nexus</h1>
            <p className="text-xs text-sidebar-muted">Gestão Financeira</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        {/* Profile Switcher */}
        <div className="mb-6">
          <p className="text-xs font-medium text-sidebar-muted uppercase tracking-wider mb-2 px-2">
            Perfil Ativo
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-12 px-3 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-accent-foreground rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold text-sidebar-primary-foreground" style={{
                  backgroundColor: selectedProfile?.color || '#0891b2'
                }}>
                    {selectedProfile?.name?.charAt(0).toUpperCase() || 'P'}
                  </div>
                  <span className="truncate font-medium">
                    {selectedProfile?.name || 'Selecionar Perfil'}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {profiles.map(profile => <DropdownMenuItem key={profile.id} onClick={() => setSelectedProfile(profile)} className={cn('cursor-pointer', selectedProfile?.id === profile.id && 'bg-accent')}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold text-white mr-2" style={{
                backgroundColor: profile.color
              }}>
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  {profile.name}
                </DropdownMenuItem>)}
              {profiles.length === 0 && <DropdownMenuItem disabled>
                  Nenhum perfil encontrado
                </DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to="/configuracoes" className="flex items-center cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar novo perfil
                </NavLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation */}
        <SidebarGroup>
          <p className="text-xs font-medium text-sidebar-muted uppercase tracking-wider mb-2 px-2">
            Menu
          </p>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200', isActive(item.url) ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {/* Theme Toggle */}
        <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mb-2">
          {theme === 'dark' ? <>
              <Sun className="h-4 w-4" />
              <span>Modo Claro</span>
            </> : <>
              <Moon className="h-4 w-4" />
              <span>Modo Escuro</span>
            </>}
        </Button>

        {/* User Info & Logout */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-sidebar-accent">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <User className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="text-sm text-sidebar-accent-foreground truncate">
              {user?.email?.split('@')[0] || 'Usuário'}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-border">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>;
}