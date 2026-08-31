import { AxiosError, type AxiosResponse } from "axios";

/**
 * A refusal as axios reports one: a rejection carrying the response the server
 * did send. The panel tells this apart from a request that never landed, so a
 * test that wants "the server said no" cannot just reject with an Error.
 */
export function refusal(data: unknown, status = 400): AxiosError {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, null, {
    data,
    status,
  } as AxiosResponse);
}
