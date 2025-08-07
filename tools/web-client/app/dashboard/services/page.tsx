"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWebSocket } from "@/hooks/use-websocket"
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Cpu, 
  Database, 
  Globe, 
  HardDrive, 
  MemoryStick, 
  Network,
  RefreshCw,
  Server,
  XCircle,
  Zap
} from 'lucide-react'

// Types for service monitoring data
interface ServiceHealth {
  id: string
  name: string
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  uptime: number
  responseTime: number
  lastCheck: string
  instances: ServiceInstance[]
  metrics: ServiceMetrics
  dependencies: string[]
}

interface ServiceInstance {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error'
  host: string
  port: number
  uptime: number
  memory: number
  cpu: number
  connections: number
  lastHealthCheck: string
}

interface ServiceMetrics {
  cpu: number
  memory: number
  disk: number
  network: {
    in: number
    out: number
  }
  requests: {
    total: number
    success: number
    error: number
  }
}

interface Alert {
  id: string
  serviceId: string
  serviceName: string
  type: 'warning' | 'critical' | 'info'
  message: string
  timestamp: string
  resolved: boolean
}

// Service Status Grid Component
const ServiceStatusGrid = ({ services, onRefresh }: { services: ServiceHealth[], onRefresh: () => void }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'critical': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Health Overview
          </CardTitle>
          <CardDescription>Real-time status of all services</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {services.map((service) => (
            <div key={service.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(service.status)}
                  <h3 className="font-semibold text-sm">{service.name}</h3>
                </div>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`} />
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span>{service.uptime.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Response:</span>
                  <span>{service.responseTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Instances:</span>
                  <span>{service.instances.length}</span>
                </div>
              </div>
              <Progress value={service.uptime} className="mt-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Uptime Cards Component
const UptimeCards = ({ services }: { services: ServiceHealth[] }) => {
  const totalUptime = services.length > 0 
    ? services.reduce((sum, service) => sum + service.uptime, 0) / services.length 
    : 0

  const healthyServices = services.filter(s => s.status === 'healthy').length
  const totalServices = services.length

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Uptime</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{totalUptime.toFixed(2)}%</div>
          <Progress value={totalUptime} className="mt-2" />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Healthy Services</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{healthyServices}/{totalServices}</div>
          <Progress value={totalServices > 0 ? (healthyServices / totalServices) * 100 : 0} className="mt-2" />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Instances</CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {services.reduce((sum, service) => sum + service.instances.length, 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Across {totalServices} services
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Resource Usage Charts Component
const ResourceUsageCharts = ({ services }: { services: ServiceHealth[] }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            CPU Usage by Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{service.name}</span>
                  <span className="text-sm text-muted-foreground">{service.metrics.cpu.toFixed(1)}%</span>
                </div>
                <Progress value={service.metrics.cpu} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MemoryStick className="h-5 w-5" />
            Memory Usage by Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{service.name}</span>
                  <span className="text-sm text-muted-foreground">{service.metrics.memory.toFixed(1)}%</span>
                </div>
                <Progress value={service.metrics.memory} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Service Instances List Component
const ServiceInstancesList = ({ services }: { services: ServiceHealth[] }) => {
  const allInstances = services.flatMap(service => 
    service.instances.map(instance => ({ ...instance, serviceName: service.name, serviceId: service.id }))
  )

  const getInstanceStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-100 text-green-800">Running</Badge>
      case 'stopped':
        return <Badge variant="secondary">Stopped</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Service Instances
        </CardTitle>
        <CardDescription>Individual service instance health and metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Instance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Host:Port</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Connections</TableHead>
                <TableHead>Last Check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allInstances.map((instance) => (
                <TableRow key={`${instance.serviceId}-${instance.id}`}>
                  <TableCell className="font-medium">{instance.serviceName}</TableCell>
                  <TableCell>{instance.name}</TableCell>
                  <TableCell>{getInstanceStatusBadge(instance.status)}</TableCell>
                  <TableCell>{instance.host}:{instance.port}</TableCell>
                  <TableCell>{instance.uptime.toFixed(2)}%</TableCell>
                  <TableCell>{instance.cpu.toFixed(1)}%</TableCell>
                  <TableCell>{instance.memory.toFixed(1)}%</TableCell>
                  <TableCell>{instance.connections}</TableCell>
                  <TableCell>{new Date(instance.lastHealthCheck).toLocaleTimeString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// Alert History Table Component
const AlertHistoryTable = ({ alerts }: { alerts: Alert[] }) => {
  const getAlertBadge = (type: string, resolved: boolean) => {
    if (resolved) {
      return <Badge variant="secondary">Resolved</Badge>
    }
    
    switch (type) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
      case 'info':
        return <Badge variant="outline">Info</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alert History
        </CardTitle>
        <CardDescription>Recent service alerts and notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="font-medium">{alert.serviceName}</TableCell>
                  <TableCell>{getAlertBadge(alert.type, alert.resolved)}</TableCell>
                  <TableCell>{alert.message}</TableCell>
                  <TableCell>{new Date(alert.timestamp).toLocaleString()}</TableCell>
                  <TableCell>
                    {alert.resolved ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Service Health Monitoring Dashboard Component
export default function ServicesPage() {
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 seconds

  // WebSocket for real-time updates
  const { isConnected, lastMessage, subscribe, unsubscribe } = useWebSocket({
    enabled: true,
    onConnect: () => {
      console.log('Connected to WebSocket for service monitoring')
      subscribe('services:health')
      subscribe('services:alerts')
    },
    onMessage: (message) => {
      if (message.type === 'service_health_update') {
        setServices(prev => 
          prev.map(service => 
            service.id === message.data.serviceId 
              ? { ...service, ...message.data.health }
              : service
          )
        )
      } else if (message.type === 'service_alert') {
        setAlerts(prev => [message.data, ...prev.slice(0, 49)]) // Keep last 50 alerts
      }
    }
  })

  // Fetch services data
  const fetchServicesData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch services health data
      const healthResponse = await fetch('/api/services?type=health')
      const healthData = await healthResponse.json()
      
      // Fetch metrics data
      const metricsResponse = await fetch('/api/services?type=metrics')
      const metricsData = await metricsResponse.json()
      
      // Fetch instances data
      const instancesResponse = await fetch('/api/services?type=instances')
      const instancesData = await instancesResponse.json()

      if (healthData.success && metricsData.success && instancesData.success) {
        // Mock service data structure for demonstration
        const mockServices: ServiceHealth[] = [
          {
            id: 'api-service',
            name: 'API Service',
            status: 'healthy',
            uptime: 99.87,
            responseTime: 45,
            lastCheck: new Date().toISOString(),
            instances: [
              {
                id: 'api-1',
                name: 'api-service-1',
                status: 'running',
                host: '10.0.1.10',
                port: 8080,
                uptime: 99.9,
                memory: 65.2,
                cpu: 12.5,
                connections: 245,
                lastHealthCheck: new Date().toISOString()
              }
            ],
            metrics: {
              cpu: 12.5,
              memory: 65.2,
              disk: 45.8,
              network: { in: 1024, out: 512 },
              requests: { total: 12450, success: 12398, error: 52 }
            },
            dependencies: ['database', 'cache']
          },
          {
            id: 'database',
            name: 'Database',
            status: 'warning',
            uptime: 98.45,
            responseTime: 120,
            lastCheck: new Date().toISOString(),
            instances: [
              {
                id: 'db-1',
                name: 'postgres-primary',
                status: 'running',
                host: '10.0.1.20',
                port: 5432,
                uptime: 98.45,
                memory: 78.9,
                cpu: 25.7,
                connections: 89,
                lastHealthCheck: new Date().toISOString()
              }
            ],
            metrics: {
              cpu: 25.7,
              memory: 78.9,
              disk: 67.3,
              network: { in: 2048, out: 1024 },
              requests: { total: 8760, success: 8720, error: 40 }
            },
            dependencies: []
          },
          {
            id: 'cache',
            name: 'Redis Cache',
            status: 'healthy',
            uptime: 99.95,
            responseTime: 5,
            lastCheck: new Date().toISOString(),
            instances: [
              {
                id: 'redis-1',
                name: 'redis-cache-1',
                status: 'running',
                host: '10.0.1.30',
                port: 6379,
                uptime: 99.95,
                memory: 45.2,
                cpu: 8.3,
                connections: 156,
                lastHealthCheck: new Date().toISOString()
              }
            ],
            metrics: {
              cpu: 8.3,
              memory: 45.2,
              disk: 23.1,
              network: { in: 512, out: 256 },
              requests: { total: 25600, success: 25598, error: 2 }
            },
            dependencies: []
          }
        ]

        setServices(mockServices)

        // Mock alerts data
        const mockAlerts: Alert[] = [
          {
            id: '1',
            serviceId: 'database',
            serviceName: 'Database',
            type: 'warning',
            message: 'High CPU usage detected (>25%)',
            timestamp: new Date(Date.now() - 300000).toISOString(),
            resolved: false
          },
          {
            id: '2',
            serviceId: 'api-service',
            serviceName: 'API Service',
            type: 'info',
            message: 'Service restarted successfully',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            resolved: true
          }
        ]

        setAlerts(mockAlerts)
      }
    } catch (error) {
      console.error('Failed to fetch services data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh functionality
  useEffect(() => {
    fetchServicesData()

    if (autoRefresh) {
      const interval = setInterval(fetchServicesData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchServicesData, autoRefresh, refreshInterval])

  if (loading && services.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading service health data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Service Health Monitoring</h1>
          <p className="text-muted-foreground">Real-time monitoring dashboard for all services</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <Zap className="h-4 w-4 mr-2" />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button onClick={fetchServicesData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Uptime Summary Cards */}
      <UptimeCards services={services} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ServiceStatusGrid services={services} onRefresh={fetchServicesData} />
        </TabsContent>

        <TabsContent value="instances" className="space-y-6">
          <ServiceInstancesList services={services} />
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <ResourceUsageCharts services={services} />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <AlertHistoryTable alerts={alerts} />
        </TabsContent>
      </Tabs>
    </div>
  )
}