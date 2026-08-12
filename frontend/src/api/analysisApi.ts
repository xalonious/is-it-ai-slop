import axios from 'axios';
import api from './axios';
import type { AnalysisError, AnalysisResult } from '../types/analysis';

export interface AnalyzePortfolioRequest {
  url: string;
}

const FALLBACK_ERRORS: Record<string, string> = {
  BLOCKED_URL: 'That address points to a private or internal network and cannot be scanned.',
  SCAN_TIMEOUT: 'The site took too long to analyze.',
  SITE_UNREACHABLE: "We couldn't reach or inspect that site.",
  SERVICE_UNAVAILABLE: 'The scanner is busy. Give it a moment and try again.',
  RATE_LIMITED: 'You have reached the scan limit. Try again in a few minutes.',
  VALIDATION_FAILED: 'Enter a valid public website address.',
};

export const analysisApi = {
  async analyze(payload: AnalyzePortfolioRequest): Promise<AnalysisResult> {
    try {
      const response = await api.post<AnalysisResult>('/analyze', payload);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError<Partial<AnalysisError>>(error)) {
        const code = error.response?.data?.code ?? 'REQUEST_FAILED';
        const backendMessage = error.response?.data?.message;
        const message = FALLBACK_ERRORS[code] ?? backendMessage ?? (error.response
          ? 'The analysis failed before the report could be assembled.'
          : 'The scanner service is unavailable. Is the backend running?');
        throw { code, message } satisfies AnalysisError;
      }
      throw { code: 'REQUEST_FAILED', message: 'The analysis failed unexpectedly.' } satisfies AnalysisError;
    }
  },
};
