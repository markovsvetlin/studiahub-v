/**
 * HTTP utility functions for API Gateway responses and request parsing
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyResult } from 'aws-lambda';

/**
 * Creates a standardized error response for API Gateway
 * @param statusCode - HTTP status code
 * @param error - Error message
 * @returns Formatted API Gateway response
 */
export function createErrorResponse(statusCode: number, error: string): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: false, error })
  };
}

/**
 * Creates a standardized success response for API Gateway
 * @param data - Response data to include
 * @param statusCode - HTTP status code (defaults to 200)
 * @returns Formatted API Gateway response
 */
export function createSuccessResponse(data: any, statusCode: number = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true, ...data })
  };
}

/**
 * Creates a standardized response for API Gateway (used by quiz handlers)
 * @param statusCode - HTTP status code
 * @param data - Response data
 * @returns Formatted API Gateway response
 */
export function createResponse(statusCode: number, data: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    },
    body: JSON.stringify(data)
  };
}

