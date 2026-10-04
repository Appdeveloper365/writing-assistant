import type { GatewayRewritePayload } from './apiClient';

export interface QuizGenerationRequest {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  questionTypes: ('multiple-choice' | 'true-false' | 'short-answer')[];
  tone: 'professional' | 'casual' | 'educational' | 'fun';
  useLocalAI: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizGenerationResponse {
  quiz: QuizQuestion[];
  summary: {
    totalQuestions: number;
    averageDifficulty: string;
    estimatedTime: string;
    topicsCovered: string[];
  };
  modelUsed: string;
  generationTime: number;
}

export class QuizAPIClient {
  private gatewayUrl: string;
  private apiKey: string;
  private provider: string;

  constructor(gatewayUrl: string = 'http://localhost:3001/rewrite', apiKey: string = '', provider: string = 'openai') {
    this.gatewayUrl = gatewayUrl;
    this.apiKey = apiKey;
    this.provider = provider;
  }

  async generateQuiz(request: QuizGenerationRequest): Promise<QuizGenerationResponse> {
    try {
      const payload: GatewayRewritePayload = {
        text: JSON.stringify(request),
        tone: request.tone,
        fidelity: 'balanced',
        cloudEnabled: request.useLocalAI,
        provider: this.provider,
        apiKey: this.apiKey,
      };

      const response = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-Extension-Key': this.apiKey,
          'X-Provider': this.provider,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Gateway returned error: ${response.status}`);
      }

      const data = await response.json();
      return {
        quiz: data.quiz || [],
        summary: data.summary || {
          totalQuestions: 0,
          averageDifficulty: 'medium',
          estimatedTime: '5 minutes',
          topicsCovered: []
        },
        modelUsed: data.modelUsed || this.provider,
        generationTime: data.generationTime || 0
      };
    } catch (error) {
      console.error('Quiz generation failed:', error);
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.gatewayUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Provider': this.provider,
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }

  setConnection(gatewayUrl: string, apiKey: string, provider: string): void {
    this.gatewayUrl = gatewayUrl;
    this.apiKey = apiKey;
    this.provider = provider;
  }
}

export const quizAPIClient = new QuizAPIClient();
