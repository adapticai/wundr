"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ZoomIn, ZoomOut, Download, Maximize2, RotateCcw } from "lucide-react"

interface DependencyData {
  name: string
  version: string
  latestVersion: string
  type: 'dependency' | 'devDependency' | 'peerDependency'
  size: number
  vulnerabilities: number
  dependencies: string[]
}

interface DependencyGraphProps {
  dependencies: DependencyData[]
}

interface GraphNode {
  id: string
  name: string
  type: 'dependency' | 'devDependency' | 'peerDependency'
  vulnerabilities: number
  size: number
  x: number
  y: number
  fixed?: boolean
}

interface GraphLink {
  source: string
  target: string
  type: 'depends_on'
}

export function DependencyGraph({ dependencies }: DependencyGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [layoutType, setLayoutType] = useState("force")
  const [filterType, setFilterType] = useState("all")
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    generateGraph()
  }, [generateGraph])

  useEffect(() => {
    drawGraph()
  }, [drawGraph])

  const generateGraph = useCallback(() => {
    // Filter dependencies based on selected type
    const filteredDeps = dependencies.filter(dep => 
      filterType === "all" || dep.type === filterType
    )

    // Create nodes
    const graphNodes: GraphNode[] = filteredDeps.map((dep, index) => ({
      id: dep.name,
      name: dep.name,
      type: dep.type,
      vulnerabilities: dep.vulnerabilities,
      size: dep.size,
      x: Math.random() * 400 + 200,
      y: Math.random() * 400 + 200
    }))

    // Create links based on dependencies
    const graphLinks: GraphLink[] = []
    filteredDeps.forEach(dep => {
      dep.dependencies.forEach(depName => {
        if (filteredDeps.some(d => d.name === depName)) {
          graphLinks.push({
            source: dep.name,
            target: depName,
            type: 'depends_on'
          })
        }
      })
    })

    setNodes(graphNodes)
    setLinks(graphLinks)

    // Apply layout algorithm
    if (layoutType === "force") {
      applyForceLayout(graphNodes, graphLinks)
    } else if (layoutType === "circular") {
      applyCircularLayout(graphNodes)
    } else if (layoutType === "hierarchical") {
      applyHierarchicalLayout(graphNodes, graphLinks)
    }
  }, [dependencies, filterType, layoutType, applyForceLayout, applyCircularLayout, applyHierarchicalLayout])

  const applyForceLayout = useCallback((nodes: GraphNode[], links: GraphLink[]) => {
    // Simple force-directed layout simulation
    const iterations = 100
    const k = 50 // Ideal distance between connected nodes
    const c = 0.01 // Cooling factor

    for (let iter = 0; iter < iterations; iter++) {
      // Calculate repulsive forces between all nodes
      nodes.forEach(node1 => {
        let fx = 0, fy = 0
        
        nodes.forEach(node2 => {
          if (node1.id !== node2.id) {
            const dx = node1.x - node2.x
            const dy = node1.y - node2.y
            const distance = Math.sqrt(dx * dx + dy * dy) || 1
            const force = k * k / distance
            fx += (dx / distance) * force
            fy += (dy / distance) * force
          }
        })

        // Apply forces
        node1.x += fx * c
        node1.y += fy * c
      })

      // Calculate attractive forces for connected nodes
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source)
        const target = nodes.find(n => n.id === link.target)
        
        if (source && target) {
          const dx = target.x - source.x
          const dy = target.y - source.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1
          const force = distance * distance / k
          const fx = (dx / distance) * force * c
          const fy = (dy / distance) * force * c
          
          source.x += fx
          source.y += fy
          target.x -= fx
          target.y -= fy
        }
      })
    }

    setNodes([...nodes])
  }, [])

  const applyCircularLayout = useCallback((nodes: GraphNode[]) => {
    const centerX = 400
    const centerY = 300
    const radius = 150

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length
      node.x = centerX + radius * Math.cos(angle)
      node.y = centerY + radius * Math.sin(angle)
    })

    setNodes([...nodes])
  }, [])

  const applyHierarchicalLayout = useCallback((nodes: GraphNode[], links: GraphLink[]) => {
    // Simple hierarchical layout - arrange by dependency levels
    const levels: { [key: string]: number } = {}
    const visited = new Set<string>()

    // Calculate dependency levels
    const calculateLevel = (nodeId: string, level = 0): number => {
      if (visited.has(nodeId)) return levels[nodeId] || 0
      visited.add(nodeId)

      const dependents = links.filter(l => l.target === nodeId)
      const maxLevel = dependents.reduce((max, link) => {
        const sourceLevel = calculateLevel(link.source, level + 1)
        return Math.max(max, sourceLevel + 1)
      }, level)

      levels[nodeId] = maxLevel
      return maxLevel
    }

    nodes.forEach(node => calculateLevel(node.id))

    // Position nodes based on levels
    const levelNodes: { [key: number]: GraphNode[] } = {}
    nodes.forEach(node => {
      const level = levels[node.id] || 0
      if (!levelNodes[level]) levelNodes[level] = []
      levelNodes[level].push(node)
    })

    Object.keys(levelNodes).forEach(levelStr => {
      const level = parseInt(levelStr)
      const levelNodeList = levelNodes[level]
      const y = 100 + level * 120
      
      levelNodeList.forEach((node, index) => {
        node.x = 100 + (index + 1) * (600 / (levelNodeList.length + 1))
        node.y = y
      })
    })

    setNodes([...nodes])
  }, [])

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply transformations
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Draw links
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    links.forEach(link => {
      const source = nodes.find(n => n.id === link.source)
      const target = nodes.find(n => n.id === link.target)
      
      if (source && target) {
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.stroke()

        // Draw arrow
        const angle = Math.atan2(target.y - source.y, target.x - source.x)
        const arrowLength = 10
        ctx.beginPath()
        ctx.moveTo(target.x, target.y)
        ctx.lineTo(
          target.x - arrowLength * Math.cos(angle - Math.PI / 6),
          target.y - arrowLength * Math.sin(angle - Math.PI / 6)
        )
        ctx.moveTo(target.x, target.y)
        ctx.lineTo(
          target.x - arrowLength * Math.cos(angle + Math.PI / 6),
          target.y - arrowLength * Math.sin(angle + Math.PI / 6)
        )
        ctx.stroke()
      }
    })

    // Draw nodes
    nodes.forEach(node => {
      const radius = Math.min(Math.max(Math.log(node.size / 1000) * 3 + 8, 8), 25)
      
      // Node color based on type and vulnerabilities
      let fillColor = '#60a5fa' // Default blue
      if (node.type === 'devDependency') fillColor = '#34d399' // Green
      if (node.type === 'peerDependency') fillColor = '#fbbf24' // Yellow
      if (node.vulnerabilities > 0) fillColor = '#ef4444' // Red for vulnerabilities

      // Highlight selected node
      if (selectedNode && selectedNode.id === node.id) {
        ctx.strokeStyle = '#1d4ed8'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI)
        ctx.stroke()
      }

      // Draw node
      ctx.fillStyle = fillColor
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw node label
      ctx.fillStyle = '#333'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(node.name, node.x, node.y + radius + 15)

      // Draw vulnerability indicator
      if (node.vulnerabilities > 0) {
        ctx.fillStyle = '#dc2626'
        ctx.beginPath()
        ctx.arc(node.x + radius - 3, node.y - radius + 3, 6, 0, 2 * Math.PI)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(node.vulnerabilities.toString(), node.x + radius - 3, node.y - radius + 7)
      }
    })

    ctx.restore()
  }, [nodes, links, zoom, pan, selectedNode])

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left - pan.x) / zoom
    const y = (event.clientY - rect.top - pan.y) / zoom

    // Find clicked node
    const clickedNode = nodes.find(node => {
      const radius = Math.min(Math.max(Math.log(node.size / 1000) * 3 + 8, 8), 25)
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2)
      return distance <= radius
    })

    setSelectedNode(clickedNode || null)
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y })
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPan({
        x: event.clientX - dragStart.x,
        y: event.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.3))
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setSelectedNode(null)
  }

  const exportGraph = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = 'dependency-graph.png'
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Dependency Graph Visualization</CardTitle>
              <CardDescription>
                Interactive visualization of project dependencies and their relationships
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={layoutType} onValueChange={setLayoutType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="force">Force Layout</SelectItem>
                  <SelectItem value="circular">Circular Layout</SelectItem>
                  <SelectItem value="hierarchical">Hierarchical Layout</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dependencies</SelectItem>
                  <SelectItem value="dependency">Dependencies Only</SelectItem>
                  <SelectItem value="devDependency">Dev Dependencies Only</SelectItem>
                  <SelectItem value="peerDependency">Peer Dependencies Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {/* Graph Canvas */}
            <div className="flex-1">
              <div 
                ref={containerRef}
                className="relative border rounded-lg bg-gray-50 dark:bg-gray-900 overflow-hidden"
                style={{ height: '600px' }}
              >
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="cursor-move"
                  onClick={handleCanvasClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
                
                {/* Graph Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportGraph}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg">
                  <h4 className="font-semibold text-sm mb-2">Legend</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                      <span>Dependencies</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      <span>Dev Dependencies</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <span>Peer Dependencies</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <span>Has Vulnerabilities</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Node Details Panel */}
            {selectedNode && (
              <Card className="w-80">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedNode.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">{selectedNode.type}</Badge>
                    {selectedNode.vulnerabilities > 0 && (
                      <Badge variant="destructive">
                        {selectedNode.vulnerabilities} vulnerabilities
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm">Package Size</h4>
                    <p className="text-sm text-muted-foreground">
                      {(selectedNode.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-sm">Dependencies</h4>
                    <p className="text-sm text-muted-foreground">
                      {links.filter(l => l.source === selectedNode.id).length} outgoing connections
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm">Dependents</h4>
                    <p className="text-sm text-muted-foreground">
                      {links.filter(l => l.target === selectedNode.id).length} incoming connections
                    </p>
                  </div>

                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => setSelectedNode(null)}
                  >
                    Close Details
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Graph Statistics */}
          <div className="mt-4 grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{nodes.length}</div>
              <div className="text-sm text-muted-foreground">Nodes</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{links.length}</div>
              <div className="text-sm text-muted-foreground">Connections</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{nodes.filter(n => n.vulnerabilities > 0).length}</div>
              <div className="text-sm text-muted-foreground">Vulnerable</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{zoom.toFixed(1)}x</div>
              <div className="text-sm text-muted-foreground">Zoom Level</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}