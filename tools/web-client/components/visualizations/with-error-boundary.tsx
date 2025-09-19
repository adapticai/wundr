"use client"

import React, { Suspense } from "react"
import { ErrorBoundary } from "@/components/ui/error/error-boundary"
import { ChartError } from "@/components/ui/error/chart-error"
import { ChartLoading } from "@/components/ui/loading/chart-loading"
import { VisualizationSkeleton } from "@/components/ui/loading/visualization-skeleton"

// Improved type definitions for component props
type ComponentProps = Record<string, unknown>;

interface VisualizationComponentProps extends ComponentProps {
  data?: unknown;
  config?: unknown;
  className?: string;
  style?: React.CSSProperties;
}

interface WithErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error) => void
  loadingMessage?: string
  errorHeight?: number
  visualizationType?: "chart" | "table" | "metric" | "heatmap" | "network"
}

interface WithAsyncBoundaryOptions {
  loadingComponent?: React.ReactNode
  errorComponent?: React.ReactNode
  retryDelay?: number
}

export function withErrorBoundary<T extends VisualizationComponentProps>(
  Component: React.ComponentType<T>,
  defaultProps?: Partial<WithErrorBoundaryProps>
) {
  return function WrappedComponent(props: T & Partial<WithErrorBoundaryProps>) {
    const {
      fallback,
      onError,
      loadingMessage = "Loading visualization...",
      errorHeight = 300,
      visualizationType = "chart",
      ...componentProps
    } = { ...defaultProps, ...props }

    return (
      <ErrorBoundary
        fallback={
          fallback || (
            <ChartError
              error="Failed to render visualization"
              onRetry={() => window.location.reload()}
              height={errorHeight}
            />
          )
        }
        onError={(error, errorInfo) => {
          console.error("Visualization error:", error, errorInfo)
          onError?.(error)
        }}
      >
        <Suspense
          fallback={
            <VisualizationSkeleton
              type={visualizationType}
              height={errorHeight}
            />
          }
        >
          <Component {...componentProps} />
        </Suspense>
      </ErrorBoundary>
    )
  }
}

// HOC for async components
export function withAsyncBoundary<T extends VisualizationComponentProps>(
  Component: React.ComponentType<T>,
  options?: WithAsyncBoundaryOptions
) {
  return function AsyncBoundaryWrapper(props: T) {
    const [error, setError] = React.useState<Error | null>(null)
    const [retryCount, setRetryCount] = React.useState(0)

    React.useEffect(() => {
      if (error && retryCount < 3 && options?.retryDelay) {
        const timer = setTimeout(() => {
          setError(null)
          setRetryCount(prev => prev + 1)
        }, options.retryDelay)

        return () => clearTimeout(timer)
      }
    }, [error, retryCount])

    if (error) {
      return (
        <>
          {options?.errorComponent || (
            <ChartError
              error={error}
              onRetry={() => {
                setError(null)
                setRetryCount(prev => prev + 1)
              }}
            />
          )}
        </>
      )
    }

    return (
      <ErrorBoundary
        onError={(error) => setError(error)}
        fallback={options?.errorComponent}
      >
        <Suspense fallback={options?.loadingComponent || <ChartLoading />}>
          <Component {...props} />
        </Suspense>
      </ErrorBoundary>
    )
  }
}