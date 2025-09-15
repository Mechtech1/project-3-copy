import { supabase } from '@/lib/supabase';
import { RepairTask, RepairStep } from '@/types';

export interface RepairContext {
  vehicle: {
    make: string;
    model: string;
    year: number;
    vin?: string;
  };
  repairTask: RepairTask;
  currentStep: RepairStep;
  currentStepIndex: number;
  completedSteps: string[];
  voiceHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
}

export class RepairAIService {
  private static instance: RepairAIService;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  static getInstance(): RepairAIService {
    if (!RepairAIService.instance) {
      RepairAIService.instance = new RepairAIService();
    }
    return RepairAIService.instance;
  }

  /**
   * Generate AI response for any repair-related question with full context
   */
  async generateRepairResponse(
    userQuestion: string, 
    repairContext: RepairContext
  ): Promise<string> {
    try {
      // Add user question to conversation history
      this.conversationHistory.push({ role: 'user', content: userQuestion });

      // Keep only last 10 messages for context
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      const { data, error } = await supabase.functions.invoke('repair-ai-assistant', {
        body: {
          userQuestion,
          repairContext,
          conversationHistory: this.conversationHistory,
        },
      });

      if (error) {
        console.error('Error calling repair-ai-assistant:', error);
        return this.getFallbackResponse(userQuestion, repairContext);
      }

      const response = data?.response || this.getFallbackResponse(userQuestion, repairContext);
      
      // Add AI response to conversation history
      this.conversationHistory.push({ role: 'assistant', content: response });

      return response;
    } catch (error) {
      console.error('Error generating repair response:', error);
      return this.getFallbackResponse(userQuestion, repairContext);
    }
  }

  /**
   * Fallback response for when AI service fails
   */
  private getFallbackResponse(userQuestion: string, repairContext: RepairContext): string {
    const lowerQuestion = userQuestion.toLowerCase();
    const currentStep = repairContext.currentStep;

    // Command-based fallbacks
    if (lowerQuestion.includes('next') || lowerQuestion.includes('continue')) {
      return "Let's move to the next step when you're ready.";
    }
    
    if (lowerQuestion.includes('repeat') || lowerQuestion.includes('again')) {
      return currentStep.audioScript;
    }
    
    if (lowerQuestion.includes('where') || lowerQuestion.includes('find') || lowerQuestion.includes('location')) {
      return `Look for the ${currentStep.partName} highlighted in blue on your camera view. It should be clearly marked.`;
    }
    
    if (lowerQuestion.includes('tool') || lowerQuestion.includes('need')) {
      return currentStep.toolRequired 
        ? `For this step, you'll need: ${currentStep.toolRequired}`
        : "No specific tool is required for this step.";
    }
    
    if (lowerQuestion.includes('help') || lowerQuestion.includes('confused')) {
      return `I'm here to help! The current step is: ${currentStep.instruction}. ${currentStep.audioScript}`;
    }

    // Generic helpful response
    return `I'm here to guide you through this ${repairContext.repairTask.name}. The current step is: ${currentStep.instruction}. What specific aspect would you like me to explain?`;
  }

  /**
   * Clear conversation history (for new repair sessions)
   */
  clearConversation(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.conversationHistory];
  }
} 