import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check backend health
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081';
    const backendHealth = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.ok).catch(() => false);

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          frontend: 'healthy',
          backend: backendHealth ? 'healthy' : 'unhealthy',
        },
      },
      { status: backendHealth ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
