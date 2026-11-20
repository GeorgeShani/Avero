// Sends a webhook payload with the given `post` function.
// Returns true when the receiver accepted it.
export async function deliver(post, payload) {
  const response = await post(payload);
  return response.ok;
}
