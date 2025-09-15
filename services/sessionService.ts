import { supabase, isSupabaseConfigured, getSupabaseConfigError } from '@/lib/supabase';
import { RepairSession, VoiceLog } from '@/types';

export async function saveRepairSession(session: RepairSession): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn(getSupabaseConfigError());
    return;
  }

  try {
    console.log('Saving repair session:', session.id);
    
    // For AI-generated tasks (ID starts with 'gpt-'), we need to handle them differently
    // since they don't exist in the repair_tasks table
    const isAIGenerated = session.taskId.startsWith('gpt-');
    
    if (isAIGenerated) {
      console.log('Handling AI-generated repair session');
      // For AI tasks, we'll save with a null task_id to avoid foreign key constraints
      const { error } = await supabase
        .from('repair_sessions')
        .upsert({
          id: session.id,
          vehicle_vin: session.vehicleVin,
          task_id: null, // Set to null for AI-generated tasks
          task_name: session.taskName,
          start_time: session.startTime,
          end_time: session.endTime || null,
          status: session.status,
          current_step_index: session.currentStepIndex,
          steps_completed: session.stepsCompleted,
          total_steps: session.totalSteps,
          step_log: session.stepLog,
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Error saving AI repair session:', error);
        throw new Error('Failed to save repair session');
      }
    } else {
      // For regular database tasks, save normally
      const { error } = await supabase
        .from('repair_sessions')
        .upsert({
          id: session.id,
          vehicle_vin: session.vehicleVin,
          task_id: session.taskId,
          task_name: session.taskName,
          start_time: session.startTime,
          end_time: session.endTime || null,
          status: session.status,
          current_step_index: session.currentStepIndex,
          steps_completed: session.stepsCompleted,
          total_steps: session.totalSteps,
          step_log: session.stepLog,
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Error saving repair session:', error);
        throw new Error('Failed to save repair session');
      }
    }
    
    console.log('Repair session saved successfully');
  } catch (error) {
    console.error('Error in saveRepairSession:', error);
    throw error;
  }
}

export async function saveVoiceLog(sessionId: string, voiceLog: VoiceLog): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn(getSupabaseConfigError());
    return;
  }

  try {
    console.log('Saving voice log for session:', sessionId);
    
    // First check if the session exists
    const { data: sessionExists, error: checkError } = await supabase
      .from('repair_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (checkError || !sessionExists) {
      console.warn('Repair session not found in database, skipping voice log save:', sessionId);
      return;
    }

    // Use upsert with unique constraint handling
    const { error } = await supabase
      .from('voice_logs')
      .upsert({
        id: voiceLog.id,
        session_id: sessionId,
        timestamp: voiceLog.timestamp,
        type: voiceLog.type,
        text: voiceLog.text,
        audio_generated: voiceLog.audioGenerated || false,
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error saving voice log:', error);
      throw new Error('Failed to save voice log');
    }
    
    console.log('Voice log saved successfully');
  } catch (error) {
    console.error('Error in saveVoiceLog:', error);
    throw error;
  }
}

export async function getRepairHistory(): Promise<RepairSession[]> {
  if (!isSupabaseConfigured()) {
    console.warn(getSupabaseConfigError());
    return [];
  }

  try {
    const { data: sessions, error } = await supabase
      .from('repair_sessions')
      .select(`
        *,
        voice_logs (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching repair history:', error);
      return [];
    }

    return (sessions || []).map(session => ({
      id: session.id,
      vehicleVin: session.vehicle_vin,
      taskId: session.task_id || 'ai-task',
      taskName: session.task_name,
      startTime: session.start_time,
      endTime: session.end_time || undefined,
      status: session.status,
      currentStepIndex: session.current_step_index,
      stepsCompleted: session.steps_completed,
      totalSteps: session.total_steps,
      stepLog: session.step_log,
      voiceTranscript: (session.voice_logs || []).map((log: any) => ({
        id: log.id,
        timestamp: log.timestamp,
        type: log.type,
        text: log.text,
        audioGenerated: log.audio_generated,
      })),
    }));
  } catch (error) {
    console.error('Error in getRepairHistory:', error);
    return [];
  }
}

export async function clearAllRepairHistory(): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn(getSupabaseConfigError());
    return;
  }

  try {
    console.log('Clearing all repair history...');
    
    // Delete all voice logs first (due to foreign key constraints)
    const { error: voiceLogsError } = await supabase
      .from('voice_logs')
      .delete()
      .neq('id', ''); // Delete all records

    if (voiceLogsError) {
      console.error('Error deleting voice logs:', voiceLogsError);
      throw new Error('Failed to clear voice logs');
    }

    // Delete all repair sessions
    const { error: sessionsError } = await supabase
      .from('repair_sessions')
      .delete()
      .neq('id', ''); // Delete all records

    if (sessionsError) {
      console.error('Error deleting repair sessions:', sessionsError);
      throw new Error('Failed to clear repair sessions');
    }

    console.log('All repair history cleared successfully');
  } catch (error) {
    console.error('Error in clearAllRepairHistory:', error);
    throw error;
  }
}

export async function deleteRepairSession(sessionId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn(getSupabaseConfigError());
    return;
  }

  try {
    console.log('Deleting repair session:', sessionId);
    
    // Delete voice logs first (due to foreign key constraints)
    const { error: voiceLogsError } = await supabase
      .from('voice_logs')
      .delete()
      .eq('session_id', sessionId);

    if (voiceLogsError) {
      console.error('Error deleting voice logs for session:', voiceLogsError);
      throw new Error('Failed to delete voice logs');
    }

    // Delete the repair session
    const { error: sessionError } = await supabase
      .from('repair_sessions')
      .delete()
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Error deleting repair session:', sessionError);
      throw new Error('Failed to delete repair session');
    }

    console.log('Repair session deleted successfully');
  } catch (error) {
    console.error('Error in deleteRepairSession:', error);
    throw error;
  }
}