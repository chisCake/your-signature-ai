import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const inferenceUrl =
    process.env.NEXT_PUBLIC_INFERENCE_URL ||
    process.env.NEXT_PUBLIC_INFERENCE_SERVER_URL ||
    'http://localhost:8000';

  const response = await fetch(
    `${inferenceUrl}/model/artifacts/plots/${encodeURIComponent(filename)}`,
    { signal: AbortSignal.timeout(15000) }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: `HTTP ${response.status}` },
      { status: response.status }
    );
  }

  const blob = await response.blob();
  return new NextResponse(blob, {
    headers: { 'Content-Type': 'image/png' },
  });
}
