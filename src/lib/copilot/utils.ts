export const buildClientName = (client: { givenName: string; familyName: string }) =>
  `${client.givenName} ${client.familyName}`
