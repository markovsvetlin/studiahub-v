/**
 * Health check handler - provides system health status
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createSuccessResponse } from '../utils/http';

/**
 * Health check endpoint - returns system status
 * @param _event - API Gateway event (unused)
 * @returns Health status response
 */
export async function handler(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
;
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'studiahub-backend',
    version: process.env.npm_package_version || '1.0.0'
  };

  return createSuccessResponse(healthData);
}