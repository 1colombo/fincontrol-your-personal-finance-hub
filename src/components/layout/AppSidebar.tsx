import { LayoutDashboard, Receipt, Upload, Settings, LogOut, Moon, Sun, ChevronDown, Plus, User } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles, Profile } from '@/contexts/ProfileContext';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { CoinLogo } from '@/components/ui/CoinLogo';
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
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const { profiles, selectedProfile, setSelectedProfile } = useProfiles();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <Sidebar className="border-r-0 gradient-sidebar">
      <SidebarHeader className="p-5 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3 animate-fade-in">
          <CoinLogo size="md" />
          <div>
            <h1 className="font-display font-bold text-lg text-sidebar-foreground tracking-tight">
              Nexus
            </h1>
            <p className="text-xs text-sidebar-muted">Gestão Financeira</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-5">
        {/* Profile Switcher */}
        <div className="mb-6 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <p className="text-xs font-medium text-sidebar-muted uppercase tracking-wider mb-2.5 px-2">
            Perfil Ativo
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between h-12 px-3 bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-accent-foreground rounded-lg border border-sidebar-border/30 transition-all duration-200 press-effect"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold text-white shadow-sm transition-transform duration-200" 
                    style={{ backgroundColor: selectedProfile?.color || 'hsl(230, 60%, 40%)' }}
                  >
                    {selectedProfile?.name?.charAt(0).toUpperCase() || 'P'}
                  </div>
                  <span className="truncate font-medium text-sm">
                    {selectedProfile?.name || 'Selecionar Perfil'}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 animate-scale-in">
              {profiles.map(profile => (
                <DropdownMenuItem 
                  key={profile.id} 
                  onClick={() => setSelectedProfile(profile)} 
                  className={cn(
                    'cursor-pointer transition-colors duration-150',
                    selectedProfile?.id === profile.id && 'bg-accent'
                  )}
                >
                  <div 
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold text-white mr-2 shadow-sm" 
                    style={{ backgroundColor: profile.color }}
                  >
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  {profile.name}
                </DropdownMenuItem>
              ))}
              {profiles.length === 0 && (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  Nenhum perfil encontrado
                </DropdownMenuItem>
              )}
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
          <p className="text-xs font-medium text-sidebar-muted uppercase tracking-wider mb-2.5 px-2">
            Menu
          </p>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item, index) => (
                <SidebarMenuItem 
                  key={item.title}
                  className="animate-slide-up"
                  style={{ animationDelay: `${100 + index * 50}ms` }}
                >
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 press-effect',
                        isActive(item.url) 
                          ? 'bg-sidebar-primary/20 text-sidebar-primary font-medium border border-sidebar-primary/20' 
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border/50">
        {/* Theme Toggle */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
          className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground mb-2 transition-all duration-200 press-effect"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4" />
              <span>Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              <span>Modo Escuro</span>
            </>
          )}
        </Button>

        {/* User Info & Logout */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-sidebar-accent/40 border border-sidebar-border/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center border border-sidebar-primary/30">
              <User className="h-4 w-4 text-sidebar-primary" />
            </div>
            <span className="text-sm text-sidebar-foreground/90 truncate">
              {user?.email?.split('@')[0] || 'Usuário'}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={signOut} 
            className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
