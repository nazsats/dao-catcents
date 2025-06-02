// app/api/upload-image/route.ts
import { NextResponse } from 'next/server';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB' }, { status: 400 });
    }

    const fileName = `campaigns/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    const imageUrl = await getDownloadURL(storageRef);

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (error: unknown) {
    console.error('Image upload failed:', error);
    // If error is an object with a message property, extract it:
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message: string }).message
        : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to upload image', details: message },
      { status: 500 }
    );
  }
}
