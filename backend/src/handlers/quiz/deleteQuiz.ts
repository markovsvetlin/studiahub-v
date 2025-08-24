import { APIGatewayProxyHandler } from 'aws-lambda'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { db } from '../../db'
import { createResponse } from '../../utils/http'
import { QUIZ_TABLE } from '../../utils/constants'

export const deleteQuiz: APIGatewayProxyHandler = async (event) => {
  const quizId = event.pathParameters?.id
  
  if (!quizId) {
    return createResponse(400, { error: 'Quiz ID is required' })
  }
  
  try {
    await db.send(new DeleteCommand({
      TableName: QUIZ_TABLE,
      Key: { id: quizId }
    }))
    
    console.log(`✅ Deleted quiz: ${quizId}`)
    
    return createResponse(200, { 
      message: 'Quiz deleted successfully',
      quizId 
    })
  } catch (error) {
    console.error('❌ Failed to delete quiz:', error)
    return createResponse(500, { 
      error: 'Failed to delete quiz',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}