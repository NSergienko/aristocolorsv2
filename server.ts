import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Helper to inspect PNG IHDR chunk
function inspectPngBuffer(buffer: Buffer) {
  // PNG signature is 8 bytes: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer.length > 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (!isPng) {
    return { isPng: false, width: 0, height: 0, colorType: -1, hasAlpha: false };
  }

  // IHDR chunk starts at byte 12 (length 4 bytes, 'IHDR' 4 bytes, data starts at byte 16)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  // Color type 6 = RGBA (truecolor with alpha)
  // Color type 4 = Grayscale with alpha
  // Color type 2 = RGB (can have tRNS chunk)
  // Color type 3 = Indexed color (can have tRNS chunk)
  const hasDirectAlpha = colorType === 6 || colorType === 4;
  const hasTrnsChunk = buffer.includes(Buffer.from('tRNS'));

  return {
    isPng: true,
    width,
    height,
    bitDepth,
    colorType,
    hasAlpha: hasDirectAlpha || hasTrnsChunk,
    alphaType: colorType === 6 ? 'RGBA (32-bit)' : colorType === 4 ? 'Grayscale + Alpha' : hasTrnsChunk ? 'Palette/RGB + tRNS Transparency' : 'None',
  };
}

async function startServer() {
  const app = express();

  // Support base64 image uploads up to 50MB
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 1. Health & Config Status endpoint
  app.get('/api/bria/status', (_req: Request, res: Response) => {
    const token = process.env.BRIA_API_TOKEN?.trim();
    const isConfigured = Boolean(token && token.length > 5 && !token.includes('MY_BRIA_API_TOKEN'));
    
    let masked = '';
    if (token && token.length > 8) {
      masked = `${token.slice(0, 4)}...${token.slice(-4)}`;
    } else if (token) {
      masked = '****';
    }

    res.json({
      configured: isConfigured,
      tokenMasked: isConfigured ? masked : null,
      message: isConfigured
        ? 'BRIA_API_TOKEN is active in the secure server environment.'
        : 'BRIA_API_TOKEN is not yet configured in AI Studio Secrets. Please see setup instructions.',
    });
  });

  // 2. Background Removal API endpoint
  app.post('/api/bria/cutout', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const token = process.env.BRIA_API_TOKEN?.trim();

    if (!token || token.includes('MY_BRIA_API_TOKEN')) {
      res.status(400).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: 'BRIA_API_TOKEN is not configured in the server environment. Add it via the AI Studio Secrets panel.',
      });
      return;
    }

    const { image, sync = true, preserve_alpha = true } = req.body;

    if (!image) {
      res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Missing "image" field (must be base64 data URL or public image URL).',
      });
      return;
    }

    try {
      // Official Bria endpoint: https://engine.prod.bria-api.com/v2/image/edit/remove_background
      const briaEndpoint = 'https://engine.prod.bria-api.com/v2/image/edit/remove_background';
      
      const briaPayload = {
        image,
        sync: Boolean(sync),
        preserve_alpha: Boolean(preserve_alpha),
      };

      const briaResponse = await fetch(briaEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_token': token,
        },
        body: JSON.stringify(briaPayload),
      });

      if (!briaResponse.ok) {
        const errorText = await briaResponse.text();
        let parsedError: Record<string, unknown> = {};
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          parsedError = { raw: errorText };
        }

        let friendlyMsg = `Bria API returned status ${briaResponse.status}`;
        if (briaResponse.status === 401) {
          friendlyMsg = 'Invalid or expired Bria API token. Please verify your token in AI Studio Secrets.';
        } else if (briaResponse.status === 402 || briaResponse.status === 429) {
          friendlyMsg = 'Bria trial limit reached (100 free cutouts used) or rate limit exceeded.';
        } else if (briaResponse.status === 400) {
          friendlyMsg = `Invalid request or unprocessable image: ${JSON.stringify(parsedError)}`;
        }

        res.status(briaResponse.status).json({
          success: false,
          statusCode: briaResponse.status,
          error: 'BRIA_API_ERROR',
          message: friendlyMsg,
          details: parsedError,
        });
        return;
      }

      const responseJson = await briaResponse.json() as Record<string, unknown>;

      let finalImageUrl: string | null = null;

      // Handle direct result or sync response
      if (typeof responseJson.result === 'object' && responseJson.result !== null) {
        const resultObj = responseJson.result as Record<string, unknown>;
        if (typeof resultObj.image_url === 'string') {
          finalImageUrl = resultObj.image_url;
        }
      } else if (typeof responseJson.image_url === 'string') {
        finalImageUrl = responseJson.image_url;
      }

      // Handle async polling if status_url is provided
      if (!finalImageUrl && typeof responseJson.status_url === 'string') {
        const statusUrl = responseJson.status_url;
        let attempts = 0;
        const maxAttempts = 25;

        while (attempts < maxAttempts && !finalImageUrl) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          attempts++;

          const pollRes = await fetch(statusUrl, {
            headers: { 'api_token': token },
          });

          if (pollRes.ok) {
            const pollData = await pollRes.json() as Record<string, unknown>;
            if (pollData.status === 'COMPLETE' || pollData.status === 'COMPLETED' || pollData.status === 'SUCCESS') {
              if (typeof pollData.result === 'object' && pollData.result !== null) {
                const resObj = pollData.result as Record<string, unknown>;
                finalImageUrl = (resObj.image_url as string) || null;
              } else if (typeof pollData.image_url === 'string') {
                finalImageUrl = pollData.image_url;
              }
              break;
            } else if (pollData.status === 'FAILED' || pollData.status === 'ERROR') {
              throw new Error(`Asynchronous Bria job failed: ${JSON.stringify(pollData)}`);
            }
          }
        }
      }

      if (!finalImageUrl) {
        res.status(502).json({
          success: false,
          error: 'NO_IMAGE_RETURNED',
          message: 'Bria API responded successfully, but did not return a valid result image URL.',
          rawResponse: responseJson,
        });
        return;
      }

      // Download the resulting image buffer so we can verify alpha transparency & resolution
      const imageFetchRes = await fetch(finalImageUrl);
      if (!imageFetchRes.ok) {
        throw new Error(`Failed to download output image from Bria storage: ${imageFetchRes.status}`);
      }

      const imageArrayBuffer = await imageFetchRes.arrayBuffer();
      const imageBuffer = Buffer.from(imageArrayBuffer);
      const durationMs = Date.now() - startTime;

      // Inspect binary PNG data
      const pngMeta = inspectPngBuffer(imageBuffer);
      const base64Data = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Data}`;

      res.json({
        success: true,
        durationMs,
        resultUrl: finalImageUrl,
        resultDataUrl: dataUrl,
        sizeBytes: imageBuffer.length,
        sizeFormatted: `${(imageBuffer.length / 1024).toFixed(1)} KB`,
        width: pngMeta.width,
        height: pngMeta.height,
        dimensionsFormatted: `${pngMeta.width} × ${pngMeta.height} px`,
        isPng: pngMeta.isPng,
        hasAlphaChannel: pngMeta.hasAlpha,
        alphaType: pngMeta.alphaType,
        colorType: pngMeta.colorType,
        bitDepth: pngMeta.bitDepth,
        briaPayload: responseJson,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      console.error('[Bria API Error]:', err);
      res.status(500).json({
        success: false,
        durationMs,
        error: 'SERVER_ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. fal.ai IC-Light V2 Relighting Endpoints
  // --------------------------------------------------------------------------
  app.get('/api/relight/status', (_req: Request, res: Response) => {
    const key = process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim();
    const isConfigured = Boolean(key && key.length > 5 && !key.includes('MY_FAL_KEY'));

    let masked = '';
    if (key && key.length > 8) {
      masked = `${key.slice(0, 4)}...${key.slice(-4)}`;
    } else if (key) {
      masked = '****';
    }

    res.json({
      configured: isConfigured,
      keyMasked: isConfigured ? masked : null,
      model: 'fal-ai/iclight-v2',
      pricing: '$0.10 / megapixel (approx. $0.025 per 1024x1024 generation)',
      message: isConfigured
        ? 'FAL_KEY is active in the secure server environment.'
        : 'FAL_KEY is not configured in environment variables. Configure FAL_KEY in Secrets or .env to make real API requests.',
    });
  });

  app.post('/api/relight/generate', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const key = process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim();

    if (!key || key.includes('MY_FAL_KEY')) {
      res.status(400).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message:
          'FAL_KEY is not configured in the server environment. Please set FAL_KEY in your AI Studio Secrets or .env file.',
      });
      return;
    }

    const {
      image_url,
      prompt,
      initial_latent = 'Right',
      guidance_scale = 5,
      mask_image_url,
      negative_prompt,
    } = req.body;

    if (!image_url || typeof image_url !== 'string') {
      res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Missing "image_url" field (must be a valid data URI or accessible public image URL).',
      });
      return;
    }

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Missing "prompt" field describing desired lighting.',
      });
      return;
    }

    try {
      const falEndpoint = 'https://fal.run/fal-ai/iclight-v2';

      const payload: Record<string, unknown> = {
        image_url,
        prompt,
        initial_latent,
        guidance_scale: Number(guidance_scale) || 5,
        enable_safety_checker: false,
      };

      if (mask_image_url) {
        payload.mask_image_url = mask_image_url;
      }
      if (negative_prompt) {
        payload.negative_prompt = negative_prompt;
      }

      const falResponse = await fetch(falEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${key}`,
        },
        body: JSON.stringify(payload),
      });

      if (!falResponse.ok) {
        const errorText = await falResponse.text();
        let parsedError: Record<string, unknown> = {};
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          parsedError = { raw: errorText };
        }

        let friendlyMsg = `fal.ai API returned status ${falResponse.status}`;
        if (falResponse.status === 401) {
          friendlyMsg = 'Invalid or expired fal.ai API key. Please check your FAL_KEY in Secrets.';
        } else if (falResponse.status === 402 || falResponse.status === 429) {
          friendlyMsg = 'Insufficient balance on fal.ai account or rate limit exceeded.';
        } else if (falResponse.status === 400) {
          friendlyMsg = `Invalid request parameters to fal.ai: ${JSON.stringify(parsedError)}`;
        }

        res.status(falResponse.status).json({
          success: false,
          statusCode: falResponse.status,
          error: 'FAL_API_ERROR',
          message: friendlyMsg,
          details: parsedError,
        });
        return;
      }

      const responseJson = (await falResponse.json()) as Record<string, unknown>;
      console.log('[RelightPOC Debug] fal.ai API response:', JSON.stringify(responseJson, null, 2));
      const durationMs = Date.now() - startTime;

      const images = responseJson.images as Array<{ url: string; width?: number; height?: number }> | undefined;
      const firstImage = images?.[0];

      if (!firstImage?.url) {
        res.status(502).json({
          success: false,
          error: 'NO_IMAGE_RETURNED',
          message: 'fal.ai responded successfully, but did not return any image URLs.',
          rawResponse: responseJson,
        });
        return;
      }

      const width = firstImage.width || 1024;
      const height = firstImage.height || 1024;
      const megapixels = (width * height) / 1000000;
      const costDollars = megapixels * 0.1;
      const estimatedCost = `$${costDollars.toFixed(3)}`;

      res.json({
        success: true,
        durationMs,
        imageUrl: firstImage.url,
        width,
        height,
        estimatedCost,
        timings: responseJson.timings,
        seed: responseJson.seed,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      console.error('[fal.ai IC-Light API Error]:', err);
      res.status(500).json({
        success: false,
        durationMs,
        error: 'SERVER_ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Attach Vite middleware in development or serve static in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AristoColors Fullstack Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[AristoColors Server Fatal]:', err);
  process.exit(1);
});
