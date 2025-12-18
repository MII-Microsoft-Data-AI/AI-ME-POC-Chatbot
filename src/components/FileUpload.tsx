'use client'

import { useState, useCallback } from 'react'
import { FileIndexingAPI } from '@/lib/integration/client/file-indexing'
import { isValidFileType, getMaxFileSize, formatFileSize } from '@/utils/file-utils'
import { Button } from '@/components/ui/button'
import { UploadCloud } from 'lucide-react'

interface FileUploadProps {
  onUploadSuccess: () => void
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: boolean }>({})

  const maxFileSize = getMaxFileSize()

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const validFiles = Array.from(files).filter(file => {
      if (!isValidFileType(file)) {
        alert(`File "${file.name}" is not a supported file type.`)
        return false
      }
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" is too large. Maximum size is ${formatFileSize(maxFileSize)}.`)
        return false
      }
      return true
    })

    setSelectedFiles(prev => [...prev, ...validFiles])
  }, [maxFileSize])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    const progress: { [key: string]: boolean } = {}
    
    try {
      for (const file of selectedFiles) {
        progress[file.name] = true
        setUploadProgress({ ...progress })
        
        await FileIndexingAPI.uploadFile(file)
        
        progress[file.name] = false
        setUploadProgress({ ...progress })
      }

      setSelectedFiles([])
      setUploadProgress({})
      onUploadSuccess()
    } catch (error) {
      console.error('Upload failed:', error)
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="w-full">
      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-slate-500 bg-slate-50' 
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center max-w-sm mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <UploadCloud className="w-6 h-6 text-slate-600" />
          </div>
          
          <div className="text-slate-600 mb-2">
            <label className="text-slate-900 font-semibold hover:text-slate-700 cursor-pointer">
              Click to upload
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp,.xls,.xlsx,.ppt,.pptx"
              />
            </label>
            <span className="mx-1">or drag and drop</span>
          </div>
          
          <div className="text-sm text-slate-500">
            SVG, PNG, JPG or GIF (max. 800x400px)
          </div>
           <div className="text-sm text-slate-500 mt-1">
            (Also supports docs: PDF, Word, Excel)
          </div>
        </div>
      </div>

      {/* Selected Files List & Upload Button */}
      {selectedFiles.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 bg-white">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 truncate">{file.name}</span>
                      <span className="text-sm text-slate-500">{formatFileSize(file.size)}</span>
                    </div>
                    {/* Progress Bar (Mock) */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div 
                         className={`h-full bg-slate-900 rounded-full transition-all duration-300 ${uploadProgress[file.name] ? 'w-full animate-pulse' : 'w-0'}`}
                       />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                  className="ml-4 text-slate-400 hover:text-red-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={uploadFiles}
              disabled={uploading}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}