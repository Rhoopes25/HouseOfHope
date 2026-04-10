import { Outlet, Link, useNavigate } from 'react-router-dom';
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
  LayoutDashboard, Users, HandCoins, BarChart3, Share2, Heart, LogOut, Home, MapPinned, ScrollText,
} from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';

const adminNav = [
  { title: 'Admin Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Caseload Inventory', url: '/admin/caseload', icon: Users },
  { title: 'Process Recording', url: '/admin/process-recording', icon: ScrollText },
  { title: 'Visitations & Conferences', url: '/admin/field-ops', icon: MapPinned },
  { title: 'Donors & Contributions', url: '/admin/donors', icon: HandCoins },
  { title: 'Reports & Analytics', url: '/admin/reports', icon: BarChart3 },
  { title: 'Social Media Analytics', url: '/admin/social-media', icon: Share2 },
];

function AdminSidebarContent() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <div className="flex items-center gap-2 px-1">
                <Heart className="h-4 w-4 text-primary shrink-0" />
                <span className="font-display font-bold text-sm">House of Hope</span>
              </div>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-3">
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

        <SidebarGroup className="mt-auto">
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
                <SidebarMenuButton onClick={() => { void logout(); navigate('/'); }}>
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
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebarContent />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 flex items-center border-b bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-40">
            <SidebarTrigger className="mr-4" />
            <h2 className="font-display text-lg font-semibold text-foreground">Admin Dashboard</h2>
            <div className="ml-auto">
              <span className="text-sm text-muted-foreground">
                {user?.displayName ? `Hi, ${user.displayName}` : 'Hi'}
              </span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 gradient-warm">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
      </div>
    </SidebarProvider>
  );
}