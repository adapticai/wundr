import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DependencyData } from '@/app/api/analysis/dependencies/route'

interface OutdatedPackagesTableProps {
  dependencies?: DependencyData[]
}

export function OutdatedPackagesTable({ dependencies = [] }: OutdatedPackagesTableProps) {
  // Filter outdated packages
  const outdatedPackages = dependencies.filter(dep => 
    dep.version !== dep.latestVersion && dep.latestVersion
  ).map(dep => ({
    name: dep.name,
    current: dep.version,
    latest: dep.latestVersion,
    type: getVersionChangeType(dep.version, dep.latestVersion),
    location: dep.type
  }))
  
  const packages = outdatedPackages
  if (packages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outdated Packages</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No outdated packages found.</p>
        </CardContent>
      </Card>
    )
  }

  function getVersionChangeType(current: string, latest: string): 'major' | 'minor' | 'patch' {
    const currentParts = current.replace(/[^0-9.]/g, '').split('.').map(Number)
    const latestParts = latest.replace(/[^0-9.]/g, '').split('.').map(Number)
    
    if (latestParts[0] > currentParts[0]) return 'major'
    if (latestParts[1] > currentParts[1]) return 'minor'
    return 'patch'
  }

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'major':
        return 'destructive'
      case 'minor':
        return 'secondary'
      case 'patch':
        return 'outline'
      default:
        return 'default'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outdated Packages</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Latest</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((pkg, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{pkg.name}</TableCell>
                <TableCell>{pkg.current}</TableCell>
                <TableCell>{pkg.latest}</TableCell>
                <TableCell>
                  <Badge variant={getBadgeVariant(pkg.type)}>
                    {pkg.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {pkg.location}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}