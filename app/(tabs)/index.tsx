import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import VinScanner from '@/components/VinScanner';
import { VehicleProfileService, UserVehicle } from '@/services/vehicleProfileService';
import { Car, Plus } from 'lucide-react-native';
import { router } from 'expo-router';

export default function HomeTab() {
  const { state, dispatch } = useAppContext();
  const { colors } = useTheme();
  const [savedVehicles, setSavedVehicles] = React.useState<UserVehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = React.useState(true);
  const [showVinScanner, setShowVinScanner] = React.useState(false);
  const vehicleService = VehicleProfileService.getInstance();

  const styles = createStyles(colors);

  // Load saved vehicles on component mount
  React.useEffect(() => {
    loadSavedVehicles();
  }, []);

  const loadSavedVehicles = async () => {
    try {
      setIsLoadingVehicles(true);
      const vehicles = await vehicleService.getUserVehicles();
      setSavedVehicles(vehicles);
      
      // Show VIN scanner only if no vehicles exist
      if (vehicles.length === 0) {
        setShowVinScanner(true);
      }
    } catch (error) {
      console.error('Error loading saved vehicles:', error);
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  const handleVehicleSelect = (vehicle: UserVehicle) => {
    // Convert UserVehicle to Vehicle format for app context
    const vehicleData = {
      vin: vehicle.vin,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      trim: vehicle.trim,
    };
    
    // Set the selected vehicle in app context
    dispatch({ type: 'SET_VEHICLE', payload: vehicleData });
    
    // Navigate to repairs tab
    router.push('/(tabs)/repairs');
  };

  const handleAddNewVehicle = () => {
    // Show VIN scanner without clearing existing vehicles
    setShowVinScanner(true);
  };

  const handleVehicleAdded = () => {
    // Refresh vehicle list after adding new vehicle
    loadSavedVehicles();
    // Hide VIN scanner and return to vehicle list
    setShowVinScanner(false);
  };

  // Show loading state
  if (isLoadingVehicles) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>MechVision AR</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>AI-Powered Vehicle Repair Assistant</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your vehicles...</Text>
        </View>
      </View>
    );
  }

  // Mode 2: Welcome Screen (VIN Scanner) - Show when no vehicles OR when adding new vehicle
  if (savedVehicles.length === 0 || showVinScanner) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <VinScanner 
          onVehicleAdded={handleVehicleAdded}
          onBack={savedVehicles.length > 0 ? () => setShowVinScanner(false) : undefined}
        />
      </ScrollView>
    );
  }

  // Mode 1: Vehicle List Mode - Show when user has saved vehicles
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>MechVision AR</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>AI-Powered Vehicle Repair Assistant</Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={handleAddNewVehicle}
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.vehicleSelection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Your Vehicle</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Choose from your saved vehicles to start repairs
        </Text>
        
        {savedVehicles.map((vehicle) => (
          <TouchableOpacity
            key={vehicle.id}
            style={[styles.vehicleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleVehicleSelect(vehicle)}
          >
            <View style={styles.vehicleCardContent}>
              <View style={[styles.vehicleIcon, { backgroundColor: colors.primary + '20' }]}>
                <Car size={24} color={colors.primary} />
              </View>
              <View style={styles.vehicleDetails}>
                <Text style={[styles.vehicleName, { color: colors.text }]}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </Text>
                <Text style={[styles.vehicleVin, { color: colors.textSecondary }]}>
                  VIN: {vehicle.vin}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'left',
  },
  addButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
  },
  vehicleSelection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  vehicleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vehicleVin: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  vehicleEngine: {
    fontSize: 12,
  },
});