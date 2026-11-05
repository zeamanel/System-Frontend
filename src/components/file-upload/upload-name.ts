/** Answer key holding an uploaded file's name (keys starting with "__" never reach the AI). */
export const uploadNameKey = (questionId: string): string => `__${questionId}_name`
