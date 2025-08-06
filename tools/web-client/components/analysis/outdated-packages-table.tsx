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

interface OutdatedPackage {
  name: string
  current: string
  latest: string
  type: 'major' | 'minor' | 'patch'
  location: string
}

interface OutdatedPackagesTableProps {
  packages?: OutdatedPackage[]
}

export function OutdatedPackagesTable({ packages = [] }: OutdatedPackagesTableProps) {
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