'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import GenericConfirmationModal from './GenericConfirmationModal'
import { FileIndexingAPI, FileMetadata, getStatusColor, getStatusText } from '@/lib/integration/client/file-indexing'
import { formatUploadTime, getFileIcon } from '@/utils/file-utils'

interface FileListProps {
  files: FileMetadata[]
  onFileDeleted: () => void
  onFileReindexed: () => void
}

export default function FileList({ files, onFileDeleted, onFileReindexed }: FileListProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileMetadata | null>(null)
  const [loadingStates, setLoadingStates] = useState<Record<string, 'deleting' | 'reindexing' | null>>({})

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

  const handleReindex = async (file: FileMetadata) => {
    setLoadingStates(prev => ({ ...prev, [file.file_id]: 'reindexing' }))

    try {
      await FileIndexingAPI.reindexFile(file.file_id)
      onFileReindexed()
    } catch (error) {
      console.error('Reindex failed:', error)
      alert(`Reindex failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingStates(prev => ({ ...prev, [file.file_id]: null }))
    }
  }

  const canReindex = (status: FileMetadata['status']) => status === 'completed' || status === 'failed'
  const canDelete = (status: FileMetadata['status']) => status !== 'pending' && status !== 'in_progress'

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

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">File</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {files.map((file) => {
                const loadingState = loadingStates[file.file_id]
                const isDeleting = loadingState === 'deleting'
                const isReindexing = loadingState === 'reindexing'
                const isBusy = isDeleting || isReindexing
                const processing = file.status === 'pending' || file.status === 'in_progress'
                const reindexAllowed = canReindex(file.status)
                const deleteAllowed = canDelete(file.status)

                return (
                  <tr key={file.file_id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-lg">
                          {getFileIcon(file.filename)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{file.filename}</p>
                          <p className="truncate text-xs text-slate-500">{file.blob_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(file.status)}`}>
                        {getStatusText(file.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatUploadTime(file.uploaded_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant={reindexAllowed ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleReindex(file)}
                          disabled={isBusy || !reindexAllowed}
                          title={
                            isReindexing
                              ? 'Reindexing in progress'
                              : reindexAllowed
                                ? 'Reindex this file'
                                : processing
                                  ? 'Available after indexing finishes'
                                  : 'Reindex this file'
                          }
                        >
                          {isReindexing ? 'Reindexing...' : 'Reindex'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(file)}
                          disabled={isBusy || !deleteAllowed}
                          title={
                            isDeleting
                              ? 'Deleting in progress'
                              : deleteAllowed
                                ? 'Delete this file'
                                : 'Unavailable while indexing is in progress'
                          }
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <GenericConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setFileToDelete(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete file?"
        message={`This will permanently remove ${fileToDelete?.filename ?? 'this file'} from your resources.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  )
}
