
export function makeResourceId(type, id) {
  const allowedTypes = ['note', 'notice'];

  if (!allowedTypes.includes(type)) {
    throw new Error('INVALID_RESOURCE_TYPE');
  }

  if (typeof id !== 'string' || id.trim() === '') {
  throw new Error('INVALID_RESOURCE_ID');
  }

  return `${type}:${id}`;
}
