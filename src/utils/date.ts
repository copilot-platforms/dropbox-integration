export const datetimeToDate = (date: string) => new Date(date).toISOString().split('T')[0]
