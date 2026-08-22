import axios from "axios";

/**
 * The panel's HTTP client.
 *
 * Separate from the public site's `apiClient`, and deliberately so: that one
 * normalises every failure into `ApiError` because the public API answers
 * `{ error: "code" }`. The panel's routes answer
 * `{ success: false, errors: { _root: ["a sentence for the director"] } }`,
 * and that sentence is the whole point — it says which SKU is already taken,
 * or why a category cannot be deleted. Flattening it into a code would throw
 * away the only part a reader can act on, so this instance leaves the axios
 * error intact for `requestErrorMessage` to read.
 *
 * `baseURL` is the versioned prefix, so call sites name the resource and
 * nothing else.
 */
export const panelClient = axios.create({
  baseURL: "/api/v1",
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});
