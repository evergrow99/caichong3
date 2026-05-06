import { NextResponse } from "next/server";
import { getReadinessReport } from "@/lib/readiness";

export async function GET() {
  const report = await getReadinessReport();
  return NextResponse.json(report, {
    status: report.ready ? 200 : 503
  });
}
