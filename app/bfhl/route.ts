import { NextResponse } from "next/server";
import { processEdges } from "@/lib/processor";
import { IDENTITY } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function withCors<T>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return withCors(
      { error: "Invalid JSON body" },
      400,
    );
  }

  const data =
    payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)
      ? (payload as { data: unknown }).data
      : undefined;

  if (!Array.isArray(data)) {
    return withCors(
      { error: "Request body must be { \"data\": string[] }" },
      400,
    );
  }

  const result = processEdges(data);

  return withCors({
    user_id: IDENTITY.user_id,
    email_id: IDENTITY.email_id,
    college_roll_number: IDENTITY.college_roll_number,
    ...result,
  });
}

export async function GET() {
  return withCors({
    message: "POST /bfhl with { data: string[] } to process hierarchies.",
    ...IDENTITY,
  });
}
