import { sellerApiRequest } from "./client";
import type {
  CreateReturnInput,
  Paginated,
  Return,
  ReturnsQuery,
} from "./types";

export function fetchReturns(query: ReturnsQuery): Promise<Paginated<Return>> {
  return sellerApiRequest<Paginated<Return>>("/seller/returns", { query });
}

export function fetchReturn(id: string): Promise<Return> {
  return sellerApiRequest<Return>(`/seller/returns/${id}`);
}

export function createReturn(dto: CreateReturnInput): Promise<Return> {
  return sellerApiRequest<Return>("/seller/returns", {
    method: "POST",
    body: dto,
  });
}
