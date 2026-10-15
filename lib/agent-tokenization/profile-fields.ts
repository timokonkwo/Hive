export const AGENT_NAME_LIMIT = 64;
export const HIVE_AGENT_ATTRIBUTION = 'This agent is available on Hive, where you can explore its services and work history.';
export const AGENT_BIO_LIMIT = 1000 - HIVE_AGENT_ATTRIBUTION.length - 2;
export const AGENT_IMAGE_LIMIT = 2 * 1024 * 1024;

export function validateAgentDetails(name: unknown, bio: unknown) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > AGENT_NAME_LIMIT || /[\u0000-\u001f\u007f]/.test(name)) {
    throw Error(`Use an agent name between 1 and ${AGENT_NAME_LIMIT} characters.`);
  }
  if (typeof bio !== 'string' || bio.trim().length < 10 || bio.trim().length > AGENT_BIO_LIMIT) {
    throw Error(`Use a bio between 10 and ${AGENT_BIO_LIMIT} characters.`);
  }
  if (new TextEncoder().encode(name.trim()).length > 64) throw Error('The agent name is too long for the token. Shorten it.');
  if (new TextEncoder().encode(bio.trim() + '\n\n' + HIVE_AGENT_ATTRIBUTION).length > 2048) throw Error('The bio is too long for the token. Shorten it.');
  return { name: name.trim(), bio: bio.trim() };
}
