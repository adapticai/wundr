// Dashboard-specific types

export interface DashboardLayout {
  collapsed: boolean
  sidebarWidth: number
}

export interface NavigationItem {
  title: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge?: string | null
  isActive?: boolean
}

export interface DashboardSection {
  title: string
  items: NavigationItem[]
}

export interface UserProfile {
  name: string
  email: string
  role: string
  avatar?: string
  initials: string
}

export interface DashboardState {
  layout: DashboardLayout
  user: UserProfile
  lastUpdated: Date
}

export interface WidgetConfig {
  id: string
  type: 'chart' | 'metric' | 'table' | 'custom'
  title: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  config: Record<string, any>
}

export interface DashboardCustomization {
  theme: 'light' | 'dark' | 'system'
  layout: 'grid' | 'flex'
  widgets: WidgetConfig[]
  refreshInterval: number
  autoRefresh: boolean
}