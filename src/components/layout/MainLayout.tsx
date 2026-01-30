import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { ProfileProvider } from '@/contexts/ProfileContext';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <ProfileProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <main className="flex-1 flex flex-col">
            <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 lg:px-6 sticky top-0 z-40">
              <SidebarTrigger className="lg:hidden" />
            </header>
            <div className="flex-1 p-4 lg:p-6 overflow-auto">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </ProfileProvider>
  );
}
