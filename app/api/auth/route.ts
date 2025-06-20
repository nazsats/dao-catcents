// File: app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    if (!address || typeof address !== 'string') {
      console.error('Invalid address:', address);
      return NextResponse.json(
        { error: 'Invalid or missing address' },
        { status: 400 }
      );
    }

    console.log('Generating custom token for address:', address);
    const customToken = await getAuth().createCustomToken(address.toLowerCase());
    console.log('Custom token generated:', customToken.slice(0, 20) + '...');

    return NextResponse.json({ customToken }, { status: 200 });
  } catch (error: unknown) {
    console.error('Auth token creation failed:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to create auth token',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}