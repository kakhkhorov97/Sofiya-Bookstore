export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "web",
    version: process.env.APP_VERSION ?? "dev",
  });
}
