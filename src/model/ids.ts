/** Element ids in a built page: the root flow keeps plain ids; sub-flows prefix theirs ("z1-n-queue"). */
export const pid = (prefix: string, id: string) => (prefix ? `${prefix}-${id}` : id);
