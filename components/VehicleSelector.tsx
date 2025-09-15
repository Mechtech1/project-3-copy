import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Car, ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { VehicleProfileService, UserVehicle } from '@/services/vehicleProfileService';

interface VehicleSelectorProps {
  selectedVehicle: UserVehicle | null;
  onVehicleSelect: (vehicle: UserVehicle) => void;
  onAddVehicle: () => void;
}

export default function VehicleSelector({
  selectedVehicle,
  onVehicleSelect,
  onAddVehicle,
}: VehicleSelectorProps) {
  const { colors } = useTheme();
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const vehicleService = VehicleProfileService.getInstance();

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      setIsLoading(true);
      const userVehicles = await vehicleService.getUserVehicles();
      setVehicles(userVehicles);
      
      // Auto-select first vehicle if none selected
      if (!selectedVehicle && userVehicles.length > 0) {
        onVehicleSelect(userVehicles[0]);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVehicleSelect = (vehicle: UserVehicle) => {
    onVehicleSelect(vehicle);
    setShowSelector(false);
  };

  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading vehicles...
        </Text>
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.emptyState}>
          <Car size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Vehicles Added</Text>
          <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
            Add a vehicle to access repair instructions
          </Text>
          <TouchableOpacity
            style={[styles.addVehicleButton, { backgroundColor: colors.primary }]}
            onPress={onAddVehicle}
          >
            <Text style={styles.addVehicleButtonText}>Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowSelector(true)}
      >
        <View style={styles.selectorContent}>
          <Car size={20} color={colors.primary} />
          <View style={styles.vehicleInfo}>
            <Text style={[styles.vehicleName, { color: colors.text }]}>
              {selectedVehicle
                ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                : 'Select Vehicle'
              }
            </Text>
            {selectedVehicle && (
              <Text style={[styles.vehicleVin, { color: colors.textSecondary }]}>
                VIN: {selectedVehicle.vin}
              </Text>
            )}
          </View>
          <ChevronDown size={20} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={showSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSelector(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSelector(false)}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Vehicle</Text>
            <TouchableOpacity onPress={onAddVehicle}>
              <Text style={[styles.modalAdd, { color: colors.primary }]}>Add New</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {vehicles.map((vehicle) => (
              <TouchableOpacity
                key={vehicle.id}
                style={[
                  styles.vehicleOption,
                  { backgroundColor: colors.card, borderColor: colors.border }
                ]}
                onPress={() => handleVehicleSelect(vehicle)}
              >
                <View style={styles.vehicleOptionContent}>
                  <Car size={20} color={colors.primary} />
                  <View style={styles.vehicleOptionInfo}>
                    <Text style={[styles.vehicleOptionName, { color: colors.text }]}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </Text>
                    <Text style={[styles.vehicleOptionVin, { color: colors.textSecondary }]}>
                      VIN: {vehicle.vin}
                    </Text>
                  </View>
                  {selectedVehicle?.id === vehicle.id && (
                    <Check size={20} color={colors.success} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  selector: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
  },
  vehicleVin: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  addVehicleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addVehicleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  modalCancel: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalAdd: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  vehicleOption: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  vehicleOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vehicleOptionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  vehicleOptionVin: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  vehicleOptionEngine: {
    fontSize: 12,
    marginTop: 2,
  },
});