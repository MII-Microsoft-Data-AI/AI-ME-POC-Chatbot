interface ErrorStateProps {
  error: string
  onRetry?: () => void
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-red-500 text-2xl">😕</div>
        <h2 className="text-xl font-semibold text-gray-800">Oops!</h2>
        <p className="text-gray-600">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-primary/85 hover:bg-primary text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
