import { NextResponse } from "next/server";
import { parseProductQuery } from "@/lib/api/product-query";
import { queryProducts } from "@/lib/api/product-repository";

export async function GET(request: Request) {
  const query = parseProductQuery(new URL(request.url).searchParams);
  return NextResponse.json(await queryProducts(query));
}
