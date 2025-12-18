'use client'

import { useState } from 'react'
import { FileMetadata, FileIndexingAPI } from '@/lib/integration/client/file-indexing'
import { formatUploadTime, getFileIcon } from '@/utils/file-utils'
import GenericConfirmationModal from './GenericConfirmationModal'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface FileListProps {
  files: FileMetadata[]
  onFileDeleted: () => void
  onFileReindexed: () => void
}

export default function FileList({ files, onFileDeleted, onFileReindexed }: FileListProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileMetadata | null>(null)
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: 'deleting' | 'reindexing' | null }>({})

  const handleDeleteClick = (file: FileMetadata) => {
    setFileToDelete(file)
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return

    setLoadingStates(prev => ({ ...prev, [fileToDelete.file_id]: 'deleting' }))
    
    try {
      await FileIndexingAPI.deleteFile(fileToDelete.file_id)
      onFileDeleted()
    } catch (error) {
      console.error('Delete failed:', error)
      alert(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingStates(prev => ({ ...prev, [fileToDelete.file_id]: null }))
      setDeleteModalOpen(false)
      setFileToDelete(null)
    }
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const handleReindex = async (file: FileMetadata) => {
    // Reindex functionality implementation if needed in future
    // Currently UI doesn't explicitly show this button in the table design but keeping function handy
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
        <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-slate-500">No files uploaded yet.</p>
      </div>
    )
  }

}