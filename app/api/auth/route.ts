// app/api/auth/route.ts
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

export async function POST(request: Request) {
  try {
    const { address } = await request.json();
    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const auth = getAuth();
    const customToken = await auth.createCustomToken(address.toLowerCase());
    return NextResponse.json({ customToken }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error creating custom token:', error);
    const message =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to create token', details: message },
      { status: 500 }
    );
  }
}
