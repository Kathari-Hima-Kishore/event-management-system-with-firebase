// Image processing worker
self.onmessage = function(e) {
    const { imageData, maxWidth, maxHeight, quality } = e.data;
    
    // Create an image element
    const img = new Image();
    
    // Add error handling for Windows-specific image loading issues
    img.onerror = function(error) {
        console.error('Image loading error:', error);
        self.postMessage({ error: 'Failed to load image. Please try a different image format.' });
    };
    
    img.onload = function() {
        try {
            // Create canvas for resizing
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions while maintaining aspect ratio
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }
            
            // Set canvas dimensions
            canvas.width = width;
            canvas.height = height;
            
            // Draw and resize image
            const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for better performance
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Clear canvas with white background (prevents transparency issues on Windows)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            
            // Draw image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to base64 with quality setting
            let base64;
            try {
                base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
            } catch (error) {
                // Fallback for Windows-specific encoding issues
                console.warn('JPEG encoding failed, trying PNG:', error);
                base64 = canvas.toDataURL('image/png').split(',')[1];
            }
            
            // Send back the processed image
            self.postMessage(base64);
        } catch (error) {
            console.error('Image processing error:', error);
            self.postMessage({ error: 'Failed to process image. Please try again.' });
        }
    };
    
    // Load the image with error handling
    try {
        img.src = imageData;
    } catch (error) {
        console.error('Image source error:', error);
        self.postMessage({ error: 'Invalid image data. Please try again.' });
    }
}; 