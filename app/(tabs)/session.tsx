import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import RepairSession from '@/components/RepairSession';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function SessionTab() {
  const { state, dispatch } = useAppContext();
  const { colors } = useTheme();
  

  const handleEndSession = () => {
    // Session ending is handled in RepairSession component via context
  };

  const styles = createStyles(colors);

  if (!state.currentSession) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Session</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Start a repair from the Repairs tab to begin a live session.
        </Text>
      </View>
    );
  }

  // Get repair task and overlay pack from app context (prepared during loading)
  if (!state.preparedRepairTask) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Repair Task Not Found</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          The repair task was not properly prepared. Please restart from the Repairs tab.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RepairSession 
        repairTask={state.preparedRepairTask}
        overlayPack={state.preparedOverlayPack}
        onEndSession={handleEndSession}
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});