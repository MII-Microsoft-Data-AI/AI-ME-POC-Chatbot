'use client'

import { useState, useEffect } from 'react'
import { FileMetadata, FileIndexingAPI } from '@/lib/integration/client/file-indexing'
import FileUpload from '@/components/FileUpload'
import FileList from '@/components/FileList'
import FileStats from '@/components/FileStats'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'

export default function ResourceManagementPage() {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = async () => {
    try {
      setError(null)
      const response = await FileIndexingAPI.listFiles()
      setFiles(response.files)
    } catch (err) {
      console.error('Failed to fetch files:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch files')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadSuccess = () => {
    fetchFiles() // Refresh the file list after successful upload
  }

  const handleFileDeleted = () => {
    fetchFiles() // Refresh the file list after deletion
  }

  const handleFileReindexed = () => {
    fetchFiles() // Refresh the file list after reindexing
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  // Poll for status updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
        fetchFiles()
    }, 10000)

    return () => clearInterval(interval)
  }, [files])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading files...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 pt-20 md:pt-8 h-screen max-h-screen overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Resource Management
          </h1>
          <p className="text-muted-foreground">
            Upload and manage your documents for AI-powered indexing and search
          </p>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-destructive mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-destructive font-medium">Error:</span>
              <span className="text-destructive ml-1">{error}</span>
            </div>
            <Button
              variant="link"
              onClick={fetchFiles}
              className="text-destructive hover:text-destructive/80 underline h-auto p-0"
            >
              Try again
            </Button>
          </div>
        )}

        {/* File Statistics */}
        <FileStats files={files} />

        {/* File Upload Section */}
        <FileUpload onUploadSuccess={handleUploadSuccess} />

        {/* File List Section */}
        <FileList 
          files={files}
          onFileDeleted={handleFileDeleted}
          onFileReindexed={handleFileReindexed}
        />
      </div>
    </div>
  )
}