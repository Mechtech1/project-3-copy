import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Check, Play, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { RepairTask, Tool } from '@/types';
import { getRepairTaskById } from '@/services/repairService';

interface ToolChecklistProps {
  repairTaskId: string;
  onStartRepair: (repairId: string) => void;
  onBack: () => void;
}

export default function ToolChecklist({ repairTaskId, onStartRepair, onBack }: ToolChecklistProps) {
  const { colors } = useTheme();
  const [checkedTools, setCheckedTools] = useState<Set<string>>(new Set());
  const [repairTask, setRepairTask] = useState<RepairTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load repair task details
  React.useEffect(() => {
    async function loadRepairTask() {
      try {
        setIsLoading(true);
        const task = await getRepairTaskById(repairTaskId);
        setRepairTask(task);
      } catch (error) {
        console.error('Error loading repair task:', error);
        setRepairTask(null);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadRepairTask();
  }, [repairTaskId]);

  const toggleTool = (toolId: string) => {
    const newChecked = new Set(checkedTools);
    if (newChecked.has(toolId)) {
      newChecked.delete(toolId);
    } else {
      newChecked.add(toolId);
    }
    setCheckedTools(newChecked);
  };

  const requiredTools = repairTask?.toolsRequired.filter(tool => tool.required) || [];
  const allRequiredChecked = requiredTools.every(tool => checkedTools.has(tool.id));

  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading repair details...</Text>
        </View>
      </View>
    );
  }

  if (!repairTask) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>Failed to load repair task</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={onBack}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Back to Repairs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerSection}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={onBack}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{repairTask.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
            <Text style={[styles.statusText, { color: colors.warning }]}>PREPARATION</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.primary }]}>TOOL VERIFICATION</Text>
        <View style={[styles.descriptionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Verify all required tools are available before proceeding to live session
          </Text>
        </View>
      </View>

      <ScrollView style={styles.toolsList} showsVerticalScrollIndicator={false}>
        {repairTask.toolsRequired.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[
              styles.toolItem,
              { backgroundColor: colors.card, borderColor: colors.border },
              checkedTools.has(tool.id) && styles.toolItemChecked
            ]}
            onPress={() => toggleTool(tool.id)}
          >
            <View style={styles.toolInfo}>
              <View style={[
                styles.checkbox,
                { borderColor: colors.textSecondary },
                checkedTools.has(tool.id) && styles.checkboxChecked
              ]}>
                {checkedTools.has(tool.id) && (
                  <Check size={16} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.toolDetails}>
                <Text style={[
                  styles.toolName,
                  { color: colors.text },
                  checkedTools.has(tool.id) && styles.toolNameChecked
                ]}>
                  {tool.name}
                  {tool.required && <Text style={[styles.required, { color: colors.warning }]}> *</Text>}
                </Text>
                <Text style={[styles.toolDescription, { color: colors.textSecondary }]}>{tool.description}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.requiredNote, { color: colors.textSecondary }]}>
          * Required tools ({requiredTools.length} of {requiredTools.length} checked)
        </Text>
        
        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: allRequiredChecked ? colors.success : colors.border },
            !allRequiredChecked && styles.startButtonDisabled
          ]}
          onPress={() => onStartRepair(repairTaskId)}
          disabled={!allRequiredChecked}
        >
          <Play size={20} color="#FFFFFF" />
          <Text style={styles.startButtonText}>Start Repair Session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  header: {
    paddingBottom: 24,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  descriptionContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 24,
  },
  toolsList: {
    flex: 1,
  },
  toolItem: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
  },
  toolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolDetails: {
    flex: 1,
  },
  toolName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  toolDescription: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    opacity: 0.8,
  },
  required: {
    fontSize: 16,
    fontWeight: '900',
  },
  footer: {
    paddingTop: 24,
    borderTopWidth: 1,
  },
  progressContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressCount: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  progressNote: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  startButton: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginLeft: 8,
  },
});