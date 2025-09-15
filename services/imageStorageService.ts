/**
 * Image Storage Service
 * Downloads temporary DALL-E 3 images and stores them permanently in Supabase Storage
 */

import { supabase } from '@/lib/supabase';

export class ImageStorageService {
  private static instance: ImageStorageService;
  private readonly bucketName = 'overlay-images';

  static getInstance(): ImageStorageService {
    if (!ImageStorageService.instance) {
      ImageStorageService.instance = new ImageStorageService();
    }
    return ImageStorageService.instance;
  }

  /**
   * Convert blob to array buffer for React Native
   */
  private async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Download image from temporary URL and store in Supabase Storage
   */
  async storeImageFromUrl(
    temporaryUrl: string,
    fileName: string,
    contentType: string = 'image/png'
  ): Promise<string> {
    try {
      console.log('📥 Downloading image from temporary URL:', {
        url: temporaryUrl.substring(0, 100) + '...',
        fileName,
        contentType
      });

      // Download the image from the temporary URL
      const response = await fetch(temporaryUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      const imageBlob = await response.blob();
      console.log('✅ Image downloaded successfully:', {
        size: imageBlob.size,
        type: imageBlob.type
      });

      // Convert blob to array buffer for Supabase upload (React Native compatible)
      const arrayBuffer = await this.blobToArrayBuffer(imageBlob);
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      console.log('☁️ Uploading image to Supabase Storage...');
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(fileName, uint8Array, {
          contentType,
          upsert: true, // Overwrite if exists
        });

      if (error) {
        console.error('❌ Failed to upload image to Supabase Storage:', error);
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      console.log('✅ Image uploaded to Supabase Storage:', data.path);

      // Get the public URL for the stored image
      const { data: publicUrlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(fileName);

      const permanentUrl = publicUrlData.publicUrl;
      console.log('🔗 Permanent image URL generated:', permanentUrl);

      return permanentUrl;

    } catch (error) {
      console.error('❌ Failed to store image:', error);
      throw new Error(`Image storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a unique filename for overlay images
   */
  generateFileName(vehicleFamily: string, workspaceType: string): string {
    const sanitizedFamily = vehicleFamily.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const sanitizedWorkspace = workspaceType.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const timestamp = Date.now();
    return `overlays/${sanitizedFamily}_${sanitizedWorkspace}_${timestamp}.png`;
  }

  /**
   * Store DALL-E 3 overlay image and return permanent URL
   * Note: overlay-images bucket must be created manually in Supabase Dashboard
   */
  async storeDalleOverlayImage(
    temporaryUrl: string,
    vehicleFamily: string,
    workspaceType: string
  ): Promise<string> {
    // Generate unique filename
    const fileName = this.generateFileName(vehicleFamily, workspaceType);

    // Store the image and return permanent URL
    return await this.storeImageFromUrl(temporaryUrl, fileName, 'image/png');
  }
}

// Export singleton instance
export const imageStorageService = ImageStorageService.getInstance();
