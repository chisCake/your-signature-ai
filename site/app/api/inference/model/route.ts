import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint для получения кода модели и конфигурации из inference сервера
 */
export async function GET(request: NextRequest) {
  try {
    const inferenceUrl =
      process.env.NEXT_PUBLIC_INFERENCE_URL ||
      process.env.NEXT_PUBLIC_INFERENCE_SERVER_URL ||
      'http://localhost:8000';

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all'; // 'code', 'info', 'all'

    const results: Record<string, unknown> = {};

    if (type === 'features' || type === 'all') {
      try {
        const featuresResponse = await fetch(`${inferenceUrl}/model/features`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        if (featuresResponse.ok) {
          results.features = await featuresResponse.text();
        } else {
          results.featuresError = `HTTP ${featuresResponse.status}`;
        }
      } catch (error) {
        results.featuresError =
          error instanceof Error ? error.message : 'Unknown error';
      }
    }

    if (type === 'artifacts' || type === 'all') {
      try {
        const artResponse = await fetch(`${inferenceUrl}/model/artifacts`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        if (artResponse.ok) {
          results.artifacts = await artResponse.json();
        } else {
          results.artifactsError = `HTTP ${artResponse.status}`;
        }
      } catch (error) {
        results.artifactsError =
          error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Получаем код encoder
    if (type === 'code' || type === 'all') {
      try {
        const codeResponse = await fetch(`${inferenceUrl}/model/`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });

        if (codeResponse.ok) {
          const code = await codeResponse.text();
          results.code = code;
        } else {
          results.codeError = `HTTP ${codeResponse.status}: ${codeResponse.statusText}`;
        }
      } catch (error) {
        results.codeError =
          error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Получаем информацию о модели
    if (type === 'info' || type === 'all') {
      try {
        const infoResponse = await fetch(`${inferenceUrl}/model/info`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });

        if (infoResponse.ok) {
          const contentType = infoResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const info = await infoResponse.json();
            results.info = info;
          } else {
            // Если ответ не JSON, пытаемся прочитать как текст для диагностики
            const text = await infoResponse.text();
            results.infoError = `Unexpected response format. Expected JSON, got: ${contentType || 'unknown'}. Response preview: ${text.substring(0, 100)}`;
          }
        } else {
          // Проверяем, не является ли ответ HTML страницей ошибки
          const contentType = infoResponse.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            results.infoError = `HTTP ${infoResponse.status}: Server returned HTML instead of JSON. Inference server may be unavailable.`;
          } else {
            results.infoError = `HTTP ${infoResponse.status}: ${infoResponse.statusText}`;
          }
        }
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          results.infoError = `Failed to connect to inference server at ${inferenceUrl}. Is it running?`;
        } else {
          results.infoError =
            error instanceof Error ? error.message : 'Unknown error';
        }
      }
    }

    // Получаем статус health для дополнительной информации
    if (type === 'all') {
      try {
        const healthResponse = await fetch(`${inferenceUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (healthResponse.ok) {
          const contentType = healthResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const health = await healthResponse.json();
            results.health = health;
          }
          // Игнорируем, если не JSON
        }
      } catch {
        // Игнорируем ошибки health check
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
