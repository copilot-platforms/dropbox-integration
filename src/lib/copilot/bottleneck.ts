/**
 * Bottleneck is used to limit the number of concurrent requests to an external service.
 * This external service can be Copilot API, the database, or any other service that has a rate limit in place
 * This library can be used to prevent overwhelming the external service with requests
 *
 * The maxConcurrent value is the maximum number of concurrent requests to the external service at a single time.
 * The minTime value is the minimum time between requests to the external service.
 */

import Bottleneck from 'bottleneck'

// Max peak rate is 3 * (1000 / 200) = 15 requests per second.
const maxConcurrent = 3
const minTime = 200
export const copilotBottleneck = new Bottleneck({ maxConcurrent, minTime })
