interface ChatSkeletonProps {
  isCollapsed?: boolean
  isMobile?: boolean
  count?: number
}

export default function ChatSkeleton({ isCollapsed = false, isMobile = false, count = 3 }: ChatSkeletonProps) {
  if (isCollapsed) {
    // For collapsed desktop view, show icon-only skeletons
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="w-full h-9 flex items-center justify-center rounded-md animate-pulse p-2"
          >
            <div className="w-5 h-5 bg-gray-200 rounded-md"></div>
          </div>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-[2px]">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="flex items-center justify-between px-3 py-2 rounded-md">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0 w-full">
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}