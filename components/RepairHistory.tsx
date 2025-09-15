import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, Clock, CircleCheck as CheckCircle, Circle as XCircle, Pause, Trash2 } from 'lucide-react-native';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getRepairHistory, deleteRepairSession } from '@/services/sessionService';
import { RepairSession } from '@/types';
import { Alert } from 'react-native';

export default function RepairHistory() {
  const { state, dispatch } = useAppContext();
  const { colors } = useTheme();

  // Load repair history from database on component mount
  React.useEffect(() => {
    async function loadHistory() {
      try {
        const history = await getRepairHistory();
        dispatch({ type: 'LOAD_HISTORY', payload: history });
      } catch (error) {
        console.error('Error loading repair history:', error);
      }
    }
    
    loadHistory().catch((error) => {
      console.error('Failed to load repair history:', error);
    });
  }, []);

  const handleDeleteSession = (session: RepairSession) => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete this ${session.taskName} session? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRepairSession(session.id);
              dispatch({ type: 'DELETE_SESSION', payload: session.id });
              Alert.alert('Success', 'Repair session deleted successfully.');
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete repair session. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} color={colors.success} />;
      case 'in_progress':
        return <Clock size={20} color={colors.warning} />;
      case 'paused':
        return <Pause size={20} color={colors.primary} />;
      case 'cancelled':
        return <XCircle size={20} color={colors.error} />;
      default:
        return <Clock size={20} color={colors.textSecondary} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'in_progress': return colors.warning;
      case 'paused': return colors.primary;
      case 'cancelled': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (start: string, end?: string) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const minutes = diffMins % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  const styles = createStyles(colors);

  if (state.repairHistory.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Repair History</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Complete your first repair session to see it here.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Repair History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {state.repairHistory.length} session{state.repairHistory.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
        {state.repairHistory.map((session, index) => (
          <View 
            key={`${session.id}-${index}`} 
            style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.statusContainer}>
                  {getStatusIcon(session.status)}
                  <Text style={[styles.statusText, { color: getStatusColor(session.status) }]}>
                    {session.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.taskName, { color: colors.text }]}>{session.taskName}</Text>
              </View>

              <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {formatDate(session.startTime)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {calculateDuration(session.startTime, session.endTime)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressSection}>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Progress</Text>
                <View style={styles.progressInfo}>
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${(session.stepsCompleted / session.totalSteps) * 100}%`,
                          backgroundColor: getStatusColor(session.status),
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.progressText, { color: colors.text }]}>
                    {session.stepsCompleted} / {session.totalSteps} steps
                  </Text>
                </View>
              </View>

              {session.voiceTranscript.length > 0 && (
                <View style={[styles.transcriptPreview, { borderTopColor: colors.border }]}>
                  <Text style={[styles.transcriptLabel, { color: colors.textSecondary }]}>Voice Interactions:</Text>
                  <Text style={[styles.transcriptText, { color: colors.text }]}>
                    {session.voiceTranscript.length} voice command{session.voiceTranscript.length !== 1 ? 's' : ''} recorded
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.deleteSessionButton}
              onPress={() => {
                console.log('Trash button clicked for session:', session.id);
                handleDeleteSession(session);
              }}
            >
              <Trash2 size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  historyList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sessionCard: {
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
  },
  cardContent: {
    flex: 1,
    padding: 20,
  },
  cardHeader: {
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  taskName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    marginLeft: 6,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  transcriptPreview: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
  },
  deleteSessionButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});