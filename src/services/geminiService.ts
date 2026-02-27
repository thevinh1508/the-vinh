export async function removeBackground(base64Image: string): Promise<string> {
  const apiKey = 'd65c3d948aa3ac020974e8233fd1075a2094c26d748dc962854ae98f56f52975cedf76be623640fe6fdc2f0954dfc80d';
  
  // Convert base64 to blob
  const res = await fetch(base64Image);
  const blob = await res.blob();

  const form = new FormData();
  form.append('image_file', blob);

  const apiResponse = await fetch('https://clipdrop-api.co/remove-background/v1', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
    },
    body: form,
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`ClipDrop API error: ${apiResponse.status} ${errorText}`);
  }

  const buffer = await apiResponse.arrayBuffer();
  
  // Convert buffer to base64
  const base64 = btoa(
    new Uint8Array(buffer)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  
  return `data:image/png;base64,${base64}`;
}

export async function mergeWithBackground(personBase64: string, bgPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const bgImg = new Image();
    const personImg = new Image();
    
    bgImg.crossOrigin = "anonymous";
    personImg.crossOrigin = "anonymous";
    
    bgImg.onload = () => {
      personImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = bgImg.width;
        canvas.height = bgImg.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Draw background
        ctx.drawImage(bgImg, 0, 0);
        
        // Calculate person dimensions
        let heightFactor = 0.85; // Default
        if (bgPath.toLowerCase().includes('vogue')) {
          heightFactor = 1.0; // Full height for Vogue
        }
        
        const targetHeight = bgImg.height * heightFactor;
        const aspectRatio = personImg.width / personImg.height;
        const targetWidth = targetHeight * aspectRatio;
        
        // Horizontal Align: Center
        const x = (bgImg.width - targetWidth) / 2;
        
        // Vertical Align: Move up further
        // Adjust position based on frame type
        let yFactor = 0.10; // Default (Queva)
        if (bgPath.toLowerCase().includes('numero')) {
          yFactor = 0.18; // Lowered for Numero
        } else if (bgPath.toLowerCase().includes('vogue')) {
          yFactor = 1 - heightFactor; // This ensures bottom touches the edge (0.05 if heightFactor is 0.95)
        }
        const y = bgImg.height * yFactor;
        
        // Draw person
        ctx.drawImage(personImg, x, y, targetWidth, targetHeight);
        
        resolve(canvas.toDataURL('image/png'));
      };
      personImg.src = personBase64;
    };
    
    bgImg.onerror = () => reject(new Error("Failed to load background image"));
    personImg.onerror = () => reject(new Error("Failed to load person image"));
    
    bgImg.src = `${bgPath}?t=${Date.now()}`;
  });
}

export async function overlayForeground(baseImageBase64: string, fgPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const baseImg = new Image();
    const fgImg = new Image();
    
    baseImg.crossOrigin = "anonymous";
    fgImg.crossOrigin = "anonymous";
    
    baseImg.onload = () => {
      fgImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = baseImg.width;
        canvas.height = baseImg.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Draw base image
        ctx.drawImage(baseImg, 0, 0);
        
        // Draw foreground layer
        ctx.drawImage(fgImg, 0, 0, baseImg.width, baseImg.height);
        
        resolve(canvas.toDataURL('image/png'));
      };
      fgImg.src = `${fgPath}?t=${Date.now()}`;
    };
    
    baseImg.onerror = () => reject(new Error("Failed to load base image"));
    fgImg.onerror = () => reject(new Error("Failed to load foreground image"));
    
    baseImg.src = baseImageBase64;
  });
}
