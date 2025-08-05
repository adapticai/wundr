import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Zap, Shield, Globe } from "lucide-react"

const features = [
  {
    icon: Zap,
    title: "Lightning Fast Analysis",
    description: "Analyze large monorepos in seconds with our optimized scanning engine"
  },
  {
    icon: Shield,
    title: "Intelligent Detection",
    description: "Advanced algorithms detect code patterns, duplicates, and refactoring opportunities"
  },
  {
    icon: Globe,
    title: "Universal Support",
    description: "Works with any programming language and framework in your monorepo"
  },
  {
    icon: Sparkles,
    title: "AI-Powered Insights",
    description: "Get smart recommendations powered by machine learning and best practices"
  }
]

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center mb-4">
          <div className="flex aspect-square size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 text-white">
            <Sparkles className="size-8" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">Welcome to Wundr.io</h1>
        <p className="text-lg text-muted-foreground mb-2">
          Transform your monorepo with intelligent code analysis and refactoring
        </p>
        <p className="text-sm text-muted-foreground">
          A product by <span className="font-semibold">Lumic.ai</span> - Building the future of developer tools
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-5xl mx-auto w-full">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-600/10 text-purple-600">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="max-w-3xl mx-auto w-full bg-gradient-to-br from-purple-500/5 to-blue-600/5 border-purple-200">
        <CardHeader>
          <CardTitle>Why Wundr.io?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Managing a monorepo is complex. As your codebase grows, maintaining consistency, 
            preventing duplication, and ensuring clean architecture becomes increasingly challenging.
          </p>
          <p className="text-muted-foreground">
            Wundr.io provides the insights and tools you need to keep your monorepo healthy, 
            performant, and maintainable. Our intelligent analysis helps you make informed decisions 
            about refactoring, consolidation, and architectural improvements.
          </p>
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>Lumic.ai</strong> is dedicated to creating developer tools that enhance productivity 
              and code quality. Wundr.io represents our commitment to solving real-world challenges 
              faced by engineering teams working with large-scale codebases.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}