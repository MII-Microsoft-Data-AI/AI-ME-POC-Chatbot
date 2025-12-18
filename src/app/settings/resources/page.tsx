'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Database, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { FileMetadata, FileIndexingAPI } from '@/lib/integration/client/file-indexing'
import FileUpload from '@/components/FileUpload'
import FileList from '@/components/FileList'
import LoadingSpinner from '@/components/LoadingSpinner'
import { cn } from '@/lib/utils'

export default function ResourcesPage() {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'yours' | 'shared'>('all')

  const fetchFiles = async () => {
    try {
      setFilesError(null)
      setFilesLoading(true)
      const response = await FileIndexingAPI.listFiles()
      setFiles(response.files)
    } catch (err) {
      console.error('Failed to fetch files:', err)
      setFilesError(err instanceof Error ? err.message : 'Failed to fetch files')
    } finally {
      setFilesLoading(false)
    }
  }

  const handleUploadSuccess = () => {
    fetchFiles()
  }

  const handleFileDeleted = () => {
    fetchFiles()
  }

  const handleFileReindexed = () => {
    fetchFiles()
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchFiles()
    }, 10000)
    return () => clearInterval(interval)
  }, [files])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header - Wording restored */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <Database className="w-6 h-6 text-slate-700" />
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Resource Management</h2>
          <p className="text-sm text-slate-500 mt-1">Upload and manage your documents for AI-powered indexing and search</p>
        </div>
      </div>

      {/* Loading State */}
      {filesLoading && files.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <LoadingSpinner size="lg" className="mx-auto mb-4 text-primary" />
            <p className="text-slate-500">Loading files...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {filesError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 font-medium">Error:</span>
            <span className="text-red-600 ml-1">{filesError}</span>
          </div>
          <Button
            variant="link"
            onClick={fetchFiles}
            className="text-red-600 hover:text-red-700 underline h-auto p-0"
          >
            Try again
          </Button>
        </div>
      )}

      {/* Content - only show if not initial loading */}
      {(!filesLoading || files.length > 0) && (
        <>
          {/* File Upload Section */}
          <section>
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900 mb-1">Upload Documents</h3>
              <p className="text-sm text-slate-500">Upload files to be indexed for AI-powered search</p>
            </div>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </section>

          {/* Attached Files Section */}
          <section className="space-y-6 pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                  <h3 className="text-lg font-medium text-slate-900">Your Documents</h3>
                  <p className="text-sm text-slate-500">Manage your uploaded files</p>
               </div>
               <div className="relative w-full md:w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                   <Input placeholder="Search" className="pl-9 bg-white border-slate-200 focus-visible:ring-slate-400" />
               </div>
            </div>

            {/* Filters (View all / Your files / Shared files) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg self-start">
                  {['all', 'yours', 'shared'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type as any)}
                      className={cn(
                        "relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors z-10",
                        filterType === type ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      {filterType === type && (
                        <motion.div
                          layoutId="activeFilter"
                          className="absolute inset-0 bg-white shadow-sm rounded-md -z-10"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      {type === 'all' ? 'View all' : type === 'yours' ? 'Your files' : 'Shared files'}
                    </button>
                  ))}
              </div>
            </div>

            {/* File List */}
            <div className="bg-white">
              <FileList 
                files={files}
                onFileDeleted={handleFileDeleted}
                onFileReindexed={handleFileReindexed}
              />
            </div>
          </section>
        </>
      )}

    </div>
  )
}
