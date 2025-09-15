import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import {
  Settings,
  User,
  Car,
  Bell,
  Palette,
  Shield,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  History,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { VehicleProfileService, UserVehicle } from '@/services/vehicleProfileService';
import { validateVin } from '@/services/vinService';
import { clearAllRepairHistory } from '@/services/sessionService';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';

export default function SettingsScreen() {
  const { state: themeState, dispatch: themeDispatch, colors } = useTheme();
  const { dispatch: appDispatch } = useAppContext();
  const { state: authState, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVin, setNewVin] = useState('');
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<UserVehicle | null>(null);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);

  const vehicleService = VehicleProfileService.getInstance();

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      setIsLoading(true);
      const userVehicles = await vehicleService.getUserVehicles();
      setVehicles(userVehicles);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!validateVin(newVin)) {
      Alert.alert('Invalid VIN', 'Please enter a valid 17-character VIN number.');
      return;
    }

    setIsAddingVehicle(true);
    try {
      const newVehicle = await vehicleService.addVehicleByVin(newVin.toUpperCase());
      if (newVehicle) {
        setVehicles(prev => [newVehicle, ...prev]);
        setShowAddVehicle(false);
        setNewVin('');
        Alert.alert('Success', 'Vehicle added to your profile!');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add vehicle';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsAddingVehicle(false);
    }
  };

  const handleDeleteVehicle = (vehicle: UserVehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to remove ${vehicle.year} ${vehicle.make} ${vehicle.model} from your profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await vehicleService.deleteVehicle(vehicle.id);
              setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
              Alert.alert('Success', 'Vehicle removed from your profile');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          },
        },
      ]
    );
  };

  const handleViewVehicleDetails = (vehicle: UserVehicle) => {
    setSelectedVehicle(vehicle);
    setShowVehicleDetails(true);
  };

  const handleDeleteVehicleFromDetails = (vehicle: UserVehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to remove ${vehicle.year} ${vehicle.make} ${vehicle.model} from your profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await vehicleService.deleteVehicle(vehicle.id);
              setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
              setShowVehicleDetails(false);
              setSelectedVehicle(null);
              Alert.alert('Success', 'Vehicle removed from your profile');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          },
        },
      ]
    );
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    themeDispatch({ type: 'SET_THEME', payload: newTheme });
  };

  const handleNotificationsToggle = (enabled: boolean) => {
    themeDispatch({ type: 'SET_NOTIFICATIONS', payload: enabled });
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://example.com/privacy-policy');
  };

  const openTermsOfService = () => {
    Linking.openURL('https://example.com/terms-of-service');
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all repair history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearingHistory(true);
            try {
              await clearAllRepairHistory();
              // Clear history from app state as well
              appDispatch({ type: 'LOAD_HISTORY', payload: [] });
              Alert.alert('Success', 'All repair history has been cleared.');
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to clear history';
              Alert.alert('Error', errorMessage);
            } finally {
              setIsClearingHistory(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your vehicles will remain saved to your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            setVehicles([]); // Clear vehicles from local state
            Alert.alert('Signed Out', 'You have been signed out successfully.');
          },
        },
      ]
    );
  };

  const styles = createStyles(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Settings size={32} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account & Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Account & Profile</Text>
          </View>

          <View style={[styles.modernCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Email Section */}
            <View style={styles.modernSection}>
              <Text style={[styles.modernSectionTitle, { color: colors.text }]}>Email</Text>
              <View style={styles.emailContainer}>
                <Text style={[styles.modernSectionValue, { color: colors.textSecondary }]}>
                  {authState.user?.email}
                </Text>
                <TouchableOpacity
                  style={[styles.signOutButton, { borderColor: colors.error }]}
                  onPress={handleSignOut}
                >
                  <Text style={[styles.signOutButtonText, { color: colors.error }]}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.modernDivider, { backgroundColor: colors.border }]} />

            {/* Vehicles Section */}
            <View style={styles.modernSection}>
              <View style={styles.modernSectionHeader}>
                <Text style={[styles.modernSectionTitle, { color: colors.text }]}>My Vehicles</Text>
                <TouchableOpacity
                  style={[styles.modernAddButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowAddVehicle(true)}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.modernAddButtonText}>Add Vehicle</Text>
                </TouchableOpacity>
              </View>

              {isLoading ? (
                <Text style={[styles.modernLoadingText, { color: colors.textSecondary }]}>
                  Loading vehicles...
                </Text>
              ) : vehicles.length === 0 ? (
                <Text style={[styles.modernEmptyText, { color: colors.textSecondary }]}>
                  No vehicles added yet. Tap "Add Vehicle" to get started.
                </Text>
              ) : (
                <View style={styles.modernVehiclesList}>
                  {vehicles.map((vehicle, index) => (
                    <View
                      key={vehicle.id}
                      style={[
                        styles.modernVehicleItem,
                        index !== vehicles.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }
                      ]}
                    >
                      <View style={styles.modernVehicleInfo}>
                        <View style={[styles.modernVehicleIcon, { backgroundColor: colors.primary + '20' }]}>
                          <Car size={18} color={colors.primary} />
                        </View>
                        <View style={styles.modernVehicleDetails}>
                          <Text style={[styles.modernVehicleName, { color: colors.text }]}>
                            {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.engine || ''}
                          </Text>
                          <Text style={[styles.modernVehicleVin, { color: colors.textSecondary }]}>
                            VIN: {vehicle.vin}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.modernViewButton}
                        onPress={() => handleViewVehicleDetails(vehicle)}
                      >
                        <ChevronRight size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.settingItem}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Push Notifications</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Receive notifications about repair updates and tips
                </Text>
              </View>
              <Switch
                value={themeState.notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Palette size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Theme</Text>
            
            <View style={styles.themeOptions}>
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <TouchableOpacity
                  key={theme}
                  style={[
                    styles.themeOption,
                    { borderColor: colors.border },
                    themeState.theme === theme && { 
                      backgroundColor: colors.primary,
                      borderColor: colors.primary 
                    }
                  ]}
                  onPress={() => handleThemeChange(theme)}
                >
                  <Text style={[
                    styles.themeOptionText,
                    { color: themeState.theme === theme ? '#FFFFFF' : colors.text }
                  ]}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Privacy & Security Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy & Security</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.settingItem} onPress={openPrivacyPolicy}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Privacy Policy</Text>
              <ExternalLink size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.settingItem} onPress={openTermsOfService}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Terms of Service</Text>
              <ExternalLink size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: colors.border }]} />

            <View style={styles.settingItem}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Permissions</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Camera and microphone access required for AR features
                </Text>
              </View>
              <ChevronRight size={16} color={colors.textSecondary} />
            </View>
          </View>
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <History size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={handleClearHistory}
              disabled={isClearingHistory}
            >
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Clear Repair History</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Delete all repair sessions and voice logs permanently
                </Text>
              </View>
              <View style={styles.clearHistoryButton}>
                {isClearingHistory ? (
                  <Text style={[styles.clearingText, { color: colors.textSecondary }]}>Clearing...</Text>
                ) : (
                  <Trash2 size={16} color={colors.error} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Add Vehicle Modal */}
      <Modal
        visible={showAddVehicle}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddVehicle(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddVehicle(false)}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Vehicle</Text>
            <TouchableOpacity
              onPress={handleAddVehicle}
              disabled={!newVin || isAddingVehicle}
            >
              <Text style={[
                styles.modalSave,
                { color: newVin && !isAddingVehicle ? colors.primary : colors.textSecondary }
              ]}>
                {isAddingVehicle ? 'Adding...' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={[styles.modalLabel, { color: colors.text }]}>
              Vehicle Identification Number (VIN)
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { 
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text 
                }
              ]}
              value={newVin}
              onChangeText={setNewVin}
              placeholder="Enter 17-character VIN"
              placeholderTextColor={colors.textSecondary}
              maxLength={17}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
              The VIN will be decoded automatically to get your vehicle details.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Authentication Modal */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="signin"
      />

      {/* Vehicle Details Modal */}
      <Modal
        visible={showVehicleDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVehicleDetails(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowVehicleDetails(false)}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Vehicle Details</Text>
            <TouchableOpacity
              onPress={() => selectedVehicle && handleDeleteVehicleFromDetails(selectedVehicle)}
            >
              <Trash2 size={20} color={colors.error} />
            </TouchableOpacity>
          </View>

          {selectedVehicle && (
            <View style={styles.modalContent}>
              <View style={[styles.vehicleDetailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.vehicleDetailIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Car size={32} color={colors.primary} />
                </View>
                <Text style={[styles.vehicleDetailTitle, { color: colors.text }]}>
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                </Text>
                
                <ScrollView style={styles.vehicleDetailsList} showsVerticalScrollIndicator={false}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>VIN</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.vin}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Engine</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.engine || 'Unknown'}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Body Style</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.bodyStyle || 'Unknown'}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Trim</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.trim || 'Unknown'}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Drivetrain</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.drivetrain || 'Unknown'}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Steering</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedVehicle.steering || 'Unknown'}</Text>
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 14,
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  vehicleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleDetails: {
    marginLeft: 12,
    flex: 1,
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
  deleteButton: {
    padding: 8,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
    lineHeight: 20,
  },
  themeOptions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  themeOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    marginVertical: 8,
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
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  modalHint: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  clearHistoryButton: {
    padding: 4,
  },
  clearingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Modern combined card styles
  modernCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  modernSection: {
    marginBottom: 16,
  },
  modernSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modernSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modernSectionValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  modernDivider: {
    height: 1,
    marginVertical: 16,
  },
  modernAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modernAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  modernLoadingText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  modernEmptyText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
    lineHeight: 20,
  },
  modernVehiclesList: {
    marginTop: 8,
  },
  modernVehicleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  modernVehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernVehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modernVehicleDetails: {
    flex: 1,
  },
  modernVehicleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modernVehicleVin: {
    fontSize: 12,
    fontFamily: 'monospace',
    opacity: 0.8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  modernDeleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  modernViewButton: {
    padding: 8,
    borderRadius: 8,
  },
  emailContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signOutButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notSignedInText: {
    fontSize: 16,
    fontWeight: '500',
  },
  signInButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modernSignInButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modernSignInButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  vehicleDetailCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  vehicleDetailIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleDetailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  vehicleDetailsList: {
    width: '100%',
    maxHeight: 300,
  },
});