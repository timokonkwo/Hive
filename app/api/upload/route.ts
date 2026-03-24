import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

export const config = {
  api: {
    bodyParser: false, // We need to handle raw multipart form data
  },
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // SECURITY: Content-type whitelist — reject executables, scripts, HTML
    const ALLOWED_TYPES = [
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/csv', 'text/markdown',
      'application/json',
      'application/zip', 'application/gzip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const fileType = (file.type || 'application/octet-stream').toLowerCase();
    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: `File type "${fileType}" is not allowed.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Simple document storage (Limit ~15MB)
    if (buffer.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 15MB limit." }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("files").insertOne({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: buffer.length,
      data: buffer,
      createdAt: new Date(),
    });

    // Return the absolute public URL to the file
    // Note: In production NEXT_PUBLIC_SITE_URL should be configured
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const fileUrl = `${siteUrl}/api/files/${result.insertedId.toString()}`;

    return NextResponse.json({ url: fileUrl }, { status: 201 });
  } catch (error: any) {
    console.error("[HIVE] File upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
