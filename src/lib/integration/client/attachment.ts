'use client'

const BaseAPIPath = "/api/be/"

/**
 * Get attachment details including a temporary blob URL with SAS token.
 * 
 * @param attachmentId - The attachment ID (from chatbot://{id} URL)
 * @returns Promise with attachment details including blob_url
 */
export async function getAttachment(attachmentId: string): Promise<{
  id: string;
  filename: string;
  blob_url: string;
  userid: string;
}> {
  // Remove 'chatbot://' prefix if present
  const cleanId = attachmentId.replace('chatbot://', '').trim();
  
  const response = await fetch(`${BaseAPIPath}/api/v1/attachments/${cleanId}`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get attachment: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Get just the blob URL for an attachment.
 * 
 * @param attachmentId - The attachment ID (from chatbot://{id} URL)
 * @returns Promise with the temporary blob URL
 */
export async function getAttachmentBlobUrl(attachmentId: string): Promise<string> {
  const attachment = await getAttachment(attachmentId);
  return attachment.blob_url;
}