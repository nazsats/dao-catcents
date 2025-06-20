// File: app/api/upload-image/route.ts
import { NextResponse } from 'next/server';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error('No file provided in FormData');
      return NextResponse.json(
        { error: 'No file uploaded', details: 'FormData must contain a "file" field' },
        { status: 400 }
      );
    }

    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      console.error(`Invalid file type: ${file.type}`);
      return NextResponse.json(
        { error: 'Invalid file type', details: `File type "${file.type}" is not supported. Allowed types: image/jpeg, image/png, image/gif` },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      console.error(`File size too large: ${file.size} bytes`);
      return NextResponse.json(
        { error: 'File size exceeds limit', details: `File size ${file.size} bytes exceeds 5MB limit` },
        { status: 400 }
      );
    }

    // Sanitize file name to prevent invalid path errors
    const fileName = `campaigns/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storageRef = ref(storage, fileName);

    console.log(`Uploading file: ${fileName}, size: ${file.size}, type: ${file.type}`);

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const snapshot = await uploadBytes(storageRef, buffer, {
      contentType: file.type,
    });
    const imageUrl = await getDownloadURL(snapshot.ref);

    console.log(`Upload successful: ${imageUrl}`);

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (error: unknown) {
    const errorDetails = error instanceof Error
      ? {
          error: 'Failed to upload image',
          details: error.message,
          code: error.name || 'UnknownError',
          stack: error.stack,
        }
      : {
          error: 'Failed to upload image',
          details: String(error),
          code: 'UnknownError',
        };

    console.error('Image upload failed:', errorDetails);
    return NextResponse.json(errorDetails, { status: 500 });
  }
}