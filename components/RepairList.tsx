import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Wrench, Clock, CircleAlert as AlertCircle, Zap, Bot, Disc3, Droplets, Battery, Wind, Cpu } from 'lucide-react-native';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getRepairTasksForVehicle, generateRepairSteps, GenerateRepairRequest } from '@/services/repairService';

interface RepairListProps {
  onSelectRepair: (repairId: string) => void;
}

const AI_REPAIR_TYPES = [
  { id: 'brake_pads', name: 'Brake Pad Replacement', iconComponent: 'Disc3', difficulty: 'Medium' },
  { id: 'oil_change', name: 'Oil Change', iconComponent: 'Droplets', difficulty: 'Easy' },
  { id: 'battery_replacement', name: 'Battery Replacement', iconComponent: 'Battery', difficulty: 'Easy' },
  { id: 'air_filter', name: 'Air Filter Replacement', iconComponent: 'Wind', difficulty: 'Easy' },
  { id: 'spark_plugs', name: 'Spark Plug Replacement', iconComponent: 'Zap', difficulty: 'Medium' },
];

export default function RepairList({ onSelectRepair }: RepairListProps) {
  const { state, dispatch } = useAppContext();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [generatingRepair, setGeneratingRepair] = useState<string | null>(null);

  useEffect(() => {
    async function loadRepairs() {
      if (state.vehicle) {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
          const repairs = await getRepairTasksForVehicle(
            state.vehicle.make,
            state.vehicle.model,
            state.vehicle.year
          );
          dispatch({ type: 'SET_AVAILABLE_REPAIRS', payload: repairs });
        } catch (error) {
          console.error('Error loading repairs:', error);
        } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }
    }
    
    loadRepairs().catch((error) => {
      console.error('Failed to load repairs:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    });
  }, [state.vehicle]);

  const handleGenerateAIRepair = async (repairType: string) => {
    if (!state.vehicle?.vin) {
      console.error('No VIN available for repair generation');
      return;
    }

    setGeneratingRepair(repairType);
    try {
      const request: GenerateRepairRequest = {
        vin: state.vehicle.vin,
        repair_type: repairType as any,
      };

      const generatedRepair = await generateRepairSteps(request);
      if (generatedRepair) {
        // Add the generated repair to available repairs
        dispatch({ 
          type: 'SET_AVAILABLE_REPAIRS', 
          payload: [...state.availableRepairs, generatedRepair] 
        });
        
        // Auto-select the generated repair
        onSelectRepair(generatedRepair.id);
      }
    } catch (error) {
      console.error('Error generating AI repair:', error);
    } finally {
      setGeneratingRepair(null);
    }
  };

  const getRepairIcon = (iconComponent: string) => {
    const iconProps = { size: 28, color: colors.primary };
    
    switch (iconComponent) {
      case 'Disc3': return <Disc3 {...iconProps} />;
      case 'Droplets': return <Droplets {...iconProps} />;
      case 'Battery': return <Battery {...iconProps} />;
      case 'Wind': return <Wind {...iconProps} />;
      case 'Zap': return <Zap {...iconProps} />;
      default: return <Wrench {...iconProps} />;
    }
  };
  if (!state.vehicle) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Please identify a vehicle in the Scanner tab to view available repairs
        </Text>
      </View>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return colors.success;
      case 'Medium': return colors.warning;
      case 'Hard': return colors.error;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.vehicleInfo}>
        <Text style={[styles.vehicleInfoText, { color: colors.text }]}>
          Repairs for {state.vehicle.year} {state.vehicle.make} {state.vehicle.model}
        </Text>
      </View>

      {state.isLoading ? (
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Loading repairs...</Text>
        </View>
      ) : (
        <ScrollView style={styles.repairsList} showsVerticalScrollIndicator={false}>
          {/* Modern Vertical Repair Cards */}
          <View style={styles.modernRepairsList}>
              {AI_REPAIR_TYPES.map((repair) => (
                <TouchableOpacity
                  key={repair.id}
                  style={[
                    styles.modernRepairCard,
                    { backgroundColor: colors.surface },
                    generatingRepair === repair.id && styles.aiRepairCardLoading
                  ]}
                  onPress={() => handleGenerateAIRepair(repair.id)}
                  disabled={generatingRepair === repair.id}
                >
                  <View style={[styles.modernRepairIcon, { backgroundColor: colors.primary + '15' }]}>
                    {generatingRepair === repair.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      getRepairIcon(repair.iconComponent)
                    )}
                  </View>
                  <View style={styles.modernRepairContent}>
                    <Text style={[styles.modernRepairName, { color: colors.text }]}>{repair.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
          </View>

          {/* Traditional Database Repairs */}
          {state.availableRepairs.length > 0 && (
            <View style={styles.traditionalSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Database Repairs</Text>
              {state.availableRepairs.map((repair) => (
                <TouchableOpacity
                  key={repair.id}
                  style={[styles.repairCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => onSelectRepair(repair.id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                      <Wrench size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.repairInfo}>
                      <Text style={[styles.repairName, { color: colors.text }]}>{repair.name}</Text>
                      <Text style={[styles.repairDescription, { color: colors.textSecondary }]}>
                        {repair.description}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDetails}>
                    <View style={styles.detailItem}>
                      <Clock size={16} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {repair.estimatedTime}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <AlertCircle size={16} color={getDifficultyColor(repair.difficulty)} />
                      <Text style={[styles.detailText, { color: getDifficultyColor(repair.difficulty) }]}>
                        {repair.difficulty}
                      </Text>
                    </View>
                  </View>

                  {repair.toolsRequired.length > 0 && (
                    <View style={[styles.toolsPreview, { borderTopColor: colors.border }]}>
                      <Text style={[styles.toolsLabel, { color: colors.textSecondary }]}>Tools needed:</Text>
                      <Text style={[styles.toolsText, { color: colors.text }]}>
                        {repair.toolsRequired.slice(0, 3).map(tool => tool.name).join(', ')}
                        {repair.toolsRequired.length > 3 && ` +${repair.toolsRequired.length - 3} more`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
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
  },
  emptyText: {
    fontSize: 16,
  },
  vehicleInfo: {
    marginBottom: 16,
  },
  vehicleInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  repairsList: {
    flex: 1,
  },
  modernRepairsList: {
    marginBottom: 24,
  },
  modernRepairCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernRepairIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modernRepairContent: {
    flex: 1,
  },
  modernRepairName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  repairCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  repairInfo: {
    flex: 1,
  },
  repairName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  repairDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  toolsPreview: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  toolsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  toolsText: {
    fontSize: 14,
  },
  // AI Repair Section Styles
  aiSection: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  aiIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  aiHeaderText: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 1,
  },
  aiSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  aiStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  aiStatusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  aiRepairGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  aiRepairCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  aiRepairCardLoading: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  modernIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiRepairName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  aiRepairDifficulty: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  traditionalSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});