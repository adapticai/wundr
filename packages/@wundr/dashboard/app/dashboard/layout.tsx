'use client'

import * as React from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Header } from '@/components/layout/header'
import { useWebSocket } from '@/lib/websocket'
import { useToast } from '@/hooks/use-toast'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { connect, disconnect } = useWebSocket()
  const { toast } = useToast()
  
  // Initialize WebSocket connection
  React.useEffect(() => {
    const initWebSocket = async () => {
      try {
        await connect()
        toast({
          title: 'Connected',
          description: 'Real-time data connection established',
        })
      } catch (error) {
        console.error('WebSocket connection failed:', error)
        toast({
          title: 'Connection Failed',
          description: 'Unable to establish real-time connection',
          variant: 'destructive'
        })
      }
    }
    
    initWebSocket()
    
    return () => {
      disconnect()
    }
  }, [connect, disconnect, toast])
  
  return (
    <div className="min-h-screen bg-background">
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          <AppSidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  )
}