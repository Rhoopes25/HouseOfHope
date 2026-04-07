import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard, Users, HandCoins, BarChart3, Share2, Heart, LogOut, Home,
} from 'lucide-react';

const adminNav = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Caseload', url: '/admin/caseload', icon: Users },
  { title: 'Donors', url: '/admin/donors', icon: HandCoins },
  { title: 'Reports', url: '/admin/reports', icon: BarChart3 },
  { title: 'Social Media', url: '/admin/social-media', icon: Share2 },
];

function AdminSidebarContent() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
      <Sidebar collapsible="icon">
        <SidebarContent className="flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
          <SidebarGroup className="flex-1 overflow-y-auto">
            <SidebarGroupLabel>
              {!collapsed && (
                  <div className="flex items-center gap-2 px-1">
                    <Heart className="h-4 w-4 text-primary" />
                    <span className="font-display font-bold text-sm">House of Hope</span>
                  </div>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map(item => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                            to={item.url}
                            end={item.url === '/admin'}
                            className="hover:bg-sidebar-accent"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="shrink-0 pb-4 border-t pt-2">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/" className="hover:bg-sidebar-accent">
                      <Home className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Public Site</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => { logout(); navigate('/'); }}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Logout</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
  );
}

export function AdminLayout() {
  return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebarContent />
          <div className="flex-1 flex flex-col">
            <header className="h-14 flex items-center border-b bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-40">
              <SidebarTrigger className="mr-4" />
              <h2 className="font-display text-lg font-semibold text-foreground">Admin Portal</h2>
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-8 gradient-warm">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
  );
}