'use client'

import { FileMetadata } from '@/lib/integration/client/file-indexing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FileStatsProps {
  files: FileMetadata[]
}

export default function FileStats({ files }: FileStatsProps) {
  const stats = {
    total: files.length,
    pending: files.filter(f => f.status === 'pending').length,
    processing: files.filter(f => f.status === 'in_progress').length,
    completed: files.filter(f => f.status === 'completed').length,
    failed: files.filter(f => f.status === 'failed').length,
  }

  const getPercentage = (count: number) => {
    return stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
  }

  const statItems = [
    {
      label: 'Total Files',
      value: stats.total,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      label: 'Indexed',
      value: stats.completed,
      percentage: getPercentage(stats.completed),
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      )
    },
    {
      label: 'Processing',
      value: stats.processing,
      percentage: getPercentage(stats.processing),
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      icon: (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )
    },
    {
      label: 'Pending',
      value: stats.pending,
      percentage: getPercentage(stats.pending),
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      label: 'Failed',
      value: stats.failed,
      percentage: getPercentage(stats.failed),
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    },
  ].filter(item => item.label === 'Total Files' || item.value > 0)

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>File Statistics</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center p-4 rounded-lg border bg-background"
            >
              <div className={`p-2 rounded-full ${item.bgColor} ${item.color} mb-2`}>
                {item.icon}
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${item.color}`}>
                  {item.value}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  {item.label}
                </div>
                {'percentage' in item && item.percentage !== undefined && (
                  <div className="text-xs text-gray-500 mt-1">
                    {item.percentage}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {stats.total > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Indexing Progress</span>
              <span>{getPercentage(stats.completed)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getPercentage(stats.completed)}%` }}
              ></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}