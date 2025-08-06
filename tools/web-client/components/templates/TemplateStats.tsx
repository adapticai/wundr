"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Star, 
  Users, 
  Code2,
  Calendar,
  Zap
} from "lucide-react";

interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  framework: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  downloads: number;
  rating: number;
  lastUpdated: string;
  author: string;
  version: string;
  usageStats: {
    monthly: number;
    total: number;
    trending: boolean;
  };
}

interface TemplateStatsProps {
  templates: ServiceTemplate[];
}

export function TemplateStats({ templates }: TemplateStatsProps) {
  const totalDownloads = templates.reduce((sum, template) => sum + template.downloads, 0);
  const monthlyDownloads = templates.reduce((sum, template) => sum + template.usageStats.monthly, 0);
  const averageRating = templates.reduce((sum, template) => sum + template.rating, 0) / templates.length;
  const trendingTemplates = templates.filter(template => template.usageStats.trending);

  // Category statistics
  const categoryStats = templates.reduce((stats, template) => {
    stats[template.category] = (stats[template.category] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);

  // Language statistics
  const languageStats = templates.reduce((stats, template) => {
    stats[template.language] = (stats[template.language] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);

  // Difficulty statistics
  const difficultyStats = templates.reduce((stats, template) => {
    stats[template.difficulty] = (stats[template.difficulty] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);

  // Most popular templates
  const popularTemplates = [...templates]
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 5);

  // Top rated templates
  const topRatedTemplates = [...templates]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);

  // Recent templates
  const recentTemplates = [...templates]
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 5);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-100 text-green-800";
      case "intermediate": return "bg-yellow-100 text-yellow-800";
      case "advanced": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDownloads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{monthlyDownloads.toLocaleString()} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageRating.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Across {templates.length} templates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">
              Ready to use
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trending</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trendingTemplates.length}</div>
            <p className="text-xs text-muted-foreground">
              Hot right now
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Templates by Category
            </CardTitle>
            <CardDescription>
              Distribution of templates across different categories
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(categoryStats)
              .sort(([,a], [,b]) => b - a)
              .map(([category, count]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{category}</span>
                    <span className="text-sm text-muted-foreground">{count} templates</span>
                  </div>
                  <Progress value={(count / templates.length) * 100} className="h-2" />
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Language Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Code2 className="h-5 w-5 mr-2" />
              Templates by Language
            </CardTitle>
            <CardDescription>
              Programming languages used in templates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(languageStats)
              .sort(([,a], [,b]) => b - a)
              .map(([language, count]) => (
                <div key={language} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{language}</span>
                    <span className="text-sm text-muted-foreground">{count} templates</span>
                  </div>
                  <Progress value={(count / templates.length) * 100} className="h-2" />
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Popular Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Download className="h-5 w-5 mr-2" />
              Most Downloaded
            </CardTitle>
            <CardDescription>
              Templates with highest download counts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {popularTemplates.map((template, index) => (
              <div key={template.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {template.downloads.toLocaleString()} downloads
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {template.category}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Rated Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Star className="h-5 w-5 mr-2" />
              Highest Rated
            </CardTitle>
            <CardDescription>
              Templates with best user ratings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topRatedTemplates.map((template, index) => (
              <div key={template.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500 text-white text-xs flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{template.name}</p>
                  <div className="flex items-center space-x-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <p className="text-xs text-muted-foreground">{template.rating}</p>
                  </div>
                </div>
                <Badge className={getDifficultyColor(template.difficulty)} variant="secondary">
                  {template.difficulty}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recently Updated */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Recently Updated
            </CardTitle>
            <CardDescription>
              Latest template updates and additions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTemplates.map((template) => (
              <div key={template.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {template.usageStats.trending ? (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      <Zap className="h-3 w-3 mr-1" />
                      Hot
                    </Badge>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(template.lastUpdated).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  v{template.version}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Difficulty Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Templates by Difficulty Level
          </CardTitle>
          <CardDescription>
            How templates are distributed across skill levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(difficultyStats).map(([difficulty, count]) => (
              <div key={difficulty} className="text-center space-y-2">
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getDifficultyColor(difficulty)}`}>
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground">
                  {((count / templates.length) * 100).toFixed(1)}% of total
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trending Templates */}
      {trendingTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Trending Templates
            </CardTitle>
            <CardDescription>
              Templates that are gaining popularity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendingTemplates.map((template) => (
                <div key={template.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm">{template.name}</h3>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Trending
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{template.rating}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Download className="h-3 w-3" />
                      <span>{template.usageStats.monthly}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}