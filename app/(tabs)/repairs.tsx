import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Alert } from 'react-native';
import RepairList from '@/components/RepairList';
import ToolChecklist from '@/components/ToolChecklist';
import RepairLoadingScreen from '@/components/RepairLoadingScreen';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { RepairSession, RepairTask, OverlayPack } from '@/types';
import { router } from 'expo-router';

export default function RepairsTab() {
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [loadingRepairId, setLoadingRepairId] = useState<string | null>(null);
  const { state, dispatch } = useAppContext();
  const { colors } = useTheme();

  const handleSelectRepair = (repairId: string) => {
    setSelectedRepairId(repairId);
  };

  const handleStartRepair = (repairId: string) => {
    // Show loading screen and start preparation
    setLoadingRepairId(repairId);
    setShowLoadingScreen(true);
  };

  const handleLoadingComplete = (repairTask: RepairTask, overlayPack: OverlayPack | null) => {
    console.log('✅ Repair preparation completed, starting session');
    
    // Store prepared data in global app context
    dispatch({ type: 'SET_PREPARED_REPAIR', payload: { repairTask, overlayPack } });
    
    setShowLoadingScreen(false);
    setLoadingRepairId(null);

    const newSession: RepairSession = {
      id: Date.now().toString(),
      vehicleVin: state.vehicle?.vin || '',
      taskId: repairTask.id,
      taskName: repairTask.name || 'Unknown Repair',
      startTime: new Date().toISOString(),
      status: 'in_progress',
      currentStepIndex: 0,
      stepsCompleted: 0,
      totalSteps: repairTask.steps.length,
      voiceTranscript: [],
      stepLog: [],
    };

    dispatch({ type: 'START_REPAIR_SESSION', payload: newSession });
    
    // Navigate to live session tab
    router.push('/(tabs)/session');
  };

  const handleLoadingError = (error: string) => {
    console.error('❌ Repair preparation failed:', error);
    setShowLoadingScreen(false);
    setLoadingRepairId(null);
    
    // Show error to user (you might want to add an Alert here)
    console.error('Repair preparation error:', error);
  };

  const handleBackToList = () => {
    setSelectedRepairId(null);
  };

  const styles = createStyles(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Repairs</Text>
        {state.vehicle && (
          <Text style={[styles.vehicleInfo, { color: colors.textSecondary }]}>
            {state.vehicle.year} {state.vehicle.make} {state.vehicle.model}
          </Text>
        )}
      </View>

      <View style={styles.content}>
        {!state.vehicle ? (
          <View style={[styles.noVehicleContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.noVehicleTitle, { color: colors.text }]}>No Vehicle Identified</Text>
            <Text style={[styles.noVehicleText, { color: colors.textSecondary }]}>
              Please scan a VIN in the Scanner tab to view available repairs for your vehicle.
            </Text>
          </View>
        ) : (
          <>
            {selectedRepairId ? (
              <ToolChecklist 
                repairTaskId={selectedRepairId}
                onStartRepair={handleStartRepair}
                onBack={handleBackToList}
              />
            ) : (
              <RepairList onSelectRepair={handleSelectRepair} />
            )}
          </>
        )}
      </View>

      {/* Loading Screen Modal */}
      <Modal
        visible={showLoadingScreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {}} // Prevent closing during loading
      >
        {loadingRepairId && (
          <RepairLoadingScreen
            repairTaskId={loadingRepairId}
            vehicleVin={state.vehicle?.vin || ''}
            onLoadingComplete={handleLoadingComplete}
            onError={handleLoadingError}
          />
        )}
      </Modal>
    </View>
  );
}


const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  vehicleInfo: {
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  noVehicleContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  noVehicleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noVehicleText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});