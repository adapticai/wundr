"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { useTheme } from "next-themes"
import { ZoomIn, ZoomOut, Maximize2, Download } from "lucide-react"

interface NetworkNode {
  id: string
  label: string
  type: "module" | "package" | "file"
  size?: number
  dependencies: string[]
}

interface NetworkLink {
  source: string
  target: string
  strength?: number
  type?: "import" | "export" | "circular"
}

interface DependencyNetworkProps {
  nodes: NetworkNode[]
  links: NetworkLink[]
  interactive?: boolean
  showLegend?: boolean
}

export function DependencyNetwork({ 
  nodes, 
  links, 
  interactive = true,
  showLegend = true 
}: DependencyNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const [zoom, setZoom] = useState(1)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const animationRef = useRef<number | undefined>(undefined)

  // Force-directed graph simulation
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Initialize node positions
    const nodePositions = new Map<string, { x: number; y: number; vx: number; vy: number }>()
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI
      const radius = Math.min(canvas.width, canvas.height) / 4
      nodePositions.set(node.id, {
        x: canvas.width / 2 + radius * Math.cos(angle),
        y: canvas.height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      })
    })

    // Force simulation
    const simulate = () => {
      const alpha = 0.1
      const repulsion = 100
      const attraction = 0.01
      const damping = 0.9

      // Apply forces
      nodePositions.forEach((pos1, id1) => {
        // Reset forces
        pos1.vx *= damping
        pos1.vy *= damping

        // Repulsion between all nodes
        nodePositions.forEach((pos2, id2) => {
          if (id1 === id2) return

          const dx = pos2.x - pos1.x
          const dy = pos2.y - pos1.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1
          const force = (repulsion * repulsion) / (distance * distance)

          pos1.vx -= (force * dx / distance) * alpha
          pos1.vy -= (force * dy / distance) * alpha
        })

        // Attraction along links
        links.forEach(link => {
          if (link.source === id1 || link.target === id1) {
            const otherId = link.source === id1 ? link.target : link.source
            const pos2 = nodePositions.get(otherId)
            if (!pos2) return

            const dx = pos2.x - pos1.x
            const dy = pos2.y - pos1.y
            const distance = Math.sqrt(dx * dx + dy * dy) || 1

            pos1.vx += dx * attraction * alpha
            pos1.vy += dy * attraction * alpha
          }
        })

        // Apply velocity
        pos1.x += pos1.vx
        pos1.y += pos1.vy

        // Keep nodes within bounds
        const margin = 50
        pos1.x = Math.max(margin, Math.min(canvas.width - margin, pos1.x))
        pos1.y = Math.max(margin, Math.min(canvas.height - margin, pos1.y))
      })
    }

    // Render function
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Apply zoom
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.scale(zoom, zoom)
      ctx.translate(-canvas.width / 2, -canvas.height / 2)

      // Draw links
      ctx.strokeStyle = theme === "dark" ? "#444" : "#ddd"
      ctx.lineWidth = 1

      links.forEach(link => {
        const source = nodePositions.get(link.source)
        const target = nodePositions.get(link.target)
        if (!source || !target) return

        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        
        if (link.type === "circular") {
          ctx.strokeStyle = "#ef4444"
          ctx.lineWidth = 2
        } else {
          ctx.strokeStyle = theme === "dark" ? "#444" : "#ddd"
          ctx.lineWidth = 1
        }
        
        ctx.stroke()
      })

      // Draw nodes
      nodes.forEach(node => {
        const pos = nodePositions.get(node.id)
        if (!pos) return

        const radius = Math.sqrt(node.size || 10) * 3
        const isSelected = node.id === selectedNode

        // Node circle
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI)
        
        // Color by type
        const colors = {
          module: theme === "dark" ? "#3b82f6" : "#2563eb",
          package: theme === "dark" ? "#10b981" : "#059669",
          file: theme === "dark" ? "#f59e0b" : "#d97706",
        }
        
        ctx.fillStyle = colors[node.type] || colors.file
        ctx.fill()

        if (isSelected) {
          ctx.strokeStyle = theme === "dark" ? "#fff" : "#000"
          ctx.lineWidth = 3
          ctx.stroke()
        }

        // Node label
        ctx.fillStyle = theme === "dark" ? "#fff" : "#000"
        ctx.font = "12px sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(node.label, pos.x, pos.y + radius + 15)
      })

      ctx.restore()
    }

    // Animation loop
    const animate = () => {
      simulate()
      render()
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    // Mouse interactions
    if (interactive) {
      const handleClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()
        const x = (e.clientX - rect.left) * window.devicePixelRatio
        const y = (e.clientY - rect.top) * window.devicePixelRatio

        // Adjust for zoom
        const adjustedX = (x - canvas.width / 2) / zoom + canvas.width / 2
        const adjustedY = (y - canvas.height / 2) / zoom + canvas.height / 2

        // Find clicked node
        let clickedNode: string | null = null
        nodes.forEach(node => {
          const pos = nodePositions.get(node.id)
          if (!pos) return

          const radius = Math.sqrt(node.size || 10) * 3
          const dx = adjustedX - pos.x
          const dy = adjustedY - pos.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance <= radius) {
            clickedNode = node.id
          }
        })

        setSelectedNode(clickedNode)
      }

      canvas.addEventListener("click", handleClick)

      return () => {
        canvas.removeEventListener("click", handleClick)
      }
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes, links, theme, zoom, selectedNode, interactive])

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.5))
  const handleReset = () => {
    setZoom(1)
    setSelectedNode(null)
  }

  const handleExport = () => {
    if (!canvasRef.current) return
    
    const link = document.createElement("a")
    link.download = "dependency-network.png"
    link.href = canvasRef.current.toDataURL()
    link.click()
  }

  const selectedNodeData = nodes.find(n => n.id === selectedNode)
  const connectedNodes = selectedNodeData
    ? links
        .filter(l => l.source === selectedNode || l.target === selectedNode)
        .map(l => l.source === selectedNode ? l.target : l.source)
    : []

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Dependency Network</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset}>
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleExport}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div ref={containerRef} className="relative h-[500px] bg-muted/10 rounded-lg overflow-hidden">
            <canvas ref={canvasRef} className="absolute inset-0" />
          </div>

          {showLegend && (
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm">Module</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">Package</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm">File</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-red-500" />
                <span className="text-sm">Circular</span>
              </div>
            </div>
          )}

          {selectedNodeData && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">{selectedNodeData.label}</h4>
                <Badge>{selectedNodeData.type}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <div>Dependencies: {selectedNodeData.dependencies.length}</div>
                <div>Connected to: {connectedNodes.length} nodes</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}