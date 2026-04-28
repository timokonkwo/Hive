import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * POST /api/upload/token-image
 *
 * Upload a token image to Cloudinary. Returns a permanent public URL
 * that the Bags SDK can fetch during token launch.
 *
 * Body: multipart/form-data with `image` file field
 * Response: { url: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 uploads per hour per IP
    const ip = getClientIp(req);
    const rl = checkRateLimit(`token-image-upload:${ip}`, { maxRequests: 5, windowSeconds: 3600 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    // Verify Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { error: 'Image upload service not configured.' },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided. Use field name "image".' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type "${file.type}". Accepted: PNG, JPG, WebP.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 2MB.` },
        { status: 400 }
      );
    }

    // Convert to buffer then base64 for Cloudinary upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = `data:${file.type};base64,${buffer.toString('base64')}`;

    // Generate a unique public_id based on timestamp
    const publicId = `hive-tokens/token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Upload to Cloudinary with transformations
    const result = await cloudinary.uploader.upload(base64Data, {
      public_id: publicId,
      folder: undefined, // Already in public_id
      transformation: [
        { width: 512, height: 512, crop: 'fill', gravity: 'center' },
        { quality: 'auto', fetch_format: 'png' },
      ],
      resource_type: 'image',
      overwrite: true,
    });

    if (!result?.secure_url) {
      return NextResponse.json({ error: 'Upload failed. No URL returned.' }, { status: 500 });
    }

    // Build the optimized URL (512x512, center-cropped, PNG)
    const optimizedUrl = cloudinary.url(result.public_id, {
      width: 512,
      height: 512,
      crop: 'fill',
      gravity: 'center',
      format: 'png',
      secure: true,
    });

    return NextResponse.json({
      url: optimizedUrl,
      publicId: result.public_id,
      width: 512,
      height: 512,
    });
  } catch (error: any) {
    console.error('[UPLOAD] Token image upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Image upload failed.' },
      { status: 500 }
    );
  }
}
