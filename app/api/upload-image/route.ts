import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import admin from 'firebase-admin';

// Initialize Firebase only if not already initialized
let firebaseApp: FirebaseApp;
if (!getApps().length) {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  console.log('Initializing Firebase in API route:', {
    apiKey: firebaseConfig.apiKey ? 'Set' : 'Missing',
    projectId: firebaseConfig.projectId ? 'Set' : 'Missing',
    appId: firebaseConfig.appId ? 'Set' : 'Missing',
  });

  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
  console.log('Firebase already initialized:', { appName: firebaseApp.name });
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  console.log('Firebase Admin initialized');
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CloudinaryUploadResult {
  secure_url: string;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  try {
    // Verify Cloudinary configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('Cloudinary configuration missing:', {
        cloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: !!process.env.CLOUDINARY_API_KEY,
        apiSecret: !!process.env.CLOUDINARY_API_SECRET,
      });
      throw new Error('Cloudinary configuration is incomplete');
    }

    // Verify Firebase ID token
    const idToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!idToken) {
      console.error('No ID token provided in Authorization header');
      return NextResponse.json(
        { error: 'Unauthorized', details: 'No authentication token provided', code: 'auth/no-token' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log('Verified ID token:', { userId: decodedToken.uid });
    } catch (error) {
      console.error('ID token verification failed:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Invalid authentication token', code: 'auth/invalid-token' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error('No file provided in form data');
      return NextResponse.json({ error: 'No file uploaded', code: 'no-file' }, { status: 400 });
    }

    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      console.error('Invalid file type:', { type: file.type });
      return NextResponse.json({ error: 'Invalid file type', code: 'invalid-file-type' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      console.error('File size exceeds limit:', { size: file.size });
      return NextResponse.json({ error: 'File size exceeds 5MB', code: 'file-too-large' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}_${file.name}`;

    console.log('Uploading to Cloudinary:', { fileName, fileType: file.type, fileSize: file.size, userId: decodedToken.uid });

    const uploadResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'campaigns', public_id: fileName },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', {
              message: error.message,
              name: error.name,
              stack: error.stack,
            });
            reject(error);
          } else if (!result) {
            console.error('No result returned from Cloudinary');
            reject(new Error('No result returned from Cloudinary'));
          } else {
            resolve(result as CloudinaryUploadResult);
          }
        }
      );
      uploadStream.on('error', (err) => {
        console.error('Upload stream error:', err);
        reject(err);
      });
      uploadStream.end(fileBuffer);
    });

    const imageUrl = uploadResult.secure_url;

    if (!imageUrl) {
      console.error('No secure_url in Cloudinary response:', uploadResult);
      throw new Error('Failed to retrieve image URL from Cloudinary');
    }

    console.log('File uploaded successfully:', { imageUrl, userId: decodedToken.uid });

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (error: unknown) {
    console.error('Image upload failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      details: typeof error === 'string' ? error : JSON.stringify(error, null, 2),
    });
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        code: error instanceof Error ? error.name : 'unknown',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}