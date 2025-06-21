import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getAuth } from 'firebase/auth';

// Define Cloudinary upload result type
interface CloudinaryUploadResult {
  secure_url: string;
  [key: string]: unknown;
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    // Verify Cloudinary configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary configuration is missing');
    }

    // Verify Firebase authentication
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User must be authenticated to upload images', code: 'auth/unauthenticated' },
        { status: 401 }
      );
    }

    console.log('Authenticated user:', { userId: user.uid });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded', code: 'no-file' }, { status: 400 });
    }

    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type', code: 'invalid-file-type' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB', code: 'file-too-large' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}_${file.name}`;

    console.log('Uploading to Cloudinary:', { fileName, fileType: file.type, fileSize: file.size });

    const uploadResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'campaigns', public_id: fileName },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as CloudinaryUploadResult);
        }
      ).end(fileBuffer);
    });

    const imageUrl = uploadResult.secure_url;

    console.log('File uploaded successfully:', { imageUrl });

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (error: unknown) {
    console.error('Image upload failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        code: error instanceof Error ? error.name : 'unknown',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}